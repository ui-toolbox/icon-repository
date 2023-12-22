import { pgErrorCodes, query, type ExecuteQuery, tx, type ConnectionProperties, createPoolUsing } from "./db";
import { type Pool } from "pg";
import {
	IconNotFound,
	type Iconfile,
	type IconfileDescriptor,
	IconfileAlreadyExists,
	type IconAttributes,
	IconDescriptor
} from "../icon";
import createSchema, { type CreateSchema } from "./create-schema";
import {
	type MultiValuedPropertyElementRowProcessor,
	type MultiValuedPropertyElementCollector,
	collectMultiValuedProperty
} from "./entity-management";
import { tagCollector, type AddTag, addTag, type GetTags, getTags, type RemoveTag, removeTag } from "./tag";
import { type ExecuteDataUpgrade, executeDataUpgrade } from "./data-upgrade";
import { isNil } from "lodash";
import { type IconTableRow } from "./db-schema";

const handleUniqueConstraintViolation = (error: any, iconfile: Iconfile): void => {
	const toThrow = error.code === pgErrorCodes.unique_constraint_violation
		? new IconfileAlreadyExists(iconfile)
		: error;
	throw toThrow;
};

type InsertIconfileIntoTable = (
	executeQuery: ExecuteQuery,
	iconfile: Iconfile,
	modifiedBy: string
) => Promise<number>;

const insertIconfileIntoTable: InsertIconfileIntoTable = async (executeQuery, iconfileInfo) => {
	const addIconfile: string = "INSERT INTO icon_file(icon_id, file_format, icon_size, content) " +
                                "SELECT id, $2, $3, $4 FROM icon WHERE name = $1 RETURNING id";
	try {
		const result = await executeQuery(addIconfile, [
			iconfileInfo.name,
			iconfileInfo.format,
			iconfileInfo.size,
			iconfileInfo.content
		]);
		return result.rows[0].id;
	} catch (error) {
		handleUniqueConstraintViolation(error, iconfileInfo);
	}
};

type CreateIcon = (
	iconfile: Iconfile,
	modifiedBy: string,
	createSideEffect?: () => Promise<void>
) => Promise<number>;

type CreateIconProvider = (pool: Pool) => CreateIcon;
export const createIcon: CreateIconProvider = pool => async (iconfile, modifiedBy, createSideEffect) => {
	const insertIconSQL: string = "INSERT INTO icon(name, modified_by) " +
                                "VALUES($1, $2) RETURNING id";
	const insertIconParams = [iconfile.name, modifiedBy];
	return await tx<number>(
		pool,
		async executeQuery => {
			const insertIconResult = await executeQuery(insertIconSQL, insertIconParams);
			const iconId = insertIconResult.rows[0].id;
			await insertIconfileIntoTable(executeQuery, {
				name: iconfile.name,
				format: iconfile.format,
				size: iconfile.size,
				content: iconfile.content
			}, modifiedBy);
			if (!isNil(createSideEffect)) {
				await createSideEffect();
			}
			return iconId;
		}
	);
};

type UpdateIcon = (
	oldIconName: string,
	newIcon: IconAttributes,
	modifiedBy: string,
	createSideEffect?: (oldIcon: IconDescriptor) => Promise<void>
) => Promise<void>;

export const updateIcon = (pool: Pool): UpdateIcon =>
	async (oldIconName, newIcon, modifiedBy, createSideEffect) => {
		const updateIconSQL = "UPDATE icon SET name = $1 WHERE name = $2";
		await tx(
			pool,
			async executeQuery => {
				const iconDesc = await describeIconBare(executeQuery, oldIconName, true);
				await executeQuery(updateIconSQL, [newIcon.name, oldIconName]);
				if (!isNil(createSideEffect)) {
					await createSideEffect(iconDesc);
				}
			}
		);
	};

type DeleteIcon = (
	iconName: string,
	modifiedBy: string,
	createSideEffect?: (iconfileDescList: IconfileDescriptor[]) => Promise<void>
) => Promise<void>;

export const deleteIcon = (pool: Pool): DeleteIcon =>
	async (iconName, modifiedBy, createSideEffect) => {
		await tx(
			pool,
			async executeQuery => {
				const iconDesc = await describeIconBare(executeQuery, iconName, true);
				for (const iconfileDesc of iconDesc.iconfiles) {
					await deleteIconfileBare(executeQuery, iconName, iconfileDesc, modifiedBy);
				}
				if (!isNil(createSideEffect)) {
					await createSideEffect(iconDesc.iconfiles);
				}
			}
		);
	};

