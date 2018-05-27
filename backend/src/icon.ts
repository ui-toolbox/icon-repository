export interface IAddIconRequestData {
    readonly iconName: string;
    readonly format: string;
    readonly size: string;
    readonly content: Buffer;
}

export interface IAddIconFileRequestData {
    readonly iconId: number;
    readonly format: string;
    readonly size: string;
    readonly content: Buffer;
}

export interface IIconFormatInfo {
    readonly format: string;
    readonly size: string[];
}

export interface IIconInfo {
    readonly id: number;
    readonly iconName: string;
    readonly format: IIconFormatInfo[];
}
