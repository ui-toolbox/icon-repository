import { Set } from "immutable";

export interface IconFileDescriptor {
    readonly format: string;
    readonly size: string;
}

export interface IconFileData extends IconFileDescriptor {
    readonly content: Buffer;
}

export interface IconFile extends IconFileData {
    readonly iconId: number;
}
export interface CreateIconInfo extends IconFileData {
    readonly iconName: string;
    // public readonly format: string;
    // public readonly size: string;
    // public readonly content: Buffer;
}

export class IconDescriptor {
    public readonly id: number;
    public readonly iconName: string;
    public readonly iconFiles: Set<IconFileDescriptor>;

    constructor(id: number, iconName: string, iconFiles: Set<IconFileDescriptor>) {
        this.id = id;
        this.iconName = iconName;
        this.iconFiles = iconFiles || Set();
    }

    public addIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.id, this.iconName, this.iconFiles.add(iconFile));
    }

    public removeIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.id, this.iconName, this.iconFiles.remove(iconFile));
    }
}
