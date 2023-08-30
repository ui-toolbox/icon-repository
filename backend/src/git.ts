import * as path from "path";
import {
	getSerializer, gitSerializer
} from "./utils/serializer";
import { type Iconfile, type IconfileDescriptor, type IconDescriptor, type IconAttributes, IconNotFound } from "./icon";
import { commandExecutor } from "./utils/command-executor";
import { format as strformat } from "util";
import { createLogger } from "./utils/logger";
import { appendFile } from "fs/promises";
import { deleteFile, hasSubDirectory, mkdirMaybe, renameFile } from "./utils/fs-helpers";

type GitCommandExecutor = (spawnArgs: string[]) => Promise<string>;

export const GIT_COMMIT_FAIL_INTRUSIVE_TEST = "GIT_COMMIT_FAIL_INTRUSIVE_TEST";

type IsRepoInitialized = () => Promise<boolean>;

const isRepoInitialized = (location: string): IsRepoInitialized => async () => await hasSubDirectory(location, ".git");

export const createGitCommandExecutor = async (pathToIconRepository: string): Promise<GitCommandExecutor> => {
	return async spawnArgs => {
		return await commandExecutor("git", spawnArgs, { cwd: pathToIconRepository });
	};
};

type CreateNewGitRepo = () => Promise<void>;

export const createNewGitRepo = (location: string): CreateNewGitRepo => async () => {
	await commandExecutor("rm", ["-rf", location]);
	await commandExecutor("mkdir", ["-p", location]);
	await commandExecutor("git", ["init"], { cwd: location });
	await commandExecutor("git", ["config", "user.name", "Icon Repo Server"], { cwd: location });
	await commandExecutor("git", ["config", "user.email", "IconRepoServer@UIToolBox"], { cwd: location });
};

const getFileName: (iconName: string, format: string, size: string) => string =
  (iconName, format, size) => `${iconName}@${size}.${format}`;

interface IconfilePathComponents {
	pathToFormatDir: string
	pathToSizeDir: string
	pathToIconfile: string
	pathToIconfileInRepo: string
}

type GetPathComponents = (
	pathToIconRepository: string,
	iconName: string,
	format: string,
	size: string) => IconfilePathComponents;

const getPathComponents: GetPathComponents = (repo, iconName, format, size) => {
	const fileName = getFileName(iconName, format, size);
	const pathToFormatDir: string = path.join(repo, format);
	const pathToSizeDir: string = path.join(pathToFormatDir, size);
	const pathToIconfile: string = path.join(pathToSizeDir, fileName);
	const pathToIconfileInRepo: string = path.join(format, path.join(size, fileName));
	return {
		pathToFormatDir,
		pathToSizeDir,
		pathToIconfile,
		pathToIconfileInRepo
	};
};

const getPathComponents1 = (pathToIconRepository: string, iconfileInfo: Iconfile): IconfilePathComponents =>
	getPathComponents(
		pathToIconRepository,
		iconfileInfo.name,
		iconfileInfo.format,
		iconfileInfo.size
	);

export const getPathToIconfile: (pathToRepo: string, iconName: string, format: string, size: string) => string =
  (pathToRepo, iconName, format, size) => getPathComponents(pathToRepo, iconName, format, size).pathToIconfile;

const createIconfile = async (pathToIconRepository: string, iconfileInfo: Iconfile): Promise<string[]> => {
	const pathCompos = getPathComponents1(pathToIconRepository, iconfileInfo);
	await mkdirMaybe(pathCompos.pathToFormatDir);
	await mkdirMaybe(pathCompos.pathToSizeDir);
	await appendFile(pathCompos.pathToIconfile, iconfileInfo.content, { flag: "w" });
	return [pathCompos.pathToIconfileInRepo];
};

const renameIconfiles = async (
	pathToIconRepository: string,
	oldIcon: IconDescriptor,
	newIcon: IconAttributes
): Promise<string[]> => {
	const newIconfilePaths: string[] = [];
	for (const iconfileDesc of oldIcon.iconfiles) {
		const oldIconPaths: IconfilePathComponents = getPathComponents(
			pathToIconRepository, oldIcon.name, iconfileDesc.format, iconfileDesc.size
		);
		const newIconPaths: IconfilePathComponents = getPathComponents(
			pathToIconRepository, newIcon.name, iconfileDesc.format, iconfileDesc.size);
		await renameFile(oldIconPaths.pathToIconfile, newIconPaths.pathToIconfile);
		newIconfilePaths.push(newIconPaths.pathToIconfile);
	}
	return newIconfilePaths;
};

const deleteIconfile = async (
	pathToIconRepository: string,
	iconName: string,
	iconfileDesc: IconfileDescriptor
): Promise<string[]> => {
	const pathCompos = getPathComponents(
		pathToIconRepository,
		iconName,
		iconfileDesc.format,
		iconfileDesc.size
	);
	try {
		await deleteFile(pathCompos.pathToIconfile);
		return [pathCompos.pathToIconfileInRepo];
	} catch (error) {
		if (error.code === "ENOENT") {
			throw new IconNotFound(pathCompos.pathToIconfile);
		} else {
			throw error;
		}
	}
};

const commitCommand: () => string = () =>
	process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST === "true"
		? "procyon lotor"
		: "commit";

const commit: (messageBase: string, userName: string) => string[] = (messageBase, userName) => [
	commitCommand(),
	"-m", `${messageBase} by ${userName}`,
	`--author=${userName}@IconRepoServer <${userName}>`
];

const rollback: () => string[][] = () => [
	["reset", "--hard", "HEAD"],
	["clean", "-qfdx"]
];

