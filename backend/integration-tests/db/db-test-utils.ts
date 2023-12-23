import { randomBytes } from "crypto";
import {
	createPool,
	query,
	createConnectionProperties,
	getPooledConnection,
	type ExecuteQuery
} from "../../src/db/db";
import { type Pool } from "pg";
import { iconTableSpec } from "../../src/db/db-schema";
import { type Iconfile, type IconDescriptor } from "../../src/icon";
import { type ConfigurationData, getDefaultConfiguration } from "../../src/configuration";
import { type GetIconfile } from "../../src/db/icon";
import { executeDataUpgrade } from "../../src/db/data-upgrade";
import _, { isNil } from "lodash";
import { createLogger } from "../../src/utils/logger";

export const testDatabase: string = "iconrepo_test";

const logger = createLogger("db-test-utils");

export const assertIconCount = async (connPool: Pool, expectedCount: number): Promise<void> => {
	const countResult = await query(connPool, `SELECT count(*) from ${iconTableSpec.tableName}`, []);
	expect(parseInt(countResult.rows[0].count as string, 10)).toEqual(expectedCount);
};

export const getCheckIconfile = async (
	getIconfileFromDB: GetIconfile,
	iconfileInfo: Iconfile
): Promise<boolean> => {
	const content1 = await getIconfileFromDB(iconfileInfo.name, iconfileInfo.format, iconfileInfo.size);
	const diff = Buffer.compare(content1, iconfileInfo.content);
	expect(diff).toEqual(0);
	return diff === 0;
};

export const createTestConfiguration = (): ConfigurationData => {
	return {
		...getDefaultConfiguration(),
		conn_database: testDatabase
	};
};

export const createTestPool = async (setPool: (p: Pool) => void): Promise<void> => {
	const pool = await createPool(createConnectionProperties(createTestConfiguration()));
	setPool(pool);
};

let pool: Pool | undefined;

export const terminateTestPool = async (): Promise<void> => {
	if (!isNil(pool)) {
		await pool.end();
		pool = undefined;
	}
};

export const deleteData = (executeQuery: ExecuteQuery): () => Promise<void> => {
	return async () => {
		for (const tableName of ["icon", "icon_file", "tag", "icon_to_tags"]) {
			await executeQuery(`DELETE FROM ${tableName}`);
		}
	};
};

export const makeSureHasUptodateSchemaWithNoData = async (localPool: Pool | undefined): Promise<void> => {
	if (isNil(localPool)) {
		throw new Error("pool should be defined");
	}
	logger.debug("#makeSureHasUptodateSchemaWithNoData: getting pooled connection...");
	const connection = await getPooledConnection(localPool);
	try {
		const executeQuery: ExecuteQuery = connection.executeQuery;
		try {
			logger.debug("#makeSureHasUptodateSchemaWithNoData: executing schema upgrade...");
			const upgrade = executeDataUpgrade(localPool);
			await upgrade();
			logger.debug("#makeSureHasUptodateSchemaWithNoData: deleting data from schema...");
		} finally {
			await deleteData(executeQuery)();
		}
	} catch (err) {
		logger.error(err);
		throw err;
	} finally {
		connection.release();
	}
};

export const manageTestResourcesBeforeAndAfter = (): () => Pool => {
	beforeAll(async () => {
		await createTestPool(
			p => {
				if (!isNil(pool)) {
					throw new Error("Database connection pool already initialized");
				} else {
					pool = p;
				}
			}
		);
	});
	afterAll(async () => { await terminateTestPool(); });
	beforeEach(async () => { await makeSureHasUptodateSchemaWithNoData(pool); });
	afterEach(() => delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST);
	return () => {
		if (_.isNil(pool)) {
			throw new Error("No pool available");
		}
		return pool;
	};
};

export const testData = {
	iconfiles: [
		{
			name: "metro-icon",
			format: "french",
			size: "great",
			content: randomBytes(4096)
		},
		{
			name: "zazie-icon",
			format: "french",
			size: "great",
			content: randomBytes(4096)
		}
	],
	modifiedBy: "ux",
	tag1: "used-in-marvinjs",
	tag2: "some other tag"
};

export const assertIconDescriptorMatchesIconfile = (
	icondDesc: IconDescriptor,
	iconfile: Iconfile,
	expectedTags: string[]
): void => {
	expect(icondDesc.name).toEqual(iconfile.name);
	expect(icondDesc.iconfiles[0].format).toEqual(iconfile.format);
	expect(icondDesc.iconfiles[0].size).toEqual(iconfile.size);
	expect(icondDesc.tags).toEqual(expectedTags);
};