export type GetIconfile = (
	iconName: string,
	format: string,
	iconSize: string) => Promise<Buffer>;
export const getIconfile = (pool: Pool): GetIconfile => async (iconName, format, iconSize) => {
	const getIconfileSQL = "SELECT content FROM icon, icon_file " +
                            "WHERE icon_id = icon.id AND " +
                                "file_format = $2 AND " +
                                "icon_size = $3 AND " +
                                "icon.name = $1";
	const result = await query(pool, getIconfileSQL, [iconName, format, iconSize]);
	if (!isNil(result.rows[0])) {
		return result.rows[0].content;
	} else {
		throw new IconNotFound(iconName);
	}
};

type AddIconfile = (
	iconfile: Iconfile,
	modifiedBy: string,
	createSideEffect?: () => Promise<void>) => Promise<number>;

export const addIconfileToIcon = (pool: Pool): AddIconfile =>
	async (iconfile, modifiedBy, createSideEffect) => {
		return await tx(pool, async executeQuery => {
			const iconfileId = await insertIconfileIntoTable(executeQuery, iconfile, modifiedBy);
			if (!isNil(createSideEffect)) {
				await createSideEffect();
			}
			return iconfileId;
		});
	};

type DeleteIconfileBare = (
	executeQuery: ExecuteQuery,
	iconName: string,
	iconfileDesc: IconfileDescriptor,
	modifiedBy: string
) => Promise<void>;

const deleteIconfileBare: DeleteIconfileBare = async (executeQuery, iconName, iconfileDesc, modifiedBy) => {
	const getIdAndLockIcon = "SELECT id FROM icon WHERE name = $1 FOR UPDATE";
	const deleteFile = "DELETE FROM icon_file WHERE icon_id = $1 and file_format = $2 and icon_size = $3";
	const countIconfilesLeftForIcon = "SELECT count(*) as icon_file_count FROM icon_file WHERE icon_id = $1";
	const deleteIconSQL = "DELETE FROM icon WHERE id = $1";

	const iconIdQueryResult = await executeQuery(getIdAndLockIcon, [iconName]);
	let iconId: string;
	if (!isNil(iconIdQueryResult.rows[0])) {
		iconId = iconIdQueryResult.rows[0].id;
	} else {
		throw new IconNotFound(iconName);
	}
	await executeQuery(deleteFile, [iconId, iconfileDesc.format, iconfileDesc.size]);
	const countQueryResult = await executeQuery(countIconfilesLeftForIcon, [iconId]);
	const countOfLeftIconfiles = countQueryResult.rows[0].icon_file_count;
	if (parseInt(countOfLeftIconfiles as string, 10) === 0) {
		await executeQuery(deleteIconSQL, [iconId]);
	}
};

type DeleteIconfile = (
	iconName: string,
	iconfileDesc: IconfileDescriptor,
	modifiedBy: string,
	createSideEffect?: () => Promise<void>
) => Promise<void>;

export const deleteIconfile = (pool: Pool): DeleteIconfile =>
	async (iconName, iconfileDesc, modifiedBy, createSideEffect) => {
		await tx(pool, async executeQuery => {
			await deleteIconfileBare(executeQuery, iconName, iconfileDesc, modifiedBy);
			if (!isNil(createSideEffect)) {
				await createSideEffect();
			}
		});
	};

export interface IconRepository {
	readonly createSchema: CreateSchema
	readonly upgradeData: ExecuteDataUpgrade
	readonly describeIcon: DescribeIcon
	readonly createIcon: CreateIcon
	readonly updateIcon: UpdateIcon
	readonly deleteIcon: DeleteIcon
	readonly getIconfile: GetIconfile
	readonly addIconfileToIcon: AddIconfile
	readonly deleteIconfile: DeleteIconfile
	readonly describeAllIcons: DescribeAllIcons
	readonly getTags: GetTags
	readonly addTag: AddTag
	readonly removeTag: RemoveTag
	readonly release: () => Promise<void>
}

let localPoolRef: Pool | undefined;

