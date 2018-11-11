import { List } from "immutable";
import { Observable, of } from "rxjs";
import { mapTo, map, flatMap } from "rxjs/operators";

import { Iconfile, IconDescriptor, IconfileDescriptor, IconAttributes, IconfileDescriptorEx } from "./icon";
import { IconDAFs } from "./db/db";
import { GitAccessFunctions } from "./git";
import csvSplitter from "./utils/csvSplitter";
import { probeMetadata } from "./iconfileService";
import { ConfigurationData } from "./configuration";

export type DescribeAllIcons = () => Observable<List<IconDescriptor>>;
export type DescribeIcon = (iconName: string) => Observable<IconDescriptor>;
type GetIconfile = (iconName: string, fileFormat: string, iconSize: string) => Observable<Buffer>;
type CreateIcon = (
    iconName: string,
    initialIconfileContent: Buffer,
    modifiedBy: string) => Observable<IconfileDescriptorEx>;
type IngestIconfile = (
    iconName: string,
    content: Buffer,
    modifiedBy: string) => Observable<IconfileDescriptor>;
type UpdateIcon = (
    oldIconName: string,
    newIcon: IconAttributes,
    modifiedBy: string) => Observable<void>;
type DeleteIcon = (
    iconName: string,
    modifiedBy: string
) => Observable<void>;
type AddIconfile = (
    iconfile: Iconfile,
    modifiedBy: string) => Observable<number>;
type DeleteIconfile = (iconName: string, iconfileDesc: IconfileDescriptor, modifiedBy: string) => Observable<void>;

export interface IconService {
    readonly describeAllIcons: DescribeAllIcons;
    readonly describeIcon: DescribeIcon;
    readonly getIconfile: GetIconfile;
    readonly createIcon: CreateIcon;
    readonly ingestIconfile: IngestIconfile;
    readonly updateIcon: UpdateIcon;
    readonly deleteIcon: DeleteIcon;
    readonly addIconfile: AddIconfile;
    readonly deleteIconfile: DeleteIconfile;
}

export const iconSizeListParser = csvSplitter;

export interface IconRepoSettings {
    readonly resetData: string;
}

const isNewRepoNeeded: (resetData: string, gitAFs: GitAccessFunctions) => Observable<boolean>
= (resetData, gitAFs) =>
    resetData === "always"
        ? of(true)
        : resetData === "init"
            ? gitAFs.isRepoInitialized().pipe(map(initialized => !initialized))
            : of(false);

const createNewRepoMaybe = (resetData: string, iconDAFs: IconDAFs, gitAFs: GitAccessFunctions) => {
    return isNewRepoNeeded(resetData, gitAFs)
    .pipe(
        flatMap(needed => needed
            ? iconDAFs.createSchema()
                .pipe(flatMap(gitAFs.createNewGitRepo))
            : of(undefined))
    );
};

const iconServiceProvider: (
    iconRepoSettings: IconRepoSettings,
    iconDAFs: IconDAFs,
    gitAFs: GitAccessFunctions
) => Observable<IconService>
= (iconRepoConfig, iconDAFs, gitAFs) => {

    const describeAllIcons: DescribeAllIcons = () => iconDAFs.describeAllIcons();

    const describeIcon: DescribeIcon = iconName => iconDAFs.describeIcon(iconName);

    const getIconfile: GetIconfile = (iconId, fileFormat, iconSize) =>
        iconDAFs.getIconfile(iconId, fileFormat, iconSize);

    const createIcon: CreateIcon = (iconName, initialIconfileContent, modifiedBy) =>
        probeMetadata(initialIconfileContent)
        .pipe(
            map(v => ({
                name: iconName,
                format: v.type,
                size: `${v.height}${v.hUnits}`,
                content: initialIconfileContent
            })),
            flatMap(fixedIconfileInfo => iconDAFs.createIcon(
                fixedIconfileInfo,
                modifiedBy,
                () => gitAFs.addIconfile(fixedIconfileInfo, modifiedBy))
                .pipe(
                    mapTo({
                        name: fixedIconfileInfo.name,
                        format: fixedIconfileInfo.format,
                        size: fixedIconfileInfo.size
                    })
                ))
        );

    const ingestIconfile: IngestIconfile = (iconName, content, modifiedBy) =>
        probeMetadata(content)
        .pipe(
            flatMap(v => {
                const format = v.type;
                const size = `${v.height}${v.hUnits}`;
                const iconfile: Iconfile = { name: iconName, format, size, content };
                return addIconfile(iconfile, modifiedBy)
                .pipe(mapTo({format, size}));
            })
        );

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
            iconfileDescSet => gitAFs.deleteIcon(iconName, iconfileDescSet, modifiedBy)
        );

    const addIconfile: AddIconfile = (iconfile, modifiedBy) =>
        iconDAFs.addIconfileToIcon(
            iconfile,
            modifiedBy,
            () => gitAFs.addIconfile(iconfile, modifiedBy));

    const deleteIconfile: DeleteIconfile = (iconName, iconfileDesc, modifiedBy) =>
        iconDAFs.deleteIconfile(
            iconName,
            iconfileDesc,
            modifiedBy,
            () => gitAFs.deleteIconfile(iconName, iconfileDesc, modifiedBy)
        );

    return createNewRepoMaybe(iconRepoConfig.resetData, iconDAFs, gitAFs)
    .pipe(
        mapTo({
            describeIcon,
            createIcon,
            ingestIconfile,
            updateIcon,
            deleteIcon,
            getIconfile,
            addIconfile,
            deleteIconfile,
            describeAllIcons
        })
    );
};

export default iconServiceProvider;
