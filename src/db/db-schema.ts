import { isEmpty, isNil } from "lodash";

export type IColumnsDefinition = Readonly<Record<string, string>>;

export interface ITableSpec {
	readonly tableName: string
	readonly columns: IColumnsDefinition
	readonly col_constraints?: string[]
}

type ProjectColumn = (tableSpec: ITableSpec, columnName: string) => string;
export const projectColumn: ProjectColumn = (tableSpec, columnName) => tableSpec.tableName + "." + columnName;

export interface IconTableRow {
	readonly id: number
	readonly name: string
	readonly modified_by: string
	readonly modified_at: Date
}

const iconTableColumns = {
	id: "serial primary key",
	name: "text",
	modified_by: "text",
	modified_at: "timestamp DEFAULT now()"
};

export const iconTableSpec: ITableSpec = {
	tableName: "icon",
	columns: iconTableColumns,
	col_constraints: [
		"UNIQUE (name)"
	]
};

export const iconfileTableColumns = {
	id: "serial primary key",
	icon_id: "int REFERENCES icon(id) ON DELETE CASCADE",
	file_format: "text",
	icon_size: "text",
	content: "bytea"
};

export const iconfileTableSpec: ITableSpec = {
	tableName: "icon_file",
	columns: iconfileTableColumns,
	col_constraints: [
		"UNIQUE (icon_id, file_format, icon_size)"
	]
};

export const tagTableSpec: ITableSpec = {
	tableName: "tag",
	columns: {
		id: "serial primary key",
		text: "text"
	},
	col_constraints: [
		"UNIQUE (text)"
	]
};

export const iconToTagsTableSpec: ITableSpec = {
	tableName: "icon_to_tags",
	columns: {
		icon_id: "int REFERENCES icon(id) ON DELETE CASCADE",
		tag_id: "int REFERENCES tag(id) ON DELETE CASCADE"
	}
};

const colDefToSQL = (columnsDefinition: IColumnsDefinition, columnName: string): string =>
	`${columnName} ${columnsDefinition[columnName]}`;

const columnDefinitionToSQL = (columnsDefinition: IColumnsDefinition): string => Object.keys(columnsDefinition).reduce(
	(resultColsDef, columnName) =>
		(isEmpty(resultColsDef) ? "" : (resultColsDef + ",\n    ")) + colDefToSQL(columnsDefinition, columnName),
	""
);

const colConstraintsToSQL = (colConstraints: string[] | undefined): string =>
	isNil(colConstraints) || isEmpty(colConstraints)
		? ""
		: ",\n    " + (colConstraints).join(",\n    ");

export const makeCreateTableStatement = (tableDefinition: ITableSpec): string => `CREATE TABLE ${tableDefinition.tableName} (
    ${columnDefinitionToSQL(tableDefinition.columns)}${colConstraintsToSQL(tableDefinition.col_constraints)}
)`;
