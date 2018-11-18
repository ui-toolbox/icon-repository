import { Observable, throwError, of, forkJoin } from "rxjs";
import { catchError, map, flatMap, mapTo, reduce } from "rxjs/operators";
import { pgErrorCodes, query, ExecuteQuery, tx, ConnectionProperties, createPoolUsing } from "./db";
import { Pool } from "pg";
import {
    IconNotFound,
    Iconfile,
    IconfileDescriptor,
    IconfileAlreadyExists,
    IconAttributes,
    IconDescriptor } from "../icon";
import { Set, List } from "immutable";
import createSchema, { CreateSchema } from "./create-schema";
import {
    MultiValuedPropertyElementRowProcessor,
    MultiValuedPropertyElementCollector,
    collectMultiValuedProperty } from "./entity-management";
import { fetchTags } from "./tag";

const handleUniqueConstraintViolation = (error: any, iconfile: Iconfile) => {
    return error.code === pgErrorCodes.unique_constraint_violation
        ? throwError(new IconfileAlreadyExists(iconfile))
        : throwError(error);
};
type InsertIconfileIntoTable = (
    executeQuery: ExecuteQuery,
    iconfile: Iconfile,
    modifiedBy: string
) => Observable<number>;

const insertIconfileIntoTable: InsertIconfileIntoTable = (executeQuery, iconfileInfo, modifiedBy) => {
    const addIconfile: string = "INSERT INTO icon_file(icon_id, file_format, icon_size, content) " +
                                "SELECT id, $2, $3, $4 FROM icon WHERE name = $1 RETURNING id";
    return executeQuery(addIconfile, [
        iconfileInfo.name,
        iconfileInfo.format,
        iconfileInfo.size,
        iconfileInfo.content
    ])
    .pipe(
        catchError(error => handleUniqueConstraintViolation(error, iconfileInfo)),
        map(result => result.rows[0].id)
    );
};

type CreateIcon = (
    iconfile: Iconfile,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>
) => Observable<number>;

type CreateIconProvider = (pool: Pool) => CreateIcon;
export const createIcon: CreateIconProvider = pool => (iconfile, modifiedBy, createSideEffect) => {
    const insertIconSQL: string = "INSERT INTO icon(name, modified_by) " +
                                "VALUES($1, $2) RETURNING id";
    const insertIconParams = [iconfile.name, modifiedBy];
    return tx<number>(
        pool,
        executeQuery => executeQuery(insertIconSQL, insertIconParams)
                .pipe(
                    flatMap(insertIconResult => {
                        const iconId = insertIconResult.rows[0].id;
                        return insertIconfileIntoTable(executeQuery, {
                            name: iconfile.name,
                            format: iconfile.format,
                            size: iconfile.size,
                            content: iconfile.content
                        }, modifiedBy)
                        .pipe(
                            flatMap(() => createSideEffect ? createSideEffect() : of(void 0)),
                            mapTo(iconId)
                        );
                    })
                )
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
        .pipe(
            flatMap(iconDesc => executeQuery(updateIconSQL, [newIcon.name, oldIconName])
                .pipe(flatMap(() => createSideEffect(iconDesc))))
        ));
};

type DeleteIcon = (
    iconName: string,
    modifiedBy: string,
    createSideEffect?: (iconfileDescList: Set<IconfileDescriptor>) => Observable<void>
) => Observable<void>;

export const deleteIcon: (pool: Pool) => DeleteIcon
= pool => (iconName, modifiedBy, createSideEffect) =>
    tx(pool, executeQuery =>
        describeIconBare(executeQuery, iconName, true)
        .pipe(
            flatMap(iconDesc => iconDesc.iconfiles.toArray()),
            flatMap(iconfileDesc =>
                deleteIconfileBare(executeQuery, iconName, iconfileDesc, modifiedBy)
                .pipe(mapTo(iconfileDesc))),
            reduce<IconfileDescriptor, Set<IconfileDescriptor>>((acc, iconfileDesc) => acc.add(iconfileDesc), Set()),
            flatMap((iconfileDescSet: Set<IconfileDescriptor>) =>
                createSideEffect ? createSideEffect(iconfileDescSet) : of(void 0))
        ));

