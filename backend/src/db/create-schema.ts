import { Observable } from "rxjs";
import { Pool } from "pg";

import { IColumnsDefinition, ITableSpec, iconTableSpec, iconFileTableSpec } from "./db-schema";
import { query } from "./db";
import logger from "../utils/logger";

const ctxLogger = logger.createChild("db/create-schema");

const colDefToSQL: (columnsDefinition: IColumnsDefinition, columnName: string) => string
= (columnsDefinition, columnName) => {
    return `${columnName} ${columnsDefinition[columnName]}`;
};

const columnDefinitionToSQL = (columnsDefinition: IColumnsDefinition) => Object.keys(columnsDefinition).reduce(
        (resultColsDef, columnName) =>
        (resultColsDef ? resultColsDef + ",\n    " : "") + colDefToSQL(columnsDefinition, columnName),
        null
    );

const colConstraintsToSQL = (colConstraints: string[]) =>
    !colConstraints || colConstraints.length === 0
        ? ""
        : ",\n    " + colConstraints.join(",\n    ");

export const makeCreateTableStatement = (tableDefinition: ITableSpec) => `CREATE TABLE ${tableDefinition.tableName} (
    ${columnDefinitionToSQL(tableDefinition.columns)}${colConstraintsToSQL(tableDefinition.col_constraints)}
)`;

const dropTableIfExists = (pool: Pool, tableName: string) =>
    query(pool, `DROP TABLE IF EXISTS ${tableName} CASCADE`, [])
    .map(result => ctxLogger.info(result.command));

const createTable = (pool: Pool, tableDefinition: ITableSpec) =>
    query(pool, makeCreateTableStatement(tableDefinition), [])
    .map(result => ctxLogger.info(result.command));

const dropCreateTable = (pool: Pool, tableDefinition: ITableSpec) =>
    dropTableIfExists(pool, tableDefinition.tableName)
    .flatMap(() => createTable(pool, tableDefinition));

export type CreateSchema = () => Observable<Pool>;

export const createSchema: (pool: Pool) => CreateSchema
= pool => () => dropCreateTable(pool, iconTableSpec)
    .flatMap(() => dropCreateTable(pool, iconFileTableSpec))
    .mapTo(pool)
    .catch(error => {
        ctxLogger.error(error);
        process.exit(1);
        return Observable.throw(error);
    });

export default createSchema;
