import { Set } from "immutable";

export interface IconFileDescriptor {
    readonly format: string;
    readonly size: string;
}

export interface IconFileData extends IconFileDescriptor {
    readonly content: Buffer;
}

export interface IconAttributes {
    name: string;
}

export interface IconfileDescriptorEx extends IconFileDescriptor, IconAttributes {}

export interface IconFile extends IconAttributes, IconFileData {}

export class IconDescriptor implements IconAttributes {
    public readonly name: string;
    public readonly modifiedBy: string;
    public readonly iconFiles: Set<IconFileDescriptor>;

    constructor(name: string, modifiedBy: string, iconFiles: Set<IconFileDescriptor>) {
        this.name = name;
        this.modifiedBy = modifiedBy;
        this.iconFiles = iconFiles || Set();
    }

    public addIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.name, this.modifiedBy, this.iconFiles.add(iconFile));
    }

    public removeIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.name, this.modifiedBy, this.iconFiles.remove(iconFile));
    }
}

export class IconNotFound {
    public readonly message: string;
    constructor(m: string) {
        this.message = m;
    }
}

export class IconFileAlreadyExists {
    public readonly message: string;

    constructor(iconFile: IconFile) {
        this.message = `A file ${iconFile.format}@${iconFile.size} for icon ${iconFile.name} already exists`;
    }
}
