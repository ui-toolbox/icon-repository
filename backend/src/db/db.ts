import { List } from "immutable";
import { Observable, Observer } from "rxjs";
import { Pool, QueryResult, Query, PoolClient } from "pg";

import { IAddIconRequestData, IIconInfo } from "../icon";
import appConfigProvider, { ConfigurationDataProvider } from "../configuration";
import logger from "../utils/logger";
import {
    IColumnsDefinition,
    projectColumn,
    IconFileTableColumnsDef,
    IconTableColumnsDef,
    iconTableSpec,
    iconFileTableSpec,
    IColumnSpec
} from "./db-schema";

const ctxLogger = logger.createChild("db");

const createPoolUsing: (configProvider: ConfigurationDataProvider) => Pool
= config => {
        const connOptions = {
            user: config().conn_user,
            host: config().conn_host,
            database: config().conn_database,
            password: config().conn_password,
            port: parseInt(config().conn_port, 10)
        };
        const pool = new Pool(connOptions);
        pool.on("error", (err, client) => {
            ctxLogger.error("Unexpected error on idle client: %o", err);
            process.exit(-1);
        });
        return pool;
    };

export const createPool: () => Observable<Pool>
= () => appConfigProvider.map(config => createPoolUsing(config));

export const query: (pool: Pool, statement: string, parameters: any[]) => Observable<QueryResult>
= (pool, statement, parameters) => {
    ctxLogger.info("Executing \"%s\"...", statement);
    return Observable.create(
        (observer: Observer<QueryResult>) => pool.query(
            statement,
            parameters
        ).then(result => {
            observer.next(result);
            observer.complete();
        }, error => observer.error(error))
        .catch(error => Observable.throw(error))
    );
};

type ClientQuery = (queryText: string, values?: any[]) => Promise<QueryResult>;

interface IConnection {
    readonly execute: ClientQuery;
    readonly release: () => void;
}
const createClient: (pool: Pool) => Observable<IConnection> = pool => Observable.create(
    (observer: Observer<IConnection>) => pool.connect((err, client, done) => {
        if (err) {
            observer.error(err);
        } else {
            observer.next({
                execute: (queryText, values) => client.query(queryText, values),
                release: done
            });
            observer.complete();
        }
    })
);

const execStatement: (connection: IConnection, statement: string, parameters: any[]) => Observable<QueryResult>
= (connection, statement, parameters) => Observable.create((observer: Observer<QueryResult>) =>
    connection.execute(statement, parameters)
    .then(
        result => {
            observer.next(result);
            observer.complete();
        },
        error =>
        observer.error(error)
    )
    .catch(error => observer.error(error))
);

type Transactable<R> = (connection: IConnection) => Observable<R>;

function tx<R>(pool: Pool, transactable: Transactable<R>) {
    return createClient(pool)
    .flatMap(conn =>
        execStatement(conn, "BEGIN", [])
        .flatMap(() => transactable(conn))
        .flatMap(result =>
            execStatement(conn, "COMMIT", [])
            .mapTo(conn.release())
            .mapTo(result)
        )
        .catch(error =>
            execStatement(conn, "ROLLBACK", [])
            .mapTo(conn.release())
            .catch(rollbakcError => {
                conn.release();
                ctxLogger.error("Error while rolling back: %o", rollbakcError);
                return Observable.throw(error);
            })
            .map(() => { throw error; })
        )
    );
}

type AddIconFileToTable = (
    conn: IConnection,
    iconId: number,
    iconFileInfo: IAddIconRequestData,
    modifiedBy: string
) => Observable<number>;
const addIconFileToTable: AddIconFileToTable = (conn, iconId, iconFileInfo, modifiedBy) => {
    const columns: IconFileTableColumnsDef = iconFileTableSpec.columns as IconFileTableColumnsDef;
    const addIconFile: string = `INSERT INTO ${iconFileTableSpec.tableName}(` +
                                `${columns.id.name}, ${columns.fileFormat.name}, ` +
                                `${columns.iconSize.name}, ${columns.content.name}) ` +
                                `VALUES($1, $2, $3, $4) RETURNING id`;
    return execStatement(conn, addIconFile, [
        iconId,
        iconFileInfo.format,
        iconFileInfo.size,
        iconFileInfo.content
    ])
    .map(result => result.rows[0].id);
};

