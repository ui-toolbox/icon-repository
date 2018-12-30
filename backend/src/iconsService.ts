import { List, Set } from "immutable";
import { Observable, of } from "rxjs";
import { mapTo, map, flatMap } from "rxjs/operators";

import { Iconfile, IconDescriptor, IconfileDescriptor, IconAttributes, IconfileDescriptorEx } from "./icon";
import { GitRepository } from "./git";
import csvSplitter from "./utils/csvSplitter";
import { probeMetadata } from "./iconfileService";
import { IconRepository } from "./db/icon";

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
type GetTags = () => Observable<Set<string>>;
type AddTag = (
    iconName: string,
    tag: string,
    modifiedBy: string) => Observable<void>;
type RemoveTag = (
    iconName: string,
    tag: string,
    modifiedBy: string) => Observable<number>;

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
    readonly getTags: GetTags;
    readonly addTag: AddTag;
    readonly removeTag: RemoveTag;
    readonly release: () => void;
}

export const iconSizeListParser = csvSplitter;

export interface IconRepoSettings {
    readonly resetData: string;
}

const isNewRepoNeeded: (resetData: string, gitRepository: GitRepository) => Observable<boolean>
= (resetData, gitRepository) =>
    resetData === "always"
        ? of(true)
        : resetData === "init"
            ? gitRepository.isRepoInitialized().pipe(map(initialized => !initialized))
            : of(false);

const createNewRepoMaybe = (resetData: string, iconRepository: IconRepository, gitRepository: GitRepository) => {
    return isNewRepoNeeded(resetData, gitRepository)
    .pipe(
        flatMap(needed => needed
            ? iconRepository.createSchema()
                .pipe(flatMap(gitRepository.createNewGitRepo), mapTo(void 0))
            : iconRepository.upgradeData())
    );
};

const iconServiceProvider: (
    iconRepoSettings: IconRepoSettings,
    iconRepository: IconRepository,
    gitRepository: GitRepository
) => Observable<IconService>
= (iconRepoConfig, iconRepository, gitRepository) => {

    const describeAllIcons: DescribeAllIcons = () => iconRepository.describeAllIcons();

    const describeIcon: DescribeIcon = iconName => iconRepository.describeIcon(iconName);

    const getIconfile: GetIconfile = (iconId, fileFormat, iconSize) =>
        iconRepository.getIconfile(iconId, fileFormat, iconSize);

    const createIcon: CreateIcon = (iconName, initialIconfileContent, modifiedBy) =>
        probeMetadata(initialIconfileContent)
        .pipe(
            map(v => ({
                name: iconName,
                format: v.type,
                size: `${v.height}${v.hUnits}`,
                content: initialIconfileContent
            })),
            flatMap(fixedIconfileInfo => iconRepository.createIcon(
                fixedIconfileInfo,
                modifiedBy,
                () => gitRepository.addIconfile(fixedIconfileInfo, modifiedBy))
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
        iconRepository.updateIcon(
            oldIconName,
            newIcon,
            modifiedBy,
            (oldIconDescriptor: IconDescriptor) => gitRepository.updateIcon(oldIconDescriptor, newIcon, modifiedBy));

    const deleteIcon: DeleteIcon = (iconName: string, modifiedBy: string) =>
        iconRepository.deleteIcon(
            iconName,
            modifiedBy,
            iconfileDescSet => gitRepository.deleteIcon(iconName, iconfileDescSet, modifiedBy)
        );

    const addIconfile: AddIconfile = (iconfile, modifiedBy) =>
        iconRepository.addIconfileToIcon(
            iconfile,
            modifiedBy,
            () => gitRepository.addIconfile(iconfile, modifiedBy));

    const deleteIconfile: DeleteIconfile = (iconName, iconfileDesc, modifiedBy) =>
        iconRepository.deleteIconfile(
            iconName,
            iconfileDesc,
            modifiedBy,
            () => gitRepository.deleteIconfile(iconName, iconfileDesc, modifiedBy)
        );

    const getTags: GetTags = () => iconRepository.getTags();

    const addTag: AddTag = (iconName, tag, modifiedBy) => iconRepository.addTag(iconName, tag);
    const removeTag: RemoveTag = (iconName, tag, modifiedBy) => iconRepository.removeTag(iconName, tag);

    return createNewRepoMaybe(iconRepoConfig.resetData, iconRepository, gitRepository)
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
            describeAllIcons,
            getTags,
            addTag,
            removeTag,
            release: iconRepository.release
        })
    );
};

export default iconServiceProvider;
