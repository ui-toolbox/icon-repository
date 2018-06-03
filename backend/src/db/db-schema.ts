export interface IColumnSpec {
    readonly name: string;
    readonly definition: string;
}

export interface IColumnsDefinition {
    readonly [key: string]: IColumnSpec;
}

export interface ITableSpec {
    readonly tableName: string;
    readonly columns: IColumnsDefinition;
    readonly col_constraints?: string[];
}

type ProjectColumn = (tableSpec: ITableSpec, columnSpec: IColumnSpec) => string;
export const projectColumn: ProjectColumn = (tableSpec, columnSpec) => tableSpec.tableName + "." + columnSpec.name;

const iconTableColumns = {
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
    },
    modifiedBy: {
        name: "modified_by",
        definition: "text"
    },
    modifiedAt: {
        name: "modified_at",
        definition: "timestamp DEFAULT now()"
    }
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
    id: {
        name: "id",
        definition: "serial primary key"
    },
    icondId: {
        name: "icon_id",
        definition: "int REFERENCES icon(id) ON DELETE CASCADE"
    },
    fileFormat: {
        name: "file_format",
        definition: "text"
    },
    iconSize: {
        name: "icon_size",
        definition: "text"
    },
    content: {
        name: "content",
        definition: "bytea"
    }
};
export type IconFileTableColumnsDef = typeof iconFileTableColumns;

export const iconFileTableSpec: ITableSpec = {
    tableName: "icon_file",
    columns: iconFileTableColumns,
    col_constraints: [
        "UNIQUE (icon_id, file_format, icon_size)"
    ]
};
