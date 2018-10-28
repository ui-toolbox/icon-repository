import { List } from "immutable";
import { Observable } from "rxjs/Rx";

import { IconFile, IconDescriptor, IconFileDescriptor, IconAttributes, IconfileDescriptorEx } from "./icon";
import { IconDAFs } from "./db/db";
import { GitAccessFunctions } from "./git";
import csvSplitter from "./utils/csvSplitter";
import { probeMetadata } from "./iconfileService";

export type DescribeAllIcons = () => Observable<List<IconDescriptor>>;
export type DescribeIcon = (iconName: string) => Observable<IconDescriptor>;
type GetIconFile = (iconName: string, fileFormat: string, iconSize: string) => Observable<Buffer>;
type CreateIcon = (
    iconName: string,
    initialIconfileContent: Buffer,
    modifiedBy: string) => Observable<IconfileDescriptorEx>;
type IngestIconfile = (
    iconName: string,
    content: Buffer,
    modifiedBy: string) => Observable<IconFileDescriptor>;
type UpdateIcon = (
    oldIconName: string,
    newIcon: IconAttributes,
    modifiedBy: string) => Observable<void>;
type DeleteIcon = (
    iconName: string,
    modifiedBy: string
) => Observable<void>;
type AddIconFile = (
    iconFile: IconFile,
    modifiedBy: string) => Observable<number>;
type DeleteIconFile = (iconName: string, iconFileDesc: IconFileDescriptor, modifiedBy: string) => Observable<void>;

export interface IconService {
    readonly describeAllIcons: DescribeAllIcons;
    readonly describeIcon: DescribeIcon;
    readonly getIconFile: GetIconFile;
    readonly createIcon: CreateIcon;
    readonly ingestIconfile: IngestIconfile;
    readonly updateIcon: UpdateIcon;
    readonly deleteIcon: DeleteIcon;
    readonly addIconFile: AddIconFile;
    readonly deleteIconFile: DeleteIconFile;
}

export const iconSizeListParser = csvSplitter;

export interface IconRepoSettings {
    readonly resetData: string;
}

const isNewRepoNeeded: (resetData: string, gitAFs: GitAccessFunctions) => Observable<boolean>
= (resetData, gitAFs) =>
    resetData === "always"
        ? Observable.of(true)
        : resetData === "init"
            ? gitAFs.isRepoInitialized().map(initialized => !initialized)
            : Observable.of(false);

const createNewRepoMaybe = (resetData: string, iconDAFs: IconDAFs, gitAFs: GitAccessFunctions) => {
    return isNewRepoNeeded(resetData, gitAFs)
    .flatMap(needed => needed
        ? iconDAFs.createSchema()
            .flatMap(gitAFs.createNewGitRepo)
        : Observable.of(undefined));
};

const iconServiceProvider: (
    iconRepoSettings: IconRepoSettings,
    iconDAFs: IconDAFs,
    gitAFs: GitAccessFunctions
) => Observable<IconService>
= (iconRepoConfig, iconDAFs, gitAFs) => {

    const describeAllIcons: DescribeAllIcons = () => iconDAFs.describeAllIcons();

    const describeIcon: DescribeIcon = iconName => iconDAFs.describeIcon(iconName);

    const getIconFile: GetIconFile = (iconId, fileFormat, iconSize) =>
        iconDAFs.getIconFile(iconId, fileFormat, iconSize);

    const createIcon: CreateIcon = (iconName, initialIconfileContent, modifiedBy) =>
        probeMetadata(initialIconfileContent).map(v => ({
            name: iconName,
            format: v.type,
            size: `${v.height}${v.hUnits}`,
            content: initialIconfileContent
        }))
        .flatMap(fixedIconfileInfo => iconDAFs.createIcon(
            fixedIconfileInfo,
            modifiedBy,
            () => gitAFs.addIconFile(fixedIconfileInfo, modifiedBy))
            .mapTo({
                name: fixedIconfileInfo.name,
                format: fixedIconfileInfo.format,
                size: fixedIconfileInfo.size
            }));

    const ingestIconfile: IngestIconfile = (iconName, content, modifiedBy) =>
        probeMetadata(content)
        .flatMap(v => {
            const format = v.type;
            const size = `${v.height}${v.hUnits}`;
            const iconFile: IconFile = { name: iconName, format, size, content };
            return addIconFile(iconFile, modifiedBy)
            .mapTo({format, size});
        });

    const updateIcon: UpdateIcon = (oldIconName, newIcon, modifiedBy) =>
        iconDAFs.updateIcon(
            oldIconName,
            newIcon,
            modifiedBy,
            (oldIconDescriptor: IconDescriptor) => gitAFs.updateIcon(oldIconDescriptor, newIcon, modifiedBy));

    const deleteIcon: DeleteIcon = (iconName: string, modifiedBy: string) =>
        iconDAFs.deleteIcon(
            iconName,
            modifiedBy,
            iconFileDescSet => gitAFs.deleteIcon(iconName, iconFileDescSet, modifiedBy)
        );

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

    return createNewRepoMaybe(iconRepoConfig.resetData, iconDAFs, gitAFs)
    .mapTo({
        describeIcon,
        createIcon,
        ingestIconfile,
        updateIcon,
        deleteIcon,
        getIconFile,
        addIconFile,
        deleteIconFile,
        describeAllIcons
    });
};

export default iconServiceProvider;
