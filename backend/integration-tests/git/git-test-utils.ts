import * as path from "path";
import { Observable } from "rxjs";
import { stat, rmdirMaybe, rmdir } from "../../src/utils/rx";
import { createNewGitRepo, createGitCommandExecutor, getPathToIconFile } from "../../src/git";
import { IconFile, IconFileDescriptor } from "../../src/icon";
import logger from "../../src/utils/logger";

const SECONDS_IN_MILLIES = 1000;

const homeTmpDir = path.join(process.env.HOME, "tmp");
const testTmpDir = path.join(homeTmpDir, "tmp-icon-repo-test");
const repoDir = path.join(testTmpDir, process.pid.toString());

const ctxLogger = logger.createChild("get-test-utils");

export const getTestRepoDir = () => repoDir;

export const createTestGitRepo: () => Observable<string> = () =>
    rmdirMaybe(testTmpDir)
    .flatMap(createNewGitRepo(repoDir));

export const deleteTestGitRepo: () => Observable<string> = () => {
    ctxLogger.debug("deleting test git repo %s", testTmpDir);
    return rmdir(testTmpDir);
};

export const getCurrentCommit: () => Observable<string> = () =>
    createGitCommandExecutor(repoDir)(["rev-parse", "HEAD"])
    .map(out => out.trim());

const getGitStatus: () => Observable<string> = () =>
    createGitCommandExecutor(repoDir)(["status"])
    .map(out => out.trim());

const cleanStatusMessageTail = "nothing to commit, working tree clean";

export const assertGitCleanStatus = () => getGitStatus()
.map(status => expect(status.substr(status.length - cleanStatusMessageTail.length))
                .toEqual(cleanStatusMessageTail));

export const assertFileInRepo: (iconFileInfo: IconFile) => Observable<void>
= iconFileInfo => {
    const filePath = getPathToIconFile(repoDir, iconFileInfo.name, iconFileInfo.format, iconFileInfo.size);
    return stat(filePath)
    .map(stats => {
        if (stats) {
            const timeFileBorn = stats.mtime.getMilliseconds();
            const time3secsBackInThePast = (new Date().getMilliseconds() - 3 * SECONDS_IN_MILLIES);
            expect(timeFileBorn).toBeGreaterThan(time3secsBackInThePast);
        } else {
            throw Error(`File not found: ${filePath}`);
        }
    });
};

export const assertFileNotInRepo: (iconName: string, iconFileDesc: IconFileDescriptor) => Observable<void>
= (iconName, iconFileDesc) => {
    const filePath = getPathToIconFile(repoDir, iconName, iconFileDesc.format, iconFileDesc.size);
    return stat(filePath)
    .map(stats => expect(stats).toBeNull())
    .mapTo(void 0);
};
