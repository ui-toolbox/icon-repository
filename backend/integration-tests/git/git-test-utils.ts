import * as path from "path";
import { createNewGitRepo, createGitCommandExecutor, getPathToIconfile } from "../../src/git";
import { type Iconfile, type IconfileDescriptor } from "../../src/icon";
import { rmdirMaybe } from "../../src/utils/fs-helpers";
import { stat } from "fs/promises";
import { format } from "util";

const SECONDS_IN_MILLIES = 1000;

const homeTmpDir = path.join(process.env.HOME ?? "", "tmp");
const testTmpDir = path.join(homeTmpDir, "tmp-iconrepo-test");
const repoDir = path.join(testTmpDir, process.pid.toString());

export const getTestRepoDir = (): string => repoDir;

export const createTestGitRepo = async (): Promise<string> => {
	await rmdirMaybe(testTmpDir);
	await createNewGitRepo(repoDir)();
	return repoDir;
};

export const deleteTestGitRepo = async (): Promise<string> => {
	await rmdirMaybe(testTmpDir);
	return testTmpDir;
};

export const getCurrentCommit = async (): Promise<string> =>
	(await (await createGitCommandExecutor(repoDir))(["rev-parse", "HEAD"])).trim();

const getGitStatus = async (): Promise<string> =>
	(await (await createGitCommandExecutor(repoDir))(["status"])).trim();

const cleanStatusMessageTail = "nothing to commit, working tree clean";

export const assertGitCleanStatus = async (): Promise<void> => {
	const status = await getGitStatus();
	expect(status).toContain(cleanStatusMessageTail);
};

export const assertFileInRepo = async (iconfileInfo: Iconfile): Promise<void> => {
	const filePath = getPathToIconfile(repoDir, iconfileInfo.name, iconfileInfo.format, iconfileInfo.size);
	const stats = await stat(filePath);
	const timeFileBorn = stats.mtime.getMilliseconds();
	const time3secsBackInThePast = (new Date().getMilliseconds() - 3 * SECONDS_IN_MILLIES);
	expect(timeFileBorn).toBeGreaterThan(time3secsBackInThePast);
};

export const assertFileNotInRepo = async (iconName: string, iconfileDesc: IconfileDescriptor): Promise<void> => {
	const filePath = getPathToIconfile(repoDir, iconName, iconfileDesc.format, iconfileDesc.size);
	try {
		await stat(filePath);
		fail(format("%s::%s is in the repo", iconName, iconfileDesc));
	} catch (error) {
		if (error.code !== "ENOENT") {
			throw error;
		}
	}

	// expect(async () => await stat(filePath)).toThrowError("ENOENT: no such file or directory");
};
