import { type QueryResult, type Pool } from "pg";
import { getPooledConnection, type ExecuteQuery } from "./db";
import { createLogger } from "../utils/logger";
import { sortBy } from "lodash";

const logger = createLogger("data-upgrade");

interface UpgradeScript {
	readonly version: string
	readonly sqls: string[]
}

const scripts: UpgradeScript[] = [
	{
		version: "2018-12-30/1 - tag support",
		sqls: [
			"CREATE TABLE tag(id serial primary key, text text)",
			"CREATE TABLE icon_to_tags (" +
                "icon_id int REFERENCES icon(id) ON DELETE CASCADE, " +
                "tag_id  int REFERENCES tag(id)  ON DELETE CASCADE" +
            ")"
		]
	}
];

const makeSureMetaExists = async (executeQuery: ExecuteQuery): Promise<QueryResult> => {
	const sql = "CREATE TABLE IF NOT EXISTS meta (version TEXT primary key, upgrade_date TIMESTAMP)";
	return await executeQuery(sql, []);
};

const isUpgradeApplied = async (executeQuery: ExecuteQuery, version: string): Promise<boolean> => {
	await makeSureMetaExists(executeQuery);
	const sql: string = "SELECT count(*) as upgrade_count FROM meta WHERE version = $1";
	const result = await executeQuery(sql, [version]);
	const upgradeCount: number = parseInt(result.rows[0].upgrade_count as string, 10);
	return upgradeCount > 0;
};

const createMetaRecrod = async (executeQuery: ExecuteQuery, version: string): Promise<QueryResult> =>
	await executeQuery(
		"INSERT INTO meta(version, upgrade_date) VALUES($1, current_timestamp)",
		[version]
	);

const applyUpgrade = async (executeQuery: ExecuteQuery, u: UpgradeScript): Promise<void> => {
	for (const sql of u.sqls) {
		await executeQuery(sql, []);
	}
	await createMetaRecrod(executeQuery, u.version);
};

export type ExecuteDataUpgrade = () => Promise<void>;
export const executeDataUpgrade = (pool: Pool): ExecuteDataUpgrade => {
	return async () => {
		const sorted = sortBy(scripts, "version");
		const connection = await getPooledConnection(pool);
		try {
			for (const step of sorted) {
				const applied = await isUpgradeApplied(connection.executeQuery, step.version);
				if (applied) {
					logger.info("Version already applied: %s", step.version);
				} else {
					logger.info("Applying upgrade: \"%s\" ...", step.version);
					await applyUpgrade(connection.executeQuery, step); return;
				}
			}
		} finally {
			connection.release();
		}
	};
};
