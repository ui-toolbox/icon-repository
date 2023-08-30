export type IColumnsDefinition = Readonly<Record<string, string>>;

export interface ITableSpec {
	readonly tableName: string
	readonly columns: IColumnsDefinition
	readonly col_constraints?: string[]
}

type ProjectColumn = (tableSpec: ITableSpec, columnName: string) => string;
export const projectColumn: ProjectColumn = (tableSpec, columnName) => tableSpec.tableName + "." + columnName;

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
