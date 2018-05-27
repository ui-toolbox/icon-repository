import * as path from "path";
import { Observable } from "rxjs";
import { stat, rmdirMaybe, mkdirMaybe, mkdir, rmdir } from "../../src/utils/rx";
import { createGitCommandExecutor } from "../../src/git";
import { IIconFile } from "../../src/icon";

const SECONDS_IN_MILLIES = 1000;

const homeTmpDir = path.join(process.env.HOME, "tmp");
const testTmpDir = path.join(homeTmpDir, "tmp-icon-repo-test");
const repoDir = path.join(testTmpDir, process.pid.toString());

export const getTestRepoDir = () => repoDir;

export const createTestGitRepo: () => Observable<string> = () =>
    rmdirMaybe(testTmpDir)
    .flatMap(() => mkdirMaybe(homeTmpDir))
    .flatMap(() => mkdir(testTmpDir))
    .flatMap(() => mkdir(repoDir))
    .flatMap(() => createGitCommandExecutor(repoDir)(["init"]));

export const deleteTestGitRepo: () => Observable<string> = () =>
    rmdir(testTmpDir);

export const getCurrentCommit: () => Observable<string> = () =>
    createGitCommandExecutor(repoDir)(["rev-parse", "HEAD"])
    .map(out => out.trim());

const getGitStatus: () => Observable<string> = () =>
    createGitCommandExecutor(repoDir)(["status"])
    .map(out => out.trim());
const statusMessageTail = "nothing to commit, working tree clean";
export const assertGitStatus = () => getGitStatus()
.map(status => expect(status.substr(status.length - statusMessageTail.length))
                .toEqual(statusMessageTail));

export const assertAddedFile: (iconFileInfo: IIconFile, user: string) => Observable<void>
= (iconFileInfo, user) => {
    const filePath = path.join(
        repoDir,
        iconFileInfo.format,
        iconFileInfo.size,
        `${iconFileInfo.iconName}@${iconFileInfo.size}.${iconFileInfo.format}`);
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
