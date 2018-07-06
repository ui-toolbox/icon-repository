import { List, Set } from "immutable";
import { Observable } from "rxjs/Rx";

import { CreateIconInfo, IconFile, IconDescriptor } from "./icon";
import { IconDAFs } from "./db/db";
import { GitAccessFunctions } from "./git";
import { fromBase64 } from "./utils/encodings";
import csvSplitter from "./utils/csvSplitter";

interface IconRepoConfig {
    readonly allowedFileFormats: List<string>;
    readonly allowedIconSizes: List<string>;
}

interface IconFileData {
    readonly fileFormat: string;
    readonly fileData: Buffer;
}

type GetIconRepoConfig = () => Observable<IconRepoConfig>;
export type DescribeAllIcons = () => Observable<List<IconDescriptor>>;
export type DescribeIcon = (iconName: string) => Observable<IconDescriptor>;
type GetIconFile = (iconName: string, fileFormat: string, iconSize: string) => Observable<Buffer>;
type CreateIcon = (
    initialIconFileInfo: CreateIconInfo,
    modifiedBy: string) => Observable<number>;
type AddIconFile = (
    addIconFileRequestData: IconFile,
    modifiedBy: string) => Observable<number>;

export interface IconService {
    readonly getRepoConfiguration: GetIconRepoConfig;
    readonly describeAllIcons: DescribeAllIcons;
    readonly describeIcon: DescribeIcon;
    readonly getIconFile: GetIconFile;
    readonly createIcon: CreateIcon;
    readonly addIconFile: AddIconFile;
}

export const iconFormatListParser = csvSplitter;

export const iconSizeListParser = csvSplitter;

export interface IconRepoSettings {
    allowedFormats: string;
    allowedSizes: string;
}

const iconServiceProvider: (
    iconRepoSettings: IconRepoSettings,
    iconDAFs: IconDAFs,
    gitAFs: GitAccessFunctions
) => IconService
= (iconRepoConfig, iconDAFs, gitAFs) => {
    const getRepoConfiguration: GetIconRepoConfig = () => {
        return Observable.of({
            allowedFileFormats: iconFormatListParser(iconRepoConfig.allowedFormats),
            allowedIconSizes: iconSizeListParser(iconRepoConfig.allowedSizes)
        });
    };

    const describeAllIcons: DescribeAllIcons = () => iconDAFs.describeAllIcons();

    const describeIcon: DescribeIcon = iconName => iconDAFs.describeIcon(iconName);

    const getIconFile: GetIconFile = (iconId, fileFormat, iconSize) =>
        iconDAFs.getIconFile(iconId, fileFormat, iconSize);

    const createIcon: CreateIcon = (iconfFileInfo, modifiedBy) =>
        iconDAFs.createIcon(
            iconfFileInfo,
            modifiedBy,
            () => gitAFs.addIconFile(iconfFileInfo, modifiedBy));

    const addIconFile: AddIconFile = (addIconFileRequestData, modifiedBy) =>
        iconDAFs.addIconFileToIcon(addIconFileRequestData, modifiedBy);

    const decodeIconPath = (encodedIconPath: string) => fromBase64(encodedIconPath);

    return {
        getRepoConfiguration,
        describeAllIcons,
        describeIcon,
        getIconFile,
        createIcon,
        addIconFile
    };
};

export default iconServiceProvider;
