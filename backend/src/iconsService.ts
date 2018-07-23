import { List } from "immutable";
import { Observable } from "rxjs/Rx";

import { IconFile, IconDescriptor, IconFileDescriptor } from "./icon";
import { IconDAFs } from "./db/db";
import { GitAccessFunctions } from "./git";
import csvSplitter from "./utils/csvSplitter";

interface IconRepoConfig {
    readonly allowedFileFormats: List<string>;
    readonly allowedIconSizes: List<string>;
}

type GetIconRepoConfig = () => Observable<IconRepoConfig>;
export type DescribeAllIcons = () => Observable<List<IconDescriptor>>;
export type DescribeIcon = (iconName: string) => Observable<IconDescriptor>;
type GetIconFile = (iconName: string, fileFormat: string, iconSize: string) => Observable<Buffer>;
type CreateIcon = (
    initialIconFileInfo: IconFile,
    modifiedBy: string) => Observable<number>;
type AddIconFile = (
    iconFile: IconFile,
    modifiedBy: string) => Observable<number>;
type DeleteIconFile = (iconName: string, iconFileDesc: IconFileDescriptor, modifiedBy: string) => Observable<void>;

export interface IconService {
    readonly getRepoConfiguration: GetIconRepoConfig;
    readonly describeAllIcons: DescribeAllIcons;
    readonly describeIcon: DescribeIcon;
    readonly getIconFile: GetIconFile;
    readonly createIcon: CreateIcon;
    readonly addIconFile: AddIconFile;
    readonly deleteIconFile: DeleteIconFile;
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

    const addIconFile: AddIconFile = (iconFile, modifiedBy) =>
        iconDAFs.addIconFileToIcon(
            iconFile,
            modifiedBy,
            () => gitAFs.addIconFile(iconFile, modifiedBy));

    const deleteIconFile: DeleteIconFile = (iconName, iconFileDesc, modifiedBy) =>
        iconDAFs.deleteIconFile(
            iconName,
            iconFileDesc,
            modifiedBy,
            () => gitAFs.deleteIconFile(iconName, iconFileDesc, modifiedBy)
        );

    return {
        getRepoConfiguration,
        describeAllIcons,
        describeIcon,
        getIconFile,
        createIcon,
        addIconFile,
        deleteIconFile
    };
};

export default iconServiceProvider;
