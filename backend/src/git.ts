import * as path from "path";
import { Observable } from "rxjs";
import { mkdirMaybe, appendFile, deleteFile } from "./utils/rx";
import {
    SerializableJobImpl,
    create as createSerializer
} from "./utils/serializer";
import logger from "./utils/logger";
import { IconFile, IconFileDescriptor } from "./icon";
import { commandExecutor } from "./utils/command-executor";
import { Set } from "immutable";

type GitCommandExecutor = (spawnArgs: string[]) => Observable<string>;

export const GIT_COMMIT_FAIL_INTRUSIVE_TEST = "GIT_COMMIT_FAIL_INTRUSIVE_TEST";

export const createGitCommandExecutor: (pathToIconRepository: string) => GitCommandExecutor
= pathToIconRepository => spawnArgs => {
    const ctxLogger = logger.createChild(`executeGitCommand ${spawnArgs} in ${pathToIconRepository}`);
    return commandExecutor(ctxLogger, "git", spawnArgs, { cwd: pathToIconRepository });
};

const enqueueJob = createSerializer("G I T");

const getFileName: (iconName: string, format: string, size: string) => string
    = (iconName, format, size) => `${iconName}@${size}.${format}`;

interface IconFilePathComponents {
    pathToFormatDir: string;
    pathToSizeDir: string;
    pathToIconFile: string;
    pathToIconFileInRepo: string;
}
type GetPathComponents = (
    pathToIconRepository: string,
    iconName: string,
    format: string,
    size: string) => IconFilePathComponents;
const getPathComponents: GetPathComponents = (repo, iconName, format, size) => {
    const fileName = getFileName(iconName, format, size);
    const pathToFormatDir: string = path.join(repo, format);
    const pathToSizeDir: string = path.join(pathToFormatDir, size);
    const pathToIconFile: string = path.join(pathToSizeDir, fileName);
    const pathToIconFileInRepo: string = path.join(format, path.join(size, fileName));
    return {
        pathToFormatDir,
        pathToSizeDir,
        pathToIconFile,
        pathToIconFileInRepo
    };
};

export const getPathToIconFile: (pathToRepo: string, iconName: string, format: string, size: string) => string
= (pathToRepo, iconName, format, size) => getPathComponents(pathToRepo, iconName, format, size).pathToIconFile;

const createIconFile: (pathToIconRepository: string, iconFileInfo: IconFile) => Observable<string>
= (pathToIconRepository, inconFileInfo) => {
    const pathCompos = getPathComponents(
        pathToIconRepository,
        inconFileInfo.name,
        inconFileInfo.format,
        inconFileInfo.size
    );
    return mkdirMaybe(pathCompos.pathToFormatDir)
    .flatMap(() => mkdirMaybe(pathCompos.pathToSizeDir))
    .flatMap(() => appendFile(pathCompos.pathToIconFile, inconFileInfo.content, { flag: "w"}))
    .mapTo(pathCompos.pathToIconFileInRepo);
};

const deleteIconFile: (
    pathToIconRepository: string,
    iconName: string,
    iconFileDesc: IconFileDescriptor
) => Observable<string>
= (pathToIconRepository, iconName, iconFileDesc) => {
    const pathCompos = getPathComponents(
        pathToIconRepository,
        iconName,
        iconFileDesc.format,
        iconFileDesc.size
    );
    return deleteFile(pathCompos.pathToIconFile)
    .mapTo(pathCompos.pathToIconFileInRepo);
};

const addToIndex = (pathInRepo: string) => ["add", pathInRepo];

const commitCommand: () => string = () =>
    process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST === "true"
        ? "procyon lotor"
        : "commit";

const commit: (messageBase: string, userName: string) => string[]
= (messageBase, userName) => [
    commitCommand(),
    "-m", `${messageBase} by ${userName}`,
    `--author=CXN Icon Repository Server <${userName}>`
];

const rollback: () => string[][] = () => [
    ["reset", "--hard", "HEAD"],
    ["clean", "-qfdx"]
];

type CreateIconFileJob = (
    iconFileOperation: () => Observable<string>,
    messages: { operationName: string, commitMessageBase: string},
    userName: string,
    gitExec: GitCommandExecutor
) => SerializableJobImpl;

const addPathInRepo: (fiText: string, pathInRepo: string) => string
= (fileListText, pathInRepo) => fileListText + (fileListText.length > 0 ? "\n" : "") + pathInRepo;

const createIconFileJob: CreateIconFileJob = (iconFileOperation, messages, userName, gitExec) => {
    const ctxLogger = logger.createChild("git: " + messages.operationName);
    return () => iconFileOperation()
    .flatMap(pathInRepo => {
        return gitExec(addToIndex(pathInRepo))
        .mapTo(pathInRepo);
    })
    .reduce((fileListText, pathInRepo) => addPathInRepo(fileListText, pathInRepo), "")
    .flatMap(fileListText => gitExec(commit(fileListText + " " + messages.commitMessageBase, userName)))
    .map(() => ctxLogger.debug("Succeeded"))
    .catch(error => {
        ctxLogger.error(`Failed: ${error}`);
        gitExec(rollback()[0])
        .flatMap(() => gitExec(rollback()[1]))
        .catch(errorInRollback => {
            ctxLogger.error(errorInRollback);
            return "dummy return value";
        });
        return Observable.throw(error);
    });
};

type AddIconFile = (
    inconFileInfo: IconFile,
    userName: string
) => Observable<void>;

type DeleteIconFile = (
    iconName: string,
    iconFileDesc: IconFileDescriptor,
    modifiedBy: string
) => Observable<void>;

type DeleteIcon = (
    iconName: string,
    iconFileDescSet: Set<IconFileDescriptor>,
    modifiedBy: string
) => Observable<void>;

export interface GitAccessFunctions {
    readonly getRepoLocation: () => string;
    readonly addIconFile: AddIconFile;
    readonly deleteIconFile: DeleteIconFile;
    readonly deleteIcon: DeleteIcon;
}

type GitAFsProvider = (localIconRepositoryLocation: string) => GitAccessFunctions;

const gitAccessFunctionsProvider: GitAFsProvider = localIconRepositoryLocation => ({
    getRepoLocation: () => localIconRepositoryLocation,

    addIconFile: (inconFileInfo, userName) => enqueueJob(
        createIconFileJob(
            () => createIconFile(localIconRepositoryLocation, inconFileInfo),
            { operationName: "add icon file", commitMessageBase: "icon file(s) added"},
            userName,
            createGitCommandExecutor(localIconRepositoryLocation)
        )
    ),

    deleteIconFile: (iconName, iconFileDesc, userName) => enqueueJob(
        createIconFileJob(
            () => deleteIconFile(localIconRepositoryLocation, iconName, iconFileDesc),
            { operationName: "delete icon file", commitMessageBase: "icon file(s) deleted" },
            userName,
            createGitCommandExecutor(localIconRepositoryLocation)
        )
    ),

    deleteIcon: (iconName, iconFileDescSet, userName) => enqueueJob(
        createIconFileJob(
            () => Observable.of(void 0)
                .flatMap(() => iconFileDescSet.toArray())
                .flatMap(iconFileDesc => deleteIconFile(localIconRepositoryLocation, iconName, iconFileDesc)),
            { operationName: "delete icon file", commitMessageBase: "icon file(s) deleted" },
            userName,
            createGitCommandExecutor(localIconRepositoryLocation)
        )
    )
});

export default gitAccessFunctionsProvider;
