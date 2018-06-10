export interface IColumnsDefinition {
    readonly [key: string]: string;
}

export interface ITableSpec {
    readonly tableName: string;
    readonly columns: IColumnsDefinition;
    readonly col_constraints?: string[];
}

type ProjectColumn = (tableSpec: ITableSpec, columnName: string) => string;
export const projectColumn: ProjectColumn = (tableSpec, columnName) => tableSpec.tableName + "." + columnName;

const iconTableColumns = {
    id: "serial primary key",
    name: "text",
    version: "int",
    modified_by: "text",
    modified_at: "timestamp DEFAULT now()"
};
export type IconTableColumnsDef = typeof iconTableColumns;

export const iconTableSpec: ITableSpec = {
    tableName: "icon",
    columns: iconTableColumns,
    col_constraints: [
        "UNIQUE (name)",
        "UNIQUE (name, version)"
    ]
};

export const iconFileTableColumns =  {
    id: "serial primary key",
    icon_id: "int REFERENCES icon(id) ON DELETE CASCADE",
    file_format: "text",
    icon_size: "text",
    content: "bytea"
};
export type IconFileTableColumnsDef = typeof iconFileTableColumns;

export const iconFileTableSpec: ITableSpec = {
    tableName: "icon_file",
    columns: iconFileTableColumns,
    col_constraints: [
        "UNIQUE (icon_id, file_format, icon_size)"
    ]
};
