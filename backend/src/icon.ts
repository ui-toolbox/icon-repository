import { Set } from "immutable";

export interface IconFileDescriptor {
    readonly format: string;
    readonly size: string;
}

export interface IconFileData extends IconFileDescriptor {
    readonly content: Buffer;
}

export interface IconFile extends IconFileData {
    readonly name: string;
}

export interface IconAttributes {
    name: string;
}

export class IconDescriptor implements IconAttributes {
    public readonly name: string;
    public readonly iconFiles: Set<IconFileDescriptor>;

    constructor(name: string, iconFiles: Set<IconFileDescriptor>) {
        this.name = name;
        this.iconFiles = iconFiles || Set();
    }

    public addIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.name, this.iconFiles.add(iconFile));
    }

    public removeIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.name, this.iconFiles.remove(iconFile));
    }
}

export class IconNotFound {
    public readonly message: string;
    constructor(m: string) {
        this.message = m;
    }
}
