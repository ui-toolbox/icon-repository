import { type ITableSpec } from "./db-schema";
import { makeCreateTableStatement } from "./create-schema";

describe("makeCreateTableStatement", () => {
	it("should create the proper statement", () => {
		const iconTable: ITableSpec = {
			tableName: "icons",
			columns: {
				id: "serial primary key",
				name: "text"
			},
			col_constraints: [
				"UNIQUE (name)"
			]
		};

		expect(makeCreateTableStatement(iconTable)).toEqual(`CREATE TABLE icons (
    id serial primary key,
    name text,
    UNIQUE (name)
)`);
	});
});
