
import {throwError as observableThrowError,  Observable, concat, pipe, throwError } from "rxjs";
import { Pool } from "pg";

import {
    IColumnsDefinition,
    ITableSpec,
    iconTableSpec,
    iconfileTableSpec,
    iconToTagsTableSpec,
    tagTableSpec } from "./db-schema";
import { query, pgErrorCodes } from "./db";
import loggerFactory from "../utils/logger";
import { map, flatMap, catchError, retryWhen, delay, take, mapTo, tap } from "rxjs/operators";
import { retryOnError } from "../utils/rx";
import { FatalError } from "../general-errors";

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
    .pipe(map(result => ctxLogger.info(result.command)));

const createTable = (pool: Pool, tableDefinition: ITableSpec) =>
    query(pool, makeCreateTableStatement(tableDefinition), [])
    .pipe(map(result => ctxLogger.info(result.command)));

const dropCreateTable = (pool: Pool, tableDefinition: ITableSpec) =>
    dropTableIfExists(pool, tableDefinition.tableName)
    .pipe(flatMap(() => createTable(pool, tableDefinition)));

export type CreateSchema = () => Observable<Pool>;

export const createSchema: (pool: Pool) => CreateSchema
= pool => () => dropCreateTable(pool, iconTableSpec)
    .pipe(
        flatMap(() => dropCreateTable(pool, iconfileTableSpec)),
        flatMap(() => dropCreateTable(pool, tagTableSpec)),
        flatMap(() => dropCreateTable(pool, iconToTagsTableSpec)),
        mapTo(pool),
        retryOnError(2000, 30, pgErrorCodes.connection_refused),
        catchError(error => {
            const result = error.code === pgErrorCodes.connection_refused
                ? new FatalError("Cannot connect to database")
                : new Error(error.code);
            ctxLogger.error("Error while creating schema: %o", error);
            return throwError(result);
        })
    );

export default createSchema;