const iconRepositoryProvider = (connectionProperties: ConnectionProperties): IconRepository => {
	const pool = createPoolUsing(connectionProperties);
	localPoolRef = pool;
	return {
		createSchema: createSchema(pool),
		upgradeData: executeDataUpgrade(pool),
		describeIcon: describeIcon(pool),
		updateIcon: updateIcon(pool),
		createIcon: createIcon(pool),
		deleteIcon: deleteIcon(pool),
		getIconfile: getIconfile(pool),
		addIconfileToIcon: addIconfileToIcon(pool),
		deleteIconfile: deleteIconfile(pool),
		describeAllIcons: describeAllIcons(pool),
		getTags: getTags(pool),
		addTag: addTag(pool),
		removeTag: removeTag(pool),
		release: async () => {
			if (!isNil(localPoolRef)) {
				await localPoolRef.end();
				localPoolRef = undefined;
			}
		}
	};
};

const iconfileDescriptorRowProcessor: MultiValuedPropertyElementRowProcessor<IconfileDescriptor> =
propElementRow => ({
	entityId: propElementRow.icon_id,
	propertyElement: {
		format: propElementRow.file_format,
		size: propElementRow.icon_size
	}
});

const iconfileDescriptorCollector = (sqlParams: any[]): MultiValuedPropertyElementCollector<IconfileDescriptor> =>
	({
		sql: "SELECT icon_id, file_format, icon_size FROM icon_file ORDER BY icon_id, file_format, icon_size",
		sqlParams,
		rowProcessor: iconfileDescriptorRowProcessor
	});

type DescribeAllIcons = () => Promise<IconDescriptor[]>;
export const describeAllIcons = (pool: Pool): DescribeAllIcons =>
	async () => {
		const iconsSQL = "SELECT id, name, modified_by FROM icon";
		const iconsResult = await query(pool, iconsSQL, []);
		const fileAndTagMapArrayPromise = Promise.all([
			collectMultiValuedProperty(pool, iconfileDescriptorCollector([])),
			collectMultiValuedProperty(pool, tagCollector([]))
		]);
		const fileAndTagMapArray = await fileAndTagMapArrayPromise;
		return iconsResult.rows.reduce<IconDescriptor[]>(
			(iconDescList, currenIconRow: IconTableRow) => {
				iconDescList.push(new IconDescriptor(
					currenIconRow.name,
					currenIconRow.modified_by,
					fileAndTagMapArray[0].get(currenIconRow.id) ?? [],
					fileAndTagMapArray[1].get(currenIconRow.id) ?? []
				));
				return iconDescList;
			},
			[]
		);
	};

type DescribeIconBare = (executeQuery: ExecuteQuery, iconName: string, forUpdate?: boolean) => Promise<IconDescriptor>;
const describeIconBare: DescribeIconBare = async (executeQuery, iconName, forUpdate = false) => {
	const iconSQL = "SELECT id, modified_by FROM icon WHERE name = $1" + (forUpdate ? " FOR UPDATE" : "");
	const iconfilesSQL = "SELECT file_format, icon_size FROM icon_file " +
                            "WHERE icon_id = $1 " +
                            "ORDER BY file_format, icon_size" +
                        (forUpdate ? " FOR UPDATE" : "");
	const tagsSQL = "SELECT text FROM tag, icon_to_tags " +
                        "WHERE icon_to_tags.icon_id = $1 " +
                            "AND icon_to_tags.tag_id = tag.id" +
                    (forUpdate ? " FOR UPDATE" : "");
	const result = await executeQuery(iconSQL, [iconName]);
	if (result.rowCount === 0) {
		throw new IconNotFound(iconName);
	}

	const iconId = result.rows[0].id;
	const modifiedBy = result.rows[0].modified_by;
	const initialIconInfo = new IconDescriptor(iconName, modifiedBy as string, [], []);

	const iconfileResult = await executeQuery(iconfilesSQL, [iconId]);
	const iconInfo = iconfileResult.rows.reduce<IconDescriptor>(
		(icon: IconDescriptor, row: any) => icon.addIconfile({
			format: row.file_format,
			size: row.icon_size
		}),
		initialIconInfo
	);
	const tagResult = await executeQuery(tagsSQL, [iconId]);
	const describedIcon = tagResult.rows.reduce<IconDescriptor>(
		(icon, row) => icon.addTag(row.text as string),
		iconInfo
	);
	return describedIcon;
};

type DescribeIcon = (iconName: string) => Promise<IconDescriptor>;
export const describeIcon = (pool: Pool): DescribeIcon =>
	async iconName => await tx(pool, async executeQuery => await describeIconBare(executeQuery, iconName));

export default iconRepositoryProvider;
