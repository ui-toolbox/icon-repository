
import { throwError as observableThrowError,  Observable, Observer, of } from "rxjs";
import { flatMap, catchError, mapTo, finalize, map, reduce } from "rxjs/operators";
import { List, Set } from "immutable";
import { Pool, QueryResult } from "pg";

import loggerFactory from "../utils/logger";
import { createSchema, CreateSchema } from "./create-schema";

export const pgErrorCodes = {
    unique_constraint_violation: "23505"
};

const ctxLogger = loggerFactory("db");

export interface ConnectionProperties {
    readonly user: string;
    readonly host: string;
    readonly database: string;
    readonly password: string;
    readonly port: string;
}

const checkDefined: (value: string, name: string) => void = (value, name) => {
    if (typeof value === "undefined") {
        throw new Error(`Connection property ${name} is undefined`);
    }
};

export const createConnectionProperties: (config: any) => ConnectionProperties
= config => {
    checkDefined(config.conn_user, "conn_user");
    checkDefined(config.conn_host, "conn_host");
    checkDefined(config.conn_database, "conn_database");
    checkDefined(config.conn_password, "conn_password");
    checkDefined(config.conn_port, "conn_port");

    return {
        user: config.conn_user,
        host: config.conn_host,
        database: config.conn_database,
        password: config.conn_password,
        port: config.conn_port
    };
};

export const createPoolUsing: (connectionProperties: ConnectionProperties) => Pool
= connectionProperties => {
    const connOptions = {
        user: connectionProperties.user,
        password: connectionProperties.password,
        host: connectionProperties.host,
        database: connectionProperties.database,
        port: parseInt(connectionProperties.port, 10)
    };
    const pool = new Pool(connOptions);
    pool.on("error", (err, client) => {
        ctxLogger.error("Unexpected error on idle client: %o", err);
        process.exit(-1);
    });
    return pool;
};

export const createPool: (connectionProperties: ConnectionProperties) => Observable<Pool>
= connectionProperties => of(createPoolUsing(connectionProperties));

export const query: (pool: Pool, statement: string, parameters: any[]) => Observable<QueryResult>
= (pool, statement, parameters) => {
    ctxLogger.debug("Executing \"%s\"...", statement);
    return Observable.create(
        (observer: Observer<QueryResult>) => pool.query(
            statement,
            parameters
        )
        .then(
            result => {
                observer.next(result);
                observer.complete();
            },
            error => observer.error(error)
        )
        .catch(error => observer.error(error))
    );
};

export type ExecuteQuery = (queryText: string, values?: any[]) => Observable<QueryResult>;

interface Connection {
    readonly executeQuery: ExecuteQuery;
    readonly release: () => void;
}

const getPooledConnection: (pool: Pool) => Observable<Connection> = pool => Observable.create(
    (observer: Observer<Connection>) => pool.connect((err, client, done) => {
        if (err) {
            observer.error(err);
        } else {
            observer.next({
                executeQuery: (queryText, values) => Observable.create(
                    (qryObserver: Observer<QueryResult>) => {
                        ctxLogger.debug("Executing %s", queryText);
                        client.query(queryText, values)
                        .then(
                            queryResult => {
                                qryObserver.next(queryResult);
                                qryObserver.complete();
                            },
                            error => qryObserver.error(error)
                        )
                        .catch(error => qryObserver.error(error));
                    }
                ),
                release: done
            });
            observer.complete();
        }
    })
);

type Transactable<R> = (executeQuery: ExecuteQuery) => Observable<R>;

export const tx = <R>(pool: Pool, transactable: Transactable<R>) => {
    return getPooledConnection(pool)
    .pipe(
        flatMap(conn =>
            conn.executeQuery("BEGIN", [])
            .pipe(
                flatMap(() => transactable(conn.executeQuery)),
                flatMap(result =>
                    conn.executeQuery("COMMIT", [])
                    .pipe(
                        mapTo(conn.release()),
                        mapTo(result)
                    )),
                catchError(error =>
                    conn.executeQuery("ROLLBACK", [])
                    .pipe(
                        catchError(rollbakcError => {
                            ctxLogger.error("Error while rolling back: %o", rollbakcError);
                            return observableThrowError(error);
                        }),
                        finalize(() => conn.release()),
                        map(() => { throw error; })
                    )
                )
            ))
    );
};
