import { Set } from "immutable";

export interface IconfileDescriptor {
    readonly format: string;
    readonly size: string;
}

export interface IconfileData extends IconfileDescriptor {
    readonly content: Buffer;
}

export interface IconAttributes {
    name: string;
}

export interface IconfileDescriptorEx extends IconfileDescriptor, IconAttributes {}

export interface Iconfile extends IconAttributes, IconfileData {}

export class IconDescriptor implements IconAttributes {
    public readonly name: string;
    public readonly modifiedBy: string;
    public readonly iconfiles: Set<IconfileDescriptor>;

    constructor(name: string, modifiedBy: string, iconfiles: Set<IconfileDescriptor>) {
        this.name = name;
        this.modifiedBy = modifiedBy;
        this.iconfiles = iconfiles || Set();
    }

    public addIconfile(iconfile: IconfileDescriptor): IconDescriptor {
        return new IconDescriptor(this.name, this.modifiedBy, this.iconfiles.add(iconfile));
    }

    public removeIconfile(iconfile: IconfileDescriptor): IconDescriptor {
        return new IconDescriptor(this.name, this.modifiedBy, this.iconfiles.remove(iconfile));
    }
}

export class IconNotFound {
    public readonly message: string;
    constructor(m: string) {
        this.message = m;
    }
}

export class IconfileAlreadyExists {
    public readonly message: string;

    constructor(iconfile: Iconfile) {
        this.message = `A file ${iconfile.format}@${iconfile.size} for icon ${iconfile.name} already exists`;
    }
}
