import { format as sformat } from "util";
import { type Pool } from "pg";

import {
	type IColumnsDefinition,
	type ITableSpec,
	iconTableSpec,
	iconfileTableSpec
} from "./db-schema";
import { query, pgErrorCodes } from "./db";
import { createLogger } from "../utils/logger";
import { FatalError } from "../general-errors";
import { isEmpty } from "lodash";
import { retryOnError } from "../utils/fs-helpers";

const logger = createLogger("db/create-schema");

const colDefToSQL = (columnsDefinition: IColumnsDefinition, columnName: string): string =>
	`${columnName} ${columnsDefinition[columnName]}`;

const columnDefinitionToSQL = (columnsDefinition: IColumnsDefinition): string => Object.keys(columnsDefinition).reduce(
	(resultColsDef, columnName) =>
		(isEmpty(resultColsDef) ? "" : (resultColsDef + ",\n    ")) + colDefToSQL(columnsDefinition, columnName),
	""
);

const colConstraintsToSQL = (colConstraints: string[] | undefined): string =>
	isEmpty(colConstraints)
		? ""
		: ",\n    " + (colConstraints as string[]).join(",\n    ");

export const makeCreateTableStatement = (tableDefinition: ITableSpec): string => `CREATE TABLE ${tableDefinition.tableName} (
    ${columnDefinitionToSQL(tableDefinition.columns)}${colConstraintsToSQL(tableDefinition.col_constraints)}
)`;

const dropTableIfExists = async (pool: Pool, tableName: string): Promise<void> => {
	const result = await query(pool, `DROP TABLE IF EXISTS ${tableName} CASCADE`, []);
	logger.info(result.command);
};

const createTable = async (pool: Pool, tableDefinition: ITableSpec): Promise<void> => {
	const result = await query(pool, makeCreateTableStatement(tableDefinition), []);
	logger.info(result.command);
};

const dropCreateTable = async (pool: Pool, tableDefinition: ITableSpec): Promise<void> => {
	await dropTableIfExists(pool, tableDefinition.tableName);
	await createTable(pool, tableDefinition);
};

export type CreateSchema = () => Promise<void>;

export const createSchema = (pool: Pool): () => Promise<void> => {
	return async () => {
		await retryOnError(2000, 30, pgErrorCodes.connection_refused, async () => {
			try {
				await dropCreateTable(pool, iconTableSpec);
				await dropCreateTable(pool, iconfileTableSpec);
			} catch (error) {
				logger.error("Error while creating schema: %o", error);
				const result: Error = error.code === pgErrorCodes.connection_refused
					? new FatalError("Cannot connect to database")
					: new Error(sformat("Error while creating schema: %s", error.code));
				if (result instanceof FatalError) {
					throw result;
				}
			}
		});
	};
};

export default createSchema;