interface IconfileJobTextProviders {
	logContext: string
	getCommitMessage: (filesChanged: string[]) => string
}

type CreateIconfileJob = (
	iconfileOperation: () => Promise<string[]>,
	messages: IconfileJobTextProviders,
	userName: string,
	gitCommandExecutor: GitCommandExecutor
) => () => Promise<any>;

const createIconfileJob: CreateIconfileJob = (iconfileOperation, jobTexts, userName, gitCommandExecutor) => {
	const logger = createLogger("git: " + jobTexts.logContext);
	return async () => {
		try {
			const fileList = await iconfileOperation();
			await gitCommandExecutor(["add", "-A"]);
			await gitCommandExecutor(commit(jobTexts.getCommitMessage(fileList), userName));
			logger.debug("Succeeded");
		} catch (error) {
			logger.error(strformat("Failed: %o", error));
			try {
				await gitCommandExecutor(["status"]);
				await gitCommandExecutor(rollback()[0]);
				await gitCommandExecutor(rollback()[1]);
			} catch (errorInRollback) {
				logger.error(errorInRollback);
				return "dummy return value";
			}
			throw error;
		}
	};
};

type AddIconfile = (
	iconfileInfo: Iconfile,
	modifiedBy: string
) => Promise<void>;

type DeleteIconfile = (
	iconName: string,
	iconfileDesc: IconfileDescriptor,
	modifiedBy: string
) => Promise<void>;

type UpdateIcon = (
	oldIcon: IconDescriptor,
	newIcon: IconAttributes,
	modifiedBy: string
) => Promise<void>;

type DeleteIcon = (
	iconName: string,
	iconfileDescSet: IconfileDescriptor[],
	modifiedBy: string
) => Promise<void>;

export interface GitRepository {
	readonly getRepoLocation: () => string
	readonly isRepoInitialized: IsRepoInitialized
	readonly createNewGitRepo: CreateNewGitRepo
	readonly addIconfile: AddIconfile
	readonly deleteIconfile: DeleteIconfile
	readonly updateIcon: UpdateIcon
	readonly deleteIcon: DeleteIcon
}

type GitRepositoryProvider = (localIconRepositoryLocation: string) => Promise<GitRepository>;

const addPathInRepo = (fileListText: string, pathInRepo: string): string =>
	fileListText + (fileListText.length > 0 ? "\n" : "") + pathInRepo;

const fileListAsText = (fileList: string[]): string =>
	fileList.reduce((fileListText, filePath) => addPathInRepo(fileListText, filePath), "");

const defaultCommitMsgProvider = (messageBase: string) => (fileList: string[]) => {
	return fileListAsText(fileList) + " " + messageBase;
};

const createIconfileJobTextProviders = (
	logContext: string,
	getCommitMessage: (fileList: string[]) => string
): IconfileJobTextProviders => ({ logContext, getCommitMessage });

const gitRepositoryProvider: GitRepositoryProvider = async localIconRepositoryLocation => {
	const isInited = isRepoInitialized(localIconRepositoryLocation);

	if (!await isInited()) {
		await createNewGitRepo(localIconRepositoryLocation)();
	}

	const gitCommandExecutor: GitCommandExecutor = await createGitCommandExecutor(localIconRepositoryLocation);

	const serializer = await getSerializer(gitSerializer);

	return {
		getRepoLocation: () => localIconRepositoryLocation,

		isRepoInitialized: isRepoInitialized(localIconRepositoryLocation),

		createNewGitRepo: createNewGitRepo(localIconRepositoryLocation),

		addIconfile: async (iconfileInfo, modifiedBy) => {
			await serializer(
				createIconfileJob(
					async () => await createIconfile(localIconRepositoryLocation, iconfileInfo),
					createIconfileJobTextProviders("add icon file", defaultCommitMsgProvider("icon file(s) added")),
					modifiedBy,
					gitCommandExecutor
				)
			);
		},

		deleteIconfile: async (iconName, iconfileDesc, modifiedBy) => {
			await serializer(
				createIconfileJob(
					async () => await deleteIconfile(localIconRepositoryLocation, iconName, iconfileDesc),
					createIconfileJobTextProviders("delete icon file", defaultCommitMsgProvider("icon file(s) deleted")),
					modifiedBy,
					gitCommandExecutor
				)
			);
		},

		updateIcon: async (oldIcon, newIcon, modifiedBy) => {
			await serializer(
				createIconfileJob(
					async () => await renameIconfiles(localIconRepositoryLocation, oldIcon, newIcon),
					createIconfileJobTextProviders(
						`update icon files for icon "${oldIcon.name}"`,
						defaultCommitMsgProvider(
							`icon file(s) for icon ${oldIcon.name} updated to ${JSON.stringify(newIcon)}`
						)
					),
					modifiedBy,
					gitCommandExecutor
				)
			);
		},

		deleteIcon: async (iconName, iconfileDescs, modifiedBy) => {
			await serializer(
				createIconfileJob(
					async () => {
						const iconfilePaths: string[] = [];
						for (const iconfileDesc of iconfileDescs) {
							const iconfilePath = await deleteIconfile(localIconRepositoryLocation, iconName, iconfileDesc);
							iconfilePaths.push(iconfilePath[0]);
						}
						return iconfilePaths;
					},
					createIconfileJobTextProviders(
						`delete all files for icon "${iconName}"`,
						(fileList: string[]) =>
							`all file(s) for icon "${iconName}" deleted:\n\n${fileListAsText(fileList)}`
					),
					modifiedBy,
					gitCommandExecutor
				)
			);
		}
	};
};

export default gitRepositoryProvider;
