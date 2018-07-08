export interface IColumnsDefinition {
    readonly [key: string]: string;
}

export interface ITableDefinition {
    readonly tableName: string;
    readonly columns: IColumnsDefinition;
    readonly col_constraints?: string[];
}

export const iconTable: ITableDefinition = {
    tableName: "icon",
    columns: {
        id: "serial primary key",
        name: "text",
        version: "int",
        modified_by: "text",
        modified_at: "timestamp DEFAULT now()"
    },
    col_constraints: [
        "UNIQUE (name)",
        "UNIQUE (name, version)"
    ]
};

export const iconFileTable: ITableDefinition = {
    tableName: "icon_file",
    columns: {
        id: "serial primary key",
        icon_id: "int REFERENCES icon(id) ON DELETE CASCADE",
        file_format: "text",
        icon_size: "text",
        content: "bytea"
    },
    col_constraints: [
        "UNIQUE (icon_id, file_format, icon_size)"
    ]
};
