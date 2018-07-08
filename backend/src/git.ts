import * as path from "path";
import { spawn, exec } from "child_process";
import { Observable, Observer } from "rxjs";
import { mkdirMaybe, appendFile } from "./utils/rx";
import {
    SerializableJobImpl,
    JobDoneCallback,
    JobResult,
    create as createSerializer
} from "./utils/serializer";
import logger from "./utils/logger";
import { CreateIconInfo } from "./icon";

type GitCommandExecutor = (spawnArgs: string[]) => Observable<string>;

export const GIT_COMMIT_FAIL_INTRUSIVE_TEST = "GIT_COMMIT_FAIL_INTRUSIVE_TEST";

export const createGitCommandExecutor: (iconRepository: string) => GitCommandExecutor
= iconRepository => spawnArgs => {
    const ctxLogger = logger.createChild(`executeGitCommand ${spawnArgs} in ${iconRepository}`);
    ctxLogger.debug("BEGIN");
    let stdoutData: string = "";
    const proc = spawn("git", spawnArgs, { cwd: iconRepository });
    proc.stderr.on("data", data => ctxLogger.info(`stderr: ${data}`));
    proc.stdout.on("data", data => {
        ctxLogger.info(`stdout: ${data}`);
        stdoutData += data;
    });
    return Observable.create((observer: Observer<string>) => {
        proc.on("error", err => observer.error(err));
        proc.on("close", code => {
            if (code === 0) {
                observer.next(stdoutData);
                observer.complete();
            } else {
                observer.error(new Error(`Git command ${spawnArgs} failed with exit code ${code}`));
            }
        });
    });
};

const enqueueJob = createSerializer("GIT");

const getFileName: (inconFileInfo: CreateIconInfo) => string
    = inconFileInfo => `${inconFileInfo.iconName}@${inconFileInfo.size}.${inconFileInfo.format}`;

/*
 * @return an Observable for the path to the icon file relative to the local GIT repository's root.
 */
const createIconFile: (inconFileInfo: CreateIconInfo, iconRepository: string) => Observable<string>
= (inconFileInfo, iconRepository) =>
    mkdirMaybe(path.join(iconRepository, inconFileInfo.format))
    .flatMap(pathToFormatDir =>
        mkdirMaybe(path.join(pathToFormatDir, inconFileInfo.size))
        .flatMap(pathToSizeDir =>
            appendFile(
                path.join(
                    pathToSizeDir,
                    getFileName(inconFileInfo)
                ),
                inconFileInfo.content,
                { flag: "w"})
            ));

const addToIndex = (pathInRepo: string) => ["add", pathInRepo];

const commitCommand: () => string = () =>
    process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST === "true"
        ? "procyon lotor"
        : "commit";

const commit: (pathInRepo: string, userName: string) => string[]
= (pathInRepo, userName) => [
    commitCommand(),
    "-m", `"${pathInRepo}" icon added by ${userName}`,
    `--author=CXN Icon Repository Server <${userName}>`
];

const rollback: () => string[][] = () => [
    ["reset", "--hard", "HEAD"],
    ["clean", "-qfdx"]
];

const createAddIconFileJob: (
    inconFileInfo: CreateIconInfo,
    userName: string,
    gitExec: GitCommandExecutor,
    iconRepository: string
) => SerializableJobImpl
= (inconFileInfo, userName, gitExec, iconRepository) => {
    const ctxLogger = logger.createChild("add icon file");
    ctxLogger.debug("BEGIN");
    return (done: JobDoneCallback) =>
            createIconFile(inconFileInfo, iconRepository)
            .flatMap(pathInRepo =>
                gitExec(addToIndex(pathInRepo))
                .flatMap(() =>
                    gitExec(commit(pathInRepo, userName)))
                .mapTo(pathInRepo))
            .subscribe(
                pathInRepo => done(void 0, pathInRepo),
                error => {
                    ctxLogger.error(`Adding file failed with ${error}`);
                    gitExec(rollback()[0])
                    .flatMap(() => gitExec(rollback()[1]))
                    .catch(errorInRollback => {
                        ctxLogger.error(errorInRollback);
                        return "dummy return value";
                    })
                    .subscribe(
                        void 0,
                        e => done(error, void 0),
                        () => done(error, void 0)
                    );
                },
                void 0
            );
};

type AddIconFile = (
    inconFileInfo: CreateIconInfo,
    userName: string
) => Observable<void>;

export interface GitAccessFunctions {
    readonly getRepoLocation: () => string;
    readonly addIconFile: AddIconFile;
}

type GitAFsProvider = (localIconRepositoryLocation: string) => GitAccessFunctions;

const gitAccessFunctionsProvider: GitAFsProvider = localIconRepositoryLocation => ({
    getRepoLocation: () => localIconRepositoryLocation,

    addIconFile: (inconFileInfo, userName) => Observable.create((observer: Observer<string>) =>
    enqueueJob(
            createAddIconFileJob(
                inconFileInfo,
                userName,
                createGitCommandExecutor(localIconRepositoryLocation),
                localIconRepositoryLocation
            ),
            (error: Error, result: JobResult) => {
                if (error) {
                    observer.error(error);
                } else {
                    observer.next(result);
                    observer.complete();
                }
            }
        )
    )
});

export default gitAccessFunctionsProvider;
