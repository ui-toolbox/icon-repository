import { List, Set } from "immutable";
import { Observable, Observer } from "rxjs";
import { Pool, QueryResult } from "pg";

import {
    IconDescriptor,
    IconFile,
    IconFileDescriptor,
    IconAttributes,
    IconNotFound,
    IconFileAlreadyExists } from "../icon";
import logger from "../utils/logger";
import { createSchema, CreateSchema } from "./create-schema";

const pgErrorCodes = {
    unique_constraint_violation: "23505"
};

const ctxLogger = logger.createChild("db");

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

const createPoolUsing: (connectionProperties: ConnectionProperties) => Pool
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
= connectionProperties => Observable.of(createPoolUsing(connectionProperties));

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

type ExecuteQuery = (queryText: string, values?: any[]) => Observable<QueryResult>;

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

function tx<R>(pool: Pool, transactable: Transactable<R>) {
    return getPooledConnection(pool)
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
            .catch(rollbakcError => {
                ctxLogger.error("Error while rolling back: %o", rollbakcError);
                return Observable.throw(error);
            })
            .finally(() => conn.release())
            .map(() => { throw error; })
        )
    );
}

const handleUniqueConstraintViolation = (error: any, iconFile: IconFile) => {
    return error.code === pgErrorCodes.unique_constraint_violation
        ? Observable.throw(new IconFileAlreadyExists(iconFile))
        : Observable.throw(error);
};
type InsertIconFileIntoTable = (
    executeQuery: ExecuteQuery,
    iconFile: IconFile,
    modifiedBy: string
) => Observable<number>;

const insertIconFileIntoTable: InsertIconFileIntoTable = (executeQuery, iconFileInfo, modifiedBy) => {
    const addIconFile: string = "INSERT INTO icon_file(icon_id, file_format, icon_size, content) " +
                                "SELECT id, $2, $3, $4 FROM icon WHERE name = $1 RETURNING id";
    return executeQuery(addIconFile, [
        iconFileInfo.name,
        iconFileInfo.format,
        iconFileInfo.size,
        iconFileInfo.content
    ])
    .catch(error => handleUniqueConstraintViolation(error, iconFileInfo))
    .map(result => result.rows[0].id);
};

type AddIcon = (
    iconInfo: IconFile,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>
) => Observable<number>;

type AddIconProvider = (pool: Pool) => AddIcon;
export const createIcon: AddIconProvider = pool => (iconInfo, modifiedBy, createSideEffect) => {
    const addIconSQL: string = "INSERT INTO icon(name, modified_by) " +
                                "VALUES($1, $2) RETURNING id";
    const addIconParams = [iconInfo.name, modifiedBy];
    return tx<number>(
        pool,
        executeQuery => executeQuery(addIconSQL, addIconParams)
                .flatMap(addIconResult => {
                    const iconId = addIconResult.rows[0].id;
                    return insertIconFileIntoTable(executeQuery, {
                        name: iconInfo.name,
                        format: iconInfo.format,
                        size: iconInfo.size,
                        content: iconInfo.content
                    }, modifiedBy)
                    .flatMap(() => createSideEffect ? createSideEffect() : Observable.of(void 0))
                    .mapTo(iconId);
                })
    );
};

type UpdateIcon = (
    oldIconName: string,
    newIcon: IconAttributes,
    modifiedBy: string,
    createSideEffect?: (oldIcon: IconDescriptor) => Observable<void>
) => Observable<void>;

export const updateIcon: (pool: Pool) => UpdateIcon
= pool => (oldIconName, newIcon, modifiedBy, createSideEffect) => {
    const updateIconSQL = "UPDATE icon SET name = $1 WHERE name = $2";
    return tx(pool, (executeQuery: ExecuteQuery) =>
        describeIconBare(executeQuery, oldIconName, true)
        .flatMap(iconDesc => executeQuery(updateIconSQL, [newIcon.name, oldIconName])
            .flatMap(() => createSideEffect(iconDesc))));
};

type DeleteIconFromIconTable = (
    executeQuery: ExecuteQuery,
    iconName: string
) => Observable<void>;

