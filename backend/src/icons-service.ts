import { type Iconfile, IconDescriptor, type IconfileDescriptor, type IconAttributes } from "./icon";
import { type GitRepository } from "./git";
import { probeMetadata } from "./iconfile-service";
import { type IconRepository } from "./db/icon";

export type DescribeAllIcons = () => Promise<IconDescriptor[]>;
export type DescribeIcon = (iconName: string) => Promise<IconDescriptor>;
type GetIconfile = (iconName: string, fileFormat: string, iconSize: string) => Promise<Buffer>;
type CreateIcon = (
	iconName: string,
	initialIconfileContent: Buffer,
	modifiedBy: string) => Promise<IconDescriptor>;
type IngestIconfile = (
	iconName: string,
	content: Buffer,
	modifiedBy: string) => Promise<IconfileDescriptor>;
type UpdateIcon = (
	oldIconName: string,
	newIcon: IconAttributes,
	modifiedBy: string) => Promise<void>;
type DeleteIcon = (
	iconName: string,
	modifiedBy: string
) => Promise<void>;
type AddIconfile = (
	iconfile: Iconfile,
	modifiedBy: string) => Promise<number>;
type DeleteIconfile = (iconName: string, iconfileDesc: IconfileDescriptor, modifiedBy: string) => Promise<void>;
type GetTags = () => Promise<string[]>;
type AddTag = (
	iconName: string,
	tag: string,
	modifiedBy: string) => Promise<void>;
type RemoveTag = (
	iconName: string,
	tag: string,
	modifiedBy: string) => Promise<number>;

export interface IconService {
	readonly describeAllIcons: DescribeAllIcons
	readonly describeIcon: DescribeIcon
	readonly getIconfile: GetIconfile
	readonly createIcon: CreateIcon
	readonly ingestIconfile: IngestIconfile
	readonly updateIcon: UpdateIcon
	readonly deleteIcon: DeleteIcon
	readonly addIconfile: AddIconfile
	readonly deleteIconfile: DeleteIconfile
	readonly getTags: GetTags
	readonly addTag: AddTag
	readonly removeTag: RemoveTag
	readonly release: () => Promise<void>
}

export interface IconRepoSettings {
	readonly resetData: boolean
}

export const createIconService = async (
	iconRepoSettings: IconRepoSettings,
	iconRepository: IconRepository,
	gitRepository: GitRepository
): Promise<IconService> => {
	if (iconRepoSettings.resetData) {
		await iconRepository.createSchema();
		await iconRepository.upgradeData();
	}

	const describeAllIcons: DescribeAllIcons = async () => await iconRepository.describeAllIcons();

	const describeIcon: DescribeIcon = async iconName => await iconRepository.describeIcon(iconName);

	const getIconfile: GetIconfile = async (iconId, fileFormat, iconSize) =>
		await iconRepository.getIconfile(iconId, fileFormat, iconSize);

	const createIcon: CreateIcon = async (iconName, initialIconfileContent, modifiedBy) => {
		const metaData = await probeMetadata(initialIconfileContent);
		const fixedIconfileInfo = {
			name: iconName,
			format: metaData.type,
			size: `${metaData.height}${metaData.hUnits}`,
			content: initialIconfileContent
		};
		await iconRepository.createIcon(
			fixedIconfileInfo,
			modifiedBy,
			async () => {
				await gitRepository.addIconfile(fixedIconfileInfo, modifiedBy);
			}
		);

		return new IconDescriptor(
			fixedIconfileInfo.name,
			modifiedBy,
			[{
				format: fixedIconfileInfo.format,
				size: fixedIconfileInfo.size
			}],
			[]
		);
	};

	const ingestIconfile: IngestIconfile = async (iconName, content, modifiedBy) => {
		const metaData = await probeMetadata(content);
		const format = metaData.type;
		const size = `${metaData.height}${metaData.hUnits}`;
		const iconfile: Iconfile = { name: iconName, format, size, content };
		await addIconfile(iconfile, modifiedBy);
		return { format, size };
	};

	const updateIcon: UpdateIcon = async (oldIconName, newIcon, modifiedBy) => {
		await iconRepository.updateIcon(
			oldIconName,
			newIcon,
			modifiedBy,
			async (oldIconDescriptor: IconDescriptor) => { await gitRepository.updateIcon(oldIconDescriptor, newIcon, modifiedBy); });
	};

	const deleteIcon: DeleteIcon = async (iconName: string, modifiedBy: string) => {
		await iconRepository.deleteIcon(
			iconName,
			modifiedBy,
			async iconfileDescSet => { await gitRepository.deleteIcon(iconName, iconfileDescSet, modifiedBy); }
		);
	};

	const addIconfile: AddIconfile = async (iconfile, modifiedBy) =>
		await iconRepository.addIconfileToIcon(
			iconfile,
			modifiedBy,
			async () => { await gitRepository.addIconfile(iconfile, modifiedBy); });

	const deleteIconfile: DeleteIconfile = async (iconName, iconfileDesc, modifiedBy) => {
		await iconRepository.deleteIconfile(
			iconName,
			iconfileDesc,
			modifiedBy,
			async () => { await gitRepository.deleteIconfile(iconName, iconfileDesc, modifiedBy); }
		);
	};

	const getTags: GetTags = async () => await iconRepository.getTags();

	const addTag: AddTag = async (iconName, tag, modifiedBy) => { await iconRepository.addTag(iconName, tag); };
	const removeTag: RemoveTag = async (iconName, tag, modifiedBy) => await iconRepository.removeTag(iconName, tag);

	return {
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
	};
};