type AddIconToDB = (
    iconFileInfo: IAddIconRequestData,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>
) => Observable<number>;
type AddIconToDBProvider = (pool: Pool) => AddIconToDB;
export const addIconToDBProvider: AddIconToDBProvider = pool => (iconFileInfo, modifiedBy, createSideEffect) => {
    const iconVersion = 1;
    const columns: IconTableColumnsDef = iconTableSpec.columns as IconTableColumnsDef;
    const addIconSQL: string = `INSERT INTO ${iconTableSpec.tableName}(` +
                                `${columns.name.name}, ${columns.version.name}, ${columns.modifiedBy.name}) ` +
                                `VALUES($1, $2, $3) RETURNING id`;
    const addIconParams = [iconFileInfo.iconName, iconVersion, modifiedBy];
    return tx<number>(
        pool,
        conn => execStatement(conn, addIconSQL, addIconParams)
                .flatMap(addIconResult => {
                    const iconId = addIconResult.rows[0].id;
                    return addIconFileToTable(conn, iconId, iconFileInfo, modifiedBy)
                    .flatMap(() => createSideEffect ? createSideEffect() : Observable.of(void 0))
                    .mapTo(iconId);
                })
    );
};

export type GetIconFileFromDB = (
    iconId: number,
    format: string,
    iconSize: string) => Observable<Buffer>;
type GetIconFileFromDBProvider = (pool: Pool) => GetIconFileFromDB;
export const getIconFileFromDBProvider: GetIconFileFromDBProvider = pool => (iconId, format, iconSize) => {
    const columns: IconFileTableColumnsDef = iconFileTableSpec.columns as IconFileTableColumnsDef;
    const getIconFileSQL = `SELECT content FROM ${iconFileTableSpec.tableName} ` +
                            `WHERE ${columns.icondId} = $1 AND ` +
                                `${columns.fileFormat} = $2 AND ` +
                                `${columns.iconSize} = $3`;
    return query(pool, getIconFileSQL, [iconId, format, iconSize])
    .map(result => result.rows[0].content);
};

export interface IIconDAFs {
    readonly addIconToDB: AddIconToDB;
    readonly getIconFileFromDB: GetIconFileFromDB;
}

const dbAccessProvider: (configProvider: ConfigurationDataProvider) => IIconDAFs
= configProvider => {
    const pool = createPoolUsing(configProvider);
    return {
        addIconToDB: addIconToDBProvider(pool),
        getIconFileFromDB: getIconFileFromDBProvider(pool)
    };
};

const projectIconTableColumnWithAlias = (columnSpec: IColumnSpec, alias: string) =>
    `${projectColumn(iconTableSpec, columnSpec)} as ${alias}`;

type GetAllIconsFromDB = () => Observable<List<IIconInfo>>;
export const getAllIconsFromDBProvider: (pool: Pool) => GetAllIconsFromDB
= pool => () => {
    const iconTableCols: IconTableColumnsDef = iconTableSpec.columns as IconTableColumnsDef;
    const iconFileTableCols: IconFileTableColumnsDef = iconFileTableSpec.columns as IconFileTableColumnsDef;
    const sql: string = `SELECT ${projectIconTableColumnWithAlias(iconTableCols.id, "icon_id")}, ` +
                                `${projectIconTableColumnWithAlias(iconTableCols.name, "icon_name")}, ` +
                                `${projectIconTableColumnWithAlias(iconTableCols.version, "icon_version")}, ` +
                            `FROM ${iconTableSpec.tableName}, ${iconFileTableSpec.tableName} ` +
                        `WHERE ${iconTableCols.id.name} = ${iconFileTableCols.icondId.name} ` +
                        `ORDER BY icon_id, icon_file_format, icon_size`;
    return query(pool, sql, [])
    .map(result => {
        result.rows.map(row => {
            row[]
        });
    });
};

export default dbAccessProvider;