const deleteIconFromIconTable: DeleteIconFromIconTable = (executeQuery, iconName) => {
    const deleteIconSQL: string = "DELETE FROM icon WHERE name = $1";
    return executeQuery(deleteIconSQL, [ iconName ])
    .mapTo(void 0);
};

type DeleteIcon = (
    iconName: string,
    modifiedBy: string,
    createSideEffect?: (iconFileDescList: Set<IconFileDescriptor>) => Observable<void>
) => Observable<void>;

export const deleteIcon: (pool: Pool) => DeleteIcon
= pool => (iconName, modifiedBy, createSideEffect) =>
    tx(pool, executeQuery =>
        describeIconBare(executeQuery, iconName, true)
        .flatMap(iconDesc => iconDesc.iconFiles.toArray())
        .flatMap(iconFileDesc =>
            deleteIconFromIconTable(executeQuery, iconName)
            .mapTo(iconFileDesc))
        .reduce((acc, iconFileDesc) => acc.add(iconFileDesc), Set())
        .flatMap((iconFileDescSet: Set<IconFileDescriptor>) =>
            createSideEffect ? createSideEffect(iconFileDescSet) : Observable.of(void 0)));

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
        .map(result => {
            if (result.rows[0]) {
                return result.rows[0].content;
            } else {
                throw new IconNotFound(iconName);
            }
        });
};

type AddIconFile = (
    iconFile: IconFile,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>) => Observable<number>;

const addIconFileToIcon: (pool: Pool) => AddIconFile
= pool => (iconFile, modifiedBy, createSideEffect) => {
    return tx(pool, (executeQuery: ExecuteQuery) => {
        return insertIconFileIntoTable(executeQuery, iconFile, modifiedBy)
        .flatMap(iconFileId =>
            (createSideEffect ? createSideEffect() : Observable.of(void 0))
            .map(() => iconFileId))
        .catch(error => handleUniqueConstraintViolation(error, iconFile));
    });
};

type DeleteIconFileBare = (
    executeQuery: ExecuteQuery,
    iconName: string,
    iconFileDesc: IconFileDescriptor,
    modifiedBy: string
) => Observable<void>;

const deleteIconFileBare: DeleteIconFileBare
= (executeQuery, iconName, iconFileDesc, modifiedBy) => {
    const getIdAndLockIcon = "SELECT id FROM icon WHERE name = $1 FOR UPDATE";
    const deleteFile = "DELETE FROM icon_file WHERE icon_id = $1 and file_format = $2 and icon_size = $3";
    const countIconFilesLeftForIcon = "SELECT count(*) as icon_file_count FROM icon_file WHERE icon_id = $1";
    const deleteIconSQL = "DELETE FROM icon WHERE id = $1";
    return executeQuery(getIdAndLockIcon, [iconName])
    .map(iconIdQueryResult => {
        if (iconIdQueryResult.rows[0]) {
            return iconIdQueryResult.rows[0].id;
        } else {
            throw new IconNotFound(iconName);
        }
    })
    .flatMap(iconId => executeQuery(deleteFile, [iconId, iconFileDesc.format, iconFileDesc.size])
        .flatMap(() => executeQuery(countIconFilesLeftForIcon, [iconId]))
        .map(countQueryResult => countQueryResult.rows[0].icon_file_count)
        .flatMap(countOfLeftIconFiles =>
            parseInt(countOfLeftIconFiles, 10) === 0
                ? executeQuery(deleteIconSQL, [iconId])
                : Observable.of(void 0)));
};

type DeleteIconFile = (
    iconName: string,
    iconFileDesc: IconFileDescriptor,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>) => Observable<void>;

const deleteIconFile: (pool: Pool) => DeleteIconFile
= pool => (iconName, iconFileDesc, modifiedBy, createSideEffect) => {
    return tx(pool, (executeQuery: ExecuteQuery) =>
            deleteIconFileBare(executeQuery, iconName, iconFileDesc, modifiedBy)
            .flatMap(() => (createSideEffect ? createSideEffect() : Observable.of(void 0))));
};

