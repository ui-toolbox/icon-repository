import { List, Set } from "immutable";
import { Observable, Observer } from "rxjs";
import { Pool, QueryResult, Query, PoolClient } from "pg";

import { CreateIconInfo, IconDescriptor, IconFileData, IconFile, IconFileDescriptor } from "../icon";
import appConfigProvider, { ConfigurationDataProvider } from "../configuration";
import logger from "../utils/logger";
import {
    IconFileTableColumnsDef,
    IconTableColumnsDef,
    iconTableSpec,
    iconFileTableSpec,
    iconFileTableColumns
} from "./db-schema";
import { last } from "rxjs/operator/last";

const ctxLogger = logger.createChild("db");

const createPoolUsing: (connectionProperties: ConnectionProperties) => Pool
= connectionProperties => {
        const connOptions = {
            user: connectionProperties.conn_user,
            host: connectionProperties.conn_host,
            database: connectionProperties.conn_database,
            password: connectionProperties.conn_password,
            port: parseInt(connectionProperties.conn_port, 10)
        };
        const pool = new Pool(connOptions);
        pool.on("error", (err, client) => {
            ctxLogger.error("Unexpected error on idle client: %o", err);
            process.exit(-1);
        });
        return pool;
    };

export const createPool: (connectionProperties: ConnectionProperties) => Observable<Pool>
= connectionProperties => Observable.of(createPoolUsing(connectionProperties));