export type GetIconfile = (
    iconName: string,
    format: string,
    iconSize: string) => Observable<Buffer>;
export const getIconfile: (pool: Pool) => GetIconfile = pool => (iconName, format, iconSize) => {
    const getIconfileSQL = "SELECT content FROM icon, icon_file " +
                            "WHERE icon_id = icon.id AND " +
                                "file_format = $2 AND " +
                                "icon_size = $3 AND " +
                                "icon.name = $1";
    return query(pool, getIconfileSQL, [iconName, format, iconSize])
        .pipe(
            map(result => {
                if (result.rows[0]) {
                    return result.rows[0].content;
                } else {
                    throw new IconNotFound(iconName);
                }
            })
        );
};

type AddIconfile = (
    iconfile: Iconfile,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>) => Observable<number>;

export const addIconfileToIcon: (pool: Pool) => AddIconfile
= pool => (iconfile, modifiedBy, createSideEffect) => {
    return tx(pool, (executeQuery: ExecuteQuery) => {
        return insertIconfileIntoTable(executeQuery, iconfile, modifiedBy)
        .pipe(
            flatMap(iconfileId =>
                (createSideEffect ? createSideEffect() : of(void 0))
                .pipe(map(() => iconfileId)))
        );
    });
};

type DeleteIconfileBare = (
    executeQuery: ExecuteQuery,
    iconName: string,
    iconfileDesc: IconfileDescriptor,
    modifiedBy: string
) => Observable<void>;

const deleteIconfileBare: DeleteIconfileBare
= (executeQuery, iconName, iconfileDesc, modifiedBy) => {
    const getIdAndLockIcon = "SELECT id FROM icon WHERE name = $1 FOR UPDATE";
    const deleteFile = "DELETE FROM icon_file WHERE icon_id = $1 and file_format = $2 and icon_size = $3";
    const countIconfilesLeftForIcon = "SELECT count(*) as icon_file_count FROM icon_file WHERE icon_id = $1";
    const deleteIconSQL = "DELETE FROM icon WHERE id = $1";
    return executeQuery(getIdAndLockIcon, [iconName])
    .pipe(
        map(iconIdQueryResult => {
            if (iconIdQueryResult.rows[0]) {
                return iconIdQueryResult.rows[0].id;
            } else {
                throw new IconNotFound(iconName);
            }
        }),
        flatMap(iconId => executeQuery(deleteFile, [iconId, iconfileDesc.format, iconfileDesc.size])
            .pipe(
                flatMap(() => executeQuery(countIconfilesLeftForIcon, [iconId])),
                map(countQueryResult => countQueryResult.rows[0].icon_file_count),
                flatMap(countOfLeftIconfiles =>
                    parseInt(countOfLeftIconfiles, 10) === 0
                        ? executeQuery(deleteIconSQL, [iconId])
                        : of(void 0))
            ))
    );
};

type DeleteIconfile = (
    iconName: string,
    iconfileDesc: IconfileDescriptor,
    modifiedBy: string,
    createSideEffect?: () => Observable<void>) => Observable<void>;

export const deleteIconfile: (pool: Pool) => DeleteIconfile
= pool => (iconName, iconfileDesc, modifiedBy, createSideEffect) => {
    return tx(pool, (executeQuery: ExecuteQuery) =>
            deleteIconfileBare(executeQuery, iconName, iconfileDesc, modifiedBy)
            .pipe(flatMap(() => (createSideEffect ? createSideEffect() : of(void 0)))));
};

export interface IconRepository {
    readonly createSchema: CreateSchema;
    readonly describeIcon: DescribeIcon;
    readonly createIcon: CreateIcon;
    readonly updateIcon: UpdateIcon;
    readonly deleteIcon: DeleteIcon;
    readonly getIconfile: GetIconfile;
    readonly addIconfileToIcon: AddIconfile;
    readonly deleteIconfile: DeleteIconfile;
    readonly describeAllIcons: DescribeAllIcons;
    readonly release: () => void;
}

