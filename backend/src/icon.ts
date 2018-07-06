import { Set } from "immutable";

export interface IconFileDescriptor {
    readonly format: string;
    readonly size: string;
}

export interface IconFileData extends IconFileDescriptor {
    readonly content: Buffer;
}

export interface IconFile extends IconFileData {
    readonly iconName: string;
}
export interface CreateIconInfo extends IconFileData {
    readonly name: string;
}

export class IconDescriptor {
    public readonly iconName: string;
    public readonly iconFiles: Set<IconFileDescriptor>;

    constructor(iconName: string, iconFiles: Set<IconFileDescriptor>) {
        this.iconName = iconName;
        this.iconFiles = iconFiles || Set();
    }

    public addIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.iconName, this.iconFiles.add(iconFile));
    }

    public removeIconFile(iconFile: IconFileDescriptor): IconDescriptor {
        return new IconDescriptor(this.iconName, this.iconFiles.remove(iconFile));
    }
}
