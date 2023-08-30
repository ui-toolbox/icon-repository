import { type Pool } from "pg";
import { query, type ExecuteQuery, tx } from "./db";
import { type MultiValuedPropertyElementRowProcessor, type MultiValuedPropertyElementCollector } from "./entity-management";

type CreateTag = (executeQuery: ExecuteQuery, tag: string) => Promise<number>;
const createTag: CreateTag = async (executeQuery, tag) => {
	const insertTagSQL = "INSERT INTO tag(text) VALUES($1) RETURNING id";
	const result = await executeQuery(insertTagSQL, [tag]);
	return result.rows[0].id;
};

type GetTagId = (executeQuery: ExecuteQuery, tag: string) => Promise<number>;
const getTagId: GetTagId = async (executeQuery, tag) => {
	const getIdSQL = "SELECT id FROM tag WHERE text = $1";
	const result = await executeQuery(getIdSQL, [tag]);
	return result.rows.length === 1
		? result.rows[0].id
		: await createTag(executeQuery, tag);
};

type AddTagReferenceToIcon = (executeQuery: ExecuteQuery, tagId: number, iconName: string) => Promise<void>;
const addTagReferenceToIcon: AddTagReferenceToIcon = async (executeQuery, tagId, iconName) => {
	const addRefSQL = "INSERT INTO icon_to_tags(icon_id, tag_id) SELECT id, $1 FROM icon WHERE name = $2";
	await executeQuery(addRefSQL, [tagId, iconName]);
};

export type GetTags = () => Promise<string[]>;
export const getTags = (pool: Pool): GetTags => async () => {
	const tagsResult = await query(pool, "SELECT text FROM tag", []);
	return tagsResult.rows.reduce<string[]>(
		(tags, tagResultRow) => tags.concat(tagResultRow.text),
		[]
	);
};

export type AddTag = (iconName: string, tag: string) => Promise<void>;
export const addTag = (pool: Pool): AddTag => {
	return async (iconName, tag) => {
		await tx(
			pool,
			async executeQuery => {
				const tagId = await getTagId(executeQuery, tag);
				await addTagReferenceToIcon(executeQuery, tagId, iconName);
			}
		);
	};
};

type RemoveTagReferenceFromIcon = (executeQuery: ExecuteQuery, tag: string, iconName: string) => Promise<number>;
const removeTagReferenceFromIcon: RemoveTagReferenceFromIcon = async (executeQuery, tag, iconName) => {
	const deleteTagRefSQL = "DELETE FROM icon_to_tags " +
                                "WHERE icon_id = (SELECT id FROM icon WHERE name = $1) " +
                                    "AND tag_id = (SELECT id FROM tag WHERE text = $2)";
	const tagRefCountSQL = "SELECT count(*) ref_count FROM icon_to_tags " +
                                "WHERE tag_id = (SELECT id FROM tag WHERE text = $1)";
	const deleteTagSQL = "DELETE FROM tag WHERE text = $1";

	await executeQuery(deleteTagRefSQL, [iconName, tag]);
	const refCountResult = await executeQuery(tagRefCountSQL, [tag]);
	const tagRefCount = parseInt(refCountResult.rows[0].ref_count, 10);
	if (tagRefCount === 0) {
		await executeQuery(deleteTagSQL, [tag]);
	}
	return tagRefCount;
};

export type RemoveTag = (iconName: string, tag: string) => Promise<number>;
export const removeTag = (pool: Pool): RemoveTag =>
	async (iconName, tag) => await tx<number>(
		pool,
		async executeQuery =>
			await removeTagReferenceFromIcon(executeQuery, tag, iconName)
	);

export type GetExistingTags = (pool: Pool) => () => Promise<string[]>;
export const getExistingTags: GetExistingTags = pool => async () => {
	const result = await query(pool, "SELECT text FROM tag", []);
	return result.rows.map(row => row.text);
};

const tagsRowProcessor: MultiValuedPropertyElementRowProcessor<string> =
	propElementRow => ({
		entityId: propElementRow.icon_id,
		propertyElement: propElementRow.text
	});

export const tagCollector = (sqlParams: any[]): MultiValuedPropertyElementCollector<string> =>
	({
		sql: "SELECT icon_id, text FROM tag, icon_to_tags WHERE icon_to_tags.tag_id = tag.id",
		sqlParams,
		rowProcessor: tagsRowProcessor
	});