export interface IconDAFs {
    readonly createSchema: CreateSchema;
    readonly describeIcon: DescribeIcon;
    readonly createIcon: AddIcon;
    readonly updateIcon: UpdateIcon;
    readonly deleteIcon: DeleteIcon;
    readonly getIconFile: GetIconFile;
    readonly addIconFileToIcon: AddIconFile;
    readonly deleteIconFile: DeleteIconFile;
    readonly describeAllIcons: DescribeAllIcons;
}

const dbAccessProvider: (connectionProperties: ConnectionProperties) => IconDAFs
= connectionProperties => {
    const pool = createPoolUsing(connectionProperties);
    return {
        createSchema: createSchema(pool),
        describeIcon: describeIcon(pool),
        updateIcon: updateIcon(pool),
        createIcon: createIcon(pool),
        deleteIcon: deleteIcon(pool),
        getIconFile: getIconFile(pool),
        addIconFileToIcon: addIconFileToIcon(pool),
        deleteIconFile: deleteIconFile(pool),
        describeAllIcons: describeAllIcons(pool)
    };
};

type DescribeAllIcons = () => Observable<List<IconDescriptor>>;
export const describeAllIcons: (pool: Pool) => DescribeAllIcons
= pool => () => {
    const sql: string =
                "SELECT icon.name as icon_name, " +
                    "icon.id as icon_id, " +
                    "icon.modified_by as modified_by, " +
                    "icon_file.file_format as icon_file_format, " +
                    "icon_file.icon_size as icon_size " +
                "FROM icon, icon_file " +
                    "WHERE icon.id = icon_file.icon_id " +
                    "ORDER BY icon_name, icon_file_format, icon_size";
    return query(pool, sql, [])
    .map(result => result.rows.reduce(
        (iconInfoList: List<IconDescriptor>, row: any) => {
            const iconFile: IconFileDescriptor = {
                format: row.icon_file_format,
                size: row.icon_size
            };
            let lastIconInfo: IconDescriptor = iconInfoList.last();
            let lastIndex: number = iconInfoList.size - 1;
            if (!lastIconInfo || row.icon_name !== lastIconInfo.name) {
                lastIconInfo = new IconDescriptor(row.icon_name, row.modified_by, Set());
                lastIndex++;
            }
            return iconInfoList.set(lastIndex, lastIconInfo.addIconFile(iconFile));
        },
        List()
    ));
};

type DescribeIconBare = (executeQuery: ExecuteQuery, iconName: string, forUpdate?: boolean)
=> Observable<IconDescriptor>;
const describeIconBare: DescribeIconBare = (executeQuery, iconName, forUpdate = false) => {
    const sql: string =
                "SELECT icon.name as icon_name, " +
                    "icon.id as icon_id, " +
                    "icon.modified_by as modified_by, " +
                    "icon_file.file_format as icon_file_format, " +
                    "icon_file.icon_size as icon_size " +
                "FROM icon, icon_file " +
                    "WHERE icon.id = icon_file.icon_id AND " +
                        "icon.name = $1 " +
                    "ORDER BY icon_id, icon_file_format, icon_size" +
                (forUpdate ? " FOR UPDATE" : "");
    return executeQuery(sql, [iconName])
    .map(result => result.rows.reduce(
        (iconInfoList: List<IconDescriptor>, row: any) => {
            const iconFile: IconFileDescriptor = {
                format: row.icon_file_format,
                size: row.icon_size
            };
            let lastIconInfo: IconDescriptor = iconInfoList.last();
            let lastIndex: number = iconInfoList.size - 1;
            if (!lastIconInfo || row.icon_name !== lastIconInfo.name) {
                lastIconInfo = new IconDescriptor(row.icon_name, row.modified_by, Set());
                lastIndex++;
            }
            return iconInfoList.set(lastIndex, lastIconInfo.addIconFile(iconFile));
        },
        List()
    ))
    .map(list => list.get(0));
};

type DescribeIcon = (iconName: string) => Observable<IconDescriptor>;
export const describeIcon: (pool: Pool) => DescribeIcon
= pool => iconName => tx(pool, executeQuery => describeIconBare(executeQuery, iconName));

export default dbAccessProvider;