const iconRepositoryProvider: (connectionProperties: ConnectionProperties) => IconRepository
= connectionProperties => {
    const pool = createPoolUsing(connectionProperties);
    return {
        createSchema: createSchema(pool),
        describeIcon: describeIcon(pool),
        updateIcon: updateIcon(pool),
        createIcon: createIcon(pool),
        deleteIcon: deleteIcon(pool),
        getIconfile: getIconfile(pool),
        addIconfileToIcon: addIconfileToIcon(pool),
        deleteIconfile: deleteIconfile(pool),
        describeAllIcons: describeAllIcons(pool),
        release: () => pool.end()
    };
};

const iconfileDescriptorRowProcessor: MultiValuedPropertyElementRowProcessor<IconfileDescriptor>
= propElementRow => ({
    entityId: propElementRow.icon_id,
    propertyElement: {
        format: propElementRow.file_format,
        size: propElementRow.icon_size
    }
});

const iconfileDescriptors: (sqlParams: any[]) => MultiValuedPropertyElementCollector<IconfileDescriptor>
= sqlParams => ({
    sql: "SELECT icon_id, file_format, icon_size FROM icon_file ORDER BY icon_id, file_format, icon_size",
    sqlParams,
    rowProcessor: iconfileDescriptorRowProcessor
});

type DescribeAllIcons = () => Observable<List<IconDescriptor>>;
export const describeAllIcons: (pool: Pool) => DescribeAllIcons
= pool => () => {
    const iconsSQL = "SELECT id, name, modified_by FROM icon";
    return query(pool, iconsSQL, [])
    .pipe(
        flatMap(iconsResult => {
            return forkJoin([
                collectMultiValuedProperty(pool, iconfileDescriptors([])),
                collectMultiValuedProperty(pool, fetchTags([]))
            ])
            .pipe(
                map(fileAndTagMapArray => {
                    return List(iconsResult.rows)
                    .reduce(
                        (iconDescList, currenIconRow) => iconDescList.push(new IconDescriptor(
                            currenIconRow.name,
                            currenIconRow.modified_by,
                            Set(fileAndTagMapArray[0].get(currenIconRow.id)),
                            Set(fileAndTagMapArray[1].get(currenIconRow.id))
                        )),
                        List()
                    );
                })
            );
        })
    );
};

type DescribeIconBare = (executeQuery: ExecuteQuery, iconName: string, forUpdate?: boolean)
=> Observable<IconDescriptor>;
const describeIconBare: DescribeIconBare = (executeQuery, iconName, forUpdate = false) => {
    const iconSQL = "SELECT id, modified_by FROM icon WHERE name = $1" + (forUpdate ? " FOR UPDATE" : "");
    const iconfilesSQL = "SELECT file_format, icon_size FROM icon_file " +
                            "WHERE icon_id = $1 " +
                            "ORDER BY file_format, icon_size" +
                        (forUpdate ? " FOR UPDATE" : "");
    const tagsSQL = "SELECT text FROM tag, icon_to_tags " +
                        "WHERE icon_to_tags.icon_id = $1 " +
                            "AND icon_to_tags.tag_id = tag.id" +
                    (forUpdate ? " FOR UPDATE" : "");
    return executeQuery(iconSQL, [iconName])
    .pipe(
        flatMap(result => {
            if (result.rowCount === 0) {
                throw new IconNotFound(iconName);
            }

            const iconId = result.rows[0].id;
            const modifiedBy = result.rows[0].modified_by;
            const initialIconInfo = new IconDescriptor(iconName, modifiedBy, Set(), Set());

            return executeQuery(iconfilesSQL, [iconId])
            .pipe(
                map(iconfileResult => iconfileResult.rows.reduce(
                        (icon: IconDescriptor, row: any) => icon.addIconfile({
                            format: row.file_format,
                            size: row.icon_size
                        }),
                        initialIconInfo
                    )),
                flatMap(iconInfo => executeQuery(tagsSQL, [iconId])
                    .pipe(
                        map(tagResult => tagResult.rows.reduce(
                            (icon: IconDescriptor, row: any) => icon.addTag(row.text),
                            iconInfo
                        ))
                    ))
            );
        })
    );
};

type DescribeIcon = (iconName: string) => Observable<IconDescriptor>;
export const describeIcon: (pool: Pool) => DescribeIcon
= pool => iconName => tx(pool, executeQuery => describeIconBare(executeQuery, iconName));

export default iconRepositoryProvider;
