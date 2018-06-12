import { List, Set } from "immutable";
import { Observable, Observer } from "rxjs";
import { Pool, QueryResult, Query, PoolClient } from "pg";

import { IAddIconRequestData, IconInfo, IconFileInfo, IAddIconFileRequestData } from "../icon";
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
    iconFileInfo: IAddIconFileRequestData,
    modifiedBy: string
) => Observable<number>;
const addIconFileToTable: AddIconFileToTable = (executeQuery, iconFileInfo, modifiedBy) => {
    const addIconFile: string = "INSERT INTO icon_file(icon_id, file_format, icon_size, content) " +
                                "VALUES($1, $2, $3, $4) RETURNING id";
    return executeQuery(addIconFile, [
        iconFileInfo.iconId,
        iconFileInfo.format,
        iconFileInfo.size,
        iconFileInfo.content
    ])
    .map(result => result.rows[0].id);
};

type AddIconToDB = (
    iconInfo: IAddIconRequestData,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>
) => Observable<number>;
type AddIconToDBProvider = (pool: Pool) => AddIconToDB;
export const addIconToDBProvider: AddIconToDBProvider = pool => (iconInfo, modifiedBy, createSideEffect) => {
    const iconVersion = 1;
    const addIconSQL: string = "INSERT INTO icon(name, version, modified_by) " +
                                "VALUES($1, $2, $3) RETURNING id";
    const addIconParams = [iconInfo.iconName, iconVersion, modifiedBy];
    return tx<number>(
        pool,
        executeQuery => executeQuery(addIconSQL, addIconParams)
                .flatMap(addIconResult => {
                    const iconId = addIconResult.rows[0].id;
                    return addIconFileToTable(executeQuery, {...iconInfo, iconId }, modifiedBy)
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
    const getIconFileSQL = "SELECT content FROM icon_file " +
                            "WHERE icon_id = $1 AND " +
                                "file_format = $2 AND " +
                                "icon_size = $3";
    return query(pool, getIconFileSQL, [iconId, format, iconSize])
        .map(result => result.rows[0].content);
};

type AddIconFileToDB = (addIconFileRequestData: IAddIconFileRequestData, modifiedBy: string) => Observable<number>;

const addIconFileToDBProvider: (pool: Pool) => AddIconFileToDB = pool => (addIconFileInput, modifiedBy) => {
    const selectIconVersionForUpdateSQL = "SELECT version FROM icon WHERE id = ? FOR UPDATE";
    const updateIconVersionSQL = "UPDATE icon SET version = ? WHERE id = ?";
    return tx(pool, (executeQuery: ExecuteQuery) => {
        return executeQuery(selectIconVersionForUpdateSQL, [addIconFileInput.iconId])
        .flatMap(queryResult =>
            addIconFileToTable(executeQuery, addIconFileInput, modifiedBy)
            .map(iconFileId => {
                const version = queryResult.rows[0].version;
                executeQuery(updateIconVersionSQL, [version + 1, addIconFileInput.iconId]);
                return iconFileId;
            })
        );
    });
};

export interface IIconDAFs {
    readonly addIconToDB: AddIconToDB;
    readonly getIconFileFromDB: GetIconFileFromDB;
    readonly addIconFileToDB: AddIconFileToDB;
}

const dbAccessProvider: (configProvider: ConfigurationDataProvider) => IIconDAFs
= configProvider => {
    const pool = createPoolUsing(configProvider);
    return {
        addIconToDB: addIconToDBProvider(pool),
        getIconFileFromDB: getIconFileFromDBProvider(pool),
        addIconFileToDB: addIconFileToDBProvider(pool)
    };
};

type GetAllIconsFromDB = () => Observable<List<IconInfo>>;
export const getAllIconsFromDBProvider: (pool: Pool) => GetAllIconsFromDB
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
        (iconInfoList: List<IconInfo>, row: any) => {
            const iconFile: IconFileInfo = {
                format: row.icon_file_format,
                size: row.icon_size
            };
            let lastIconInfo: IconInfo = iconInfoList.last();
            let lastIndex: number = iconInfoList.size - 1;
            if (!lastIconInfo || row.icon_id !== lastIconInfo.id) {
                lastIconInfo = new IconInfo(row.icon_id, row.icon_name, Set());
                lastIndex++;
            }
            return iconInfoList.set(lastIndex, lastIconInfo.addIconFile(iconFile));
        },
        List()
    ));
};

export default dbAccessProvider;
