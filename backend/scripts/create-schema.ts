import { Observable } from "rxjs";
import { Pool } from "pg";

import { IColumnsDefinition, ITableSpec, iconTable, iconFileTable, IColumnSpec } from "../src/db/db-schema";
import { createPool, query } from "../src/db/db";
import logger from "../src/utils/logger";

const ctxLogger = logger.createChild("db/create-schema");

const colDefToSQL: (columnsDefinition: IColumnsDefinition, columnSpecKey: string) => string
= (columnsDefinition, columnSpecKey) => {
    const columnSpec: IColumnSpec = columnsDefinition[columnSpecKey];
    return `${columnSpec.name} ${columnsDefinition[columnSpec.definition]}`;
};

const columnDefinitionToSQL = (columnsDefinition: IColumnsDefinition) => Object.keys(columnsDefinition).reduce(
        (resultColsDef, columnSpecKey) =>
        (resultColsDef ? resultColsDef + ",\n    " : "") + colDefToSQL(columnsDefinition, columnSpecKey),
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
= pool => dropCreateTable(pool, iconTable)
    .flatMap(() => dropCreateTable(pool, iconFileTable));

export default () => createPool()
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
