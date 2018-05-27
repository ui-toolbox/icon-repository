import {
    IColumnsDefinition,
    ITableSpec } from "../src/db/db-schema";
import { makeCreateTableStatement } from "./create-schema";

describe("makeCreateTableStatement", () => {
    it("should create the proper statement", () => {
        const iconTable: ITableSpec = {
            tableName: "icons",
            columns: {
                id: {
                    name: "id",
                    definition: "serial primary key"
                },
                name: {
                    name: "name",
                    definition: "text"
                },
                version: {
                    name: "version",
                    definition: "int"
                }
            },
            col_constraints: [
                "UNIQUE (name)",
                "UNIQUE (name, version)"
            ]
        };

        expect(makeCreateTableStatement(iconTable)).toEqual(`CREATE TABLE icons (
    id serial primary key,
    name text,
    version int,
    UNIQUE (name),
    UNIQUE (name, version)
)`);
    });
});
