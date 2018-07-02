import { Observable } from "rxjs";
import { Pool } from "pg";

import configuration from "../src/configuration";
import { IColumnsDefinition, ITableSpec, iconTableSpec, iconFileTableSpec } from "../src/db/db-schema";
import { createPool, query } from "../src/db/db";
import logger from "../src/utils/logger";

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

export const makeCreateTableStatement = (tableDefinition: ITableSpec) =>
`CREATE TABLE ${tableDefinition.tableName} (
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

export const createSchema: (pool: Pool) => Observable<void>
= pool => dropCreateTable(pool, iconTableSpec)
    .flatMap(() => dropCreateTable(pool, iconFileTableSpec));

export default () => configuration
    .flatMap(configProvider => createPool(configProvider()))
    .flatMap(pool => createSchema(pool)
        .map(() => pool.end())
        .catch(error => {
            pool.end();
            return Observable.throw(error);
        })
    )
    .subscribe(
        () => ctxLogger.info("script OK"),
        error => ctxLogger.error("Error: %o", error),
        () => ctxLogger.info("Script completed")
    );
