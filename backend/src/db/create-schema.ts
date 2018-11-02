
import {throwError as observableThrowError,  Observable } from "rxjs";
import { Pool } from "pg";

import { IColumnsDefinition, ITableSpec, iconTableSpec, iconFileTableSpec } from "./db-schema";
import { query } from "./db";
import loggerFactory from "../utils/logger";

const ctxLogger = loggerFactory("db/create-schema");

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
        ctxLogger.error("error code: %s", error.code);
        if (error.code !== "ECONNREFUSED") {
            process.exit(1);
        } else {
            return observableThrowError(error);
        }
    })
    .retryWhen(error => error.delay(2000).take(30).concat(error.do(() => {
        process.exit(1);
    })));

export default createSchema;
