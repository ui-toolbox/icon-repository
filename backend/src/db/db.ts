import { Pool, type QueryResult } from "pg";

import { createLogger } from "../utils/logger";
import _, { isNil } from "lodash";

export const pgErrorCodes = {
	connection_refused: "ECONNREFUSED",
	unique_constraint_violation: "23505",
	relation_doesnt_exist: "42P01"
};

const logger = createLogger("db");

export interface ConnectionProperties {
	readonly user: string
	readonly host: string
	readonly database: string
	readonly password: string
	readonly port: string
}

const checkDefined: (value: string, name: string) => void = (value, name) => {
	if (typeof value === "undefined") {
		throw new Error(`Connection property ${name} is undefined`);
	}
};

export const createConnectionProperties: (config: any) => ConnectionProperties =
config => {
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

export const createPoolUsing: (connectionProperties: ConnectionProperties) => Pool =
connectionProperties => {
	const connOptions = {
		user: connectionProperties.user,
		password: connectionProperties.password,
		host: connectionProperties.host,
		database: connectionProperties.database,
		port: parseInt(connectionProperties.port, 10)
	};
	const pool = new Pool(connOptions);
	pool.on("error", err => {
		logger.error("Unexpected error on idle client: %o", err);
		process.exit(-1);
	});
	return pool;
};

export const createPool = async (connectionProperties: ConnectionProperties): Promise<Pool> => createPoolUsing(connectionProperties);

export const query = async (pool: Pool, statement: string, parameters: any[]): Promise<QueryResult> => {
	logger.debug("Executing \"%s\"...", statement);
	return await pool.query(statement, parameters);
};

export type ExecuteQuery = (queryText: string, values?: any[]) => Promise<QueryResult>;

export interface Connection {
	readonly executeQuery: ExecuteQuery
	readonly release: () => void
}

export const getPooledConnection = async (pool: Pool): Promise<Connection> => await new Promise((resolve, reject) => {
	logger.debug("#getPooledConnection starts");
	pool.connect((err, client, done) => {
		logger.debug("#getPooledConnection connect result: err: %o, client: %o", err, _.size(client));
		if (!isNil(err)) {
			reject(err);
		} else if (_.isNil(client)) {
			reject(new Error("pg pool client is undefined"));
		} else {
			const connection: Connection = {
				executeQuery: async (queryText: string, values: any[]): Promise<QueryResult> => {
					logger.debug("Executing %s, %o", queryText, values);
					return await client.query(queryText, values);
				},
				release: () => {
					logger.info("Pooled connection is being released...");
					done();
				}
			};
			resolve(connection);
		}
	});
});

type Transactable<R> = (executeQuery: ExecuteQuery) => Promise<R>;

export const tx = async <R>(pool: Pool, transactable: Transactable<R>): Promise<R> => {
	const connection: Connection = await getPooledConnection(pool);
	try {
		await connection.executeQuery("BEGIN", []);
		const result = await transactable(connection.executeQuery);
		await connection.executeQuery("COMMIT", []);
		return result;
	} catch (error) {
		try {
			await connection.executeQuery("ROLLBACK", []);
		} catch (rollbakcError) {
			logger.error("Error while rolling back: %o", rollbakcError);
		}
		throw error;
	} finally {
		connection.release();
	}
};

export const tableExists = async (executeQuery: ExecuteQuery, tableName: string): Promise<boolean> => {
	try {
		await executeQuery(`SELECT count(*) FROM ${tableName} WHERE 1 = 2`, []);
		return true;
	} catch (error) {
		if (error.code === pgErrorCodes.relation_doesnt_exist) {
			return false;
		} else {
			throw error;
		}
	}
};
