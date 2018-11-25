import { Pool } from "pg";
import { Observable, of } from "rxjs";
import { flatMap, mapTo } from "rxjs/operators";
import { Set } from "immutable";
import { query, ExecuteQuery, tx } from "./db";
import { map } from "rxjs/operators";
import { MultiValuedPropertyElementRowProcessor, MultiValuedPropertyElementCollector } from "./entity-management";

type CreateTag = (executeQuery: ExecuteQuery, tag: string) => Observable<number>;
const createTag: CreateTag = (executeQuery, tag) => {
    const insertTagSQL = "INSERT INTO tag(text) VALUES($1) RETURNING id";
    return executeQuery(insertTagSQL, [tag])
    .pipe(
        map(result => result.rows[0].id)
    );
};

type GetTagId = (executeQuery: ExecuteQuery, tag: string) => Observable<number>;
const getTagId: GetTagId = (executeQuery, tag) => {
    const getIdSQL = "SELECT id FROM tag WHERE text = $1";
    return executeQuery(getIdSQL, [tag])
    .pipe(
        flatMap(result => result.rows.length === 1
            ? of(result.rows[0].id)
            : createTag(executeQuery, tag))
    );
};

type AddTagReferenceToIcon = (executeQuery: ExecuteQuery, tagId: number, iconName: string) => Observable<void>;
const addTagReferenceToIcon: AddTagReferenceToIcon = (executeQuery, tagId, iconName) => {
    const addRefSQL = "INSERT INTO icon_to_tags(icon_id, tag_id) SELECT id, $1 FROM icon WHERE name = $2";
    return executeQuery(addRefSQL, [tagId, iconName]).pipe(mapTo(void 0));
};

export type AddTag = (iconName: string, tag: string) => Observable<void>;
export const addTag: (pool: Pool) => AddTag = pool =>
(iconName, tag) => tx<void>(
    pool,
    executeQuery =>
        getTagId(executeQuery, tag)
        .pipe(
            flatMap(tagId => addTagReferenceToIcon(executeQuery, tagId, iconName))
        )
);

type RemoveTagReferenceFromIcon = (executeQuery: ExecuteQuery, tag: string, iconName: string) => Observable<number>;
const removeTagReferenceFromIcon: RemoveTagReferenceFromIcon = (executeQuery, tag, iconName) => {
    const deleteTagRefSQL = "DELETE FROM icon_to_tags " +
                                "WHERE icon_id = (SELECT id FROM icon WHERE name = $1) " +
                                    "AND tag_id = (SELECT id FROM tag WHERE text = $2)";
    const tagRefCountSQL = "SELECT count(*) ref_count FROM icon_to_tags " +
                                "WHERE tag_id = (SELECT id FROM tag WHERE text = $1)";
    const deleteTagSQL = "DELETE FROM tag WHERE text = $1";

    return executeQuery(deleteTagRefSQL, [iconName, tag])
    .pipe(
        flatMap(() => executeQuery(tagRefCountSQL, [tag])),
        flatMap(refCountResult => {
            const tagRefCount = parseInt(refCountResult.rows[0].ref_count, 10);
            if (tagRefCount === 0) {
                return executeQuery(deleteTagSQL, [tag])
                .pipe(
                    mapTo(tagRefCount)
                );
            } else {
                return of(tagRefCount);
            }
        })
    );
};

export type RemoveTag = (pool: Pool) => (iconName: string, tag: string) => Observable<number>;
export const removeTag: RemoveTag = pool =>
(iconName, tag) => tx<number>(
    pool,
    executeQuery =>
    removeTagReferenceFromIcon(executeQuery, tag, iconName)
);

export type GetExistingTags = (pool: Pool) => () => Observable<Set<string>>;
export const getExistingTags: GetExistingTags = pool => () =>
    query(pool, "SELECT text FROM tag", [])
    .pipe(
        map(result => Set(result.rows.map(row => row.text)))
    );

const tagsRowProcessor: MultiValuedPropertyElementRowProcessor<string>
    = propElementRow => ({
        entityId: propElementRow.icon_id,
        propertyElement: propElementRow.text
    });

export const fetchTags: (sqlParams: any[]) => MultiValuedPropertyElementCollector<string>
    = sqlParams => ({
        sql: "SELECT icon_id, text FROM tag, icon_to_tags WHERE icon_to_tags.tag_id = tag.id",
        sqlParams,
        rowProcessor: tagsRowProcessor
    });