export const query: (pool: Pool, statement: string, parameters: any[]) => Observable<QueryResult>
= (pool, statement, parameters) => {
    ctxLogger.info("Executing \"%s\"...", statement);
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

type ExecuteQuery = (queryText: string, values?: any[]) => Observable<QueryResult>;

interface IConnection {
    readonly executeQuery: ExecuteQuery;
    readonly release: () => void;
}
const createClient: (pool: Pool) => Observable<IConnection> = pool => Observable.create(
    (observer: Observer<IConnection>) => pool.connect((err, client, done) => {
        if (err) {
            observer.error(err);
        } else {
            observer.next({
                executeQuery: (queryText, values) => Observable.create(
                    (qryObserver: Observer<QueryResult>) => {
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

function tx<R>(pool: Pool, transactable: Transactable<R>) {
    return createClient(pool)
    .flatMap(conn =>
        conn.executeQuery("BEGIN", [])
        .flatMap(() => transactable(conn.executeQuery))
        .flatMap(result =>
            conn.executeQuery("COMMIT", [])
            .mapTo(conn.release())
            .mapTo(result)
        )
        .catch(error =>
            conn.executeQuery("ROLLBACK", [])
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
    executeQuery: ExecuteQuery,
    iconFile: IconFile,
    modifiedBy: string
) => Observable<number>;
const addIconFileToTable: AddIconFileToTable = (executeQuery, iconFileInfo, modifiedBy) => {
    const addIconFile: string = "INSERT INTO icon_file(icon_id, file_format, icon_size, content) " +
                                "SELECT id, $2, $3, $4 FROM icon WHERE name = $1 RETURNING id";
    return executeQuery(addIconFile, [
        iconFileInfo.iconName,
        iconFileInfo.format,
        iconFileInfo.size,
        iconFileInfo.content
    ])
    .map(result => result.rows[0].id);
};

type AddIconToDB = (
    iconInfo: CreateIconInfo,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>
) => Observable<number>;
type AddIconToDBProvider = (pool: Pool) => AddIconToDB;
export const createIcon: AddIconToDBProvider = pool => (iconInfo, modifiedBy, createSideEffect) => {
    const iconVersion = 1;
    const addIconSQL: string = "INSERT INTO icon(name, version, modified_by) " +
                                "VALUES($1, $2, $3) RETURNING id";
    const addIconParams = [iconInfo.iconName, iconVersion, modifiedBy];
    return tx<number>(
        pool,
        executeQuery => executeQuery(addIconSQL, addIconParams)
                .flatMap(addIconResult => {
                    const iconId = addIconResult.rows[0].id;
                    return addIconFileToTable(executeQuery, {
                        iconName: iconInfo.iconName,
                        format: iconInfo.format,
                        size: iconInfo.size,
                        content: iconInfo.content
                    }, modifiedBy)
                    .flatMap(() => createSideEffect ? createSideEffect() : Observable.of(void 0))
                    .mapTo(iconId);
                })
    );
};

export type GetIconFile = (
    iconName: string,
    format: string,
    iconSize: string) => Observable<Buffer>;
export const getIconFile: (pool: Pool) => GetIconFile = pool => (iconName, format, iconSize) => {
    const getIconFileSQL = "SELECT content FROM icon, icon_file " +
                            "WHERE icon_id = icon.id AND " +
                                "file_format = $2 AND " +
                                "icon_size = $3 AND " +
                                "icon.name = $1";
    return query(pool, getIconFileSQL, [iconName, format, iconSize])
        .map(result => result.rows[0].content);
};

type AddIconFile = (iconFile: IconFile, modifiedBy: string) => Observable<number>;

const addIconFileToIcon: (pool: Pool) => AddIconFile = pool => (iconFile, modifiedBy) => {
    const selectIconVersionForUpdateSQL = "SELECT version FROM icon WHERE name = $1 FOR UPDATE";
    const updateIconVersionSQL = "UPDATE icon SET version = $1 WHERE name = $2";
    return tx(pool, (executeQuery: ExecuteQuery) => {
        return executeQuery(selectIconVersionForUpdateSQL, [iconFile.iconName])
        .flatMap(queryResult =>
            addIconFileToTable(executeQuery, iconFile, modifiedBy)
            .flatMap(iconFileId => {
                const version = queryResult.rows[0].version;
                return executeQuery(updateIconVersionSQL, [version + 1, iconFile.iconName])
                .map(() => iconFileId);
            })
        );
    });
};

export interface IconDAFs {
    readonly createIcon: AddIconToDB;
    readonly getIconFile: GetIconFile;
    readonly addIconFileToIcon: AddIconFile;
    readonly getAllIcons: GetAllIcons;
}

export interface ConnectionProperties {
    conn_user: string;
    conn_host: string;
    conn_database: string;
    conn_password: string;
    conn_port: string;
}

const dbAccessProvider: (connectionProperties: ConnectionProperties) => IconDAFs
= connectionProperties => {
    const pool = createPoolUsing(connectionProperties);
    return {
        createIcon: createIcon(pool),
        getIconFile: getIconFile(pool),
        addIconFileToIcon: addIconFileToIcon(pool),
        getAllIcons: getAllIcons(pool)
    };
};

type GetAllIcons = () => Observable<List<IconDescriptor>>;
export const getAllIcons: (pool: Pool) => GetAllIcons
= pool => () => {
    const iconTableCols: IconTableColumnsDef = iconTableSpec.columns as IconTableColumnsDef;
    const iconFileTableCols: IconFileTableColumnsDef = iconFileTableSpec.columns as IconFileTableColumnsDef;
    const sql: string =
                "SELECT icon.name as icon_name, " +
                    "icon.id as icon_id, " +
                    "icon.version as icon_version, " +
                    "icon_file.file_format as icon_file_format, " +
                    "icon_file.icon_size as icon_size " +
                "FROM icon, icon_file " +
                    "WHERE icon.id = icon_file.icon_id " +
                    "ORDER BY icon_id, icon_file_format, icon_size";
    return query(pool, sql, [])
    .map(result => result.rows.reduce(
        (iconInfoList: List<IconDescriptor>, row: any) => {
            const iconFile: IconFileDescriptor = {
                format: row.icon_file_format,
                size: row.icon_size
            };
            let lastIconInfo: IconDescriptor = iconInfoList.last();
            let lastIndex: number = iconInfoList.size - 1;
            if (!lastIconInfo || row.icon_name !== lastIconInfo.iconName) {
                lastIconInfo = new IconDescriptor(row.icon_name, Set());
                lastIndex++;
            }
            return iconInfoList.set(lastIndex, lastIconInfo.addIconFile(iconFile));
        },
        List()
    ));
};

export default dbAccessProvider;