import * as path from "path";
import { Observable } from "rxjs";
import { mkdirMaybe, appendFile, deleteFile, renameFile, hasSubDirectory } from "./utils/rx";
import {
    SerializableJobImpl,
    create as createSerializer
} from "./utils/serializer";
import logger from "./utils/logger";
import { IconFile, IconFileDescriptor, IconDescriptor, IconAttributes, IconNotFound } from "./icon";
import { commandExecutor } from "./utils/command-executor";
import { Set, List } from "immutable";
import { format as strformat } from "util";
import loggerFactory from "./utils/logger";

type GitCommandExecutor = (spawnArgs: string[]) => Observable<string>;

export const GIT_COMMIT_FAIL_INTRUSIVE_TEST = "GIT_COMMIT_FAIL_INTRUSIVE_TEST";

export const createGitCommandExecutor: (pathToIconRepository: string) => GitCommandExecutor
= pathToIconRepository => spawnArgs => {
    const ctxLogger = loggerFactory(`executeGitCommand ${spawnArgs} in ${pathToIconRepository}`);
    return commandExecutor(ctxLogger, "git", spawnArgs, { cwd: pathToIconRepository });
};

type IsRepoInitialized = () => Observable<boolean>;

const isRepoInitialized: (location: string) => IsRepoInitialized
= location => () => hasSubDirectory(location, ".git");

type CreateNewGitRepo = () => Observable<string>;

export const createNewGitRepo: (location: string) => CreateNewGitRepo
= location => () => {
    const newGitRepoLogger = loggerFactory("create-new-git-repo");
    return commandExecutor(newGitRepoLogger, "rm", [ "-rf", location])
    .flatMap(() => commandExecutor(newGitRepoLogger, "mkdir", [ "-p", location ]))
    .flatMap(() => commandExecutor(newGitRepoLogger, "git", [ "init" ], { cwd: location }))
    .flatMap(() => commandExecutor(
        newGitRepoLogger,
        "git", [ "config", "user.name", "Icon Repo Server"],
        { cwd: location }
    ))
    .flatMap(() => commandExecutor(
        newGitRepoLogger,
        "git", [ "config", "user.email", "IconRepoServer@UIToolBox"],
        { cwd: location }
    ));
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

const getPathComponents1 = (pathToIconRepository: string, iconFileInfo: IconFile) =>
    getPathComponents(
        pathToIconRepository,
        iconFileInfo.name,
        iconFileInfo.format,
        iconFileInfo.size
    );

export const getPathToIconFile: (pathToRepo: string, iconName: string, format: string, size: string) => string
= (pathToRepo, iconName, format, size) => getPathComponents(pathToRepo, iconName, format, size).pathToIconFile;

const createIconFile: (pathToIconRepository: string, iconFileInfo: IconFile) => Observable<List<string>>
= (pathToIconRepository, iconFileInfo) => {
    const pathCompos = getPathComponents1(pathToIconRepository, iconFileInfo);
    return mkdirMaybe(pathCompos.pathToFormatDir)
    .flatMap(() => mkdirMaybe(pathCompos.pathToSizeDir))
    .flatMap(() => appendFile(pathCompos.pathToIconFile, iconFileInfo.content, { flag: "w"}))
    .mapTo(List.of(pathCompos.pathToIconFileInRepo));
};

const updateIconFile: (pathToIconRepository: string, iconFileInfo: IconFile) => Observable<List<string>>
= (pathToIconRepository, iconFileInfo) => {
    const pathCompos = getPathComponents1(pathToIconRepository, iconFileInfo);
    return appendFile(pathCompos.pathToIconFile, iconFileInfo.content, { flag: "w"})
    .mapTo(List.of(pathCompos.pathToIconFileInRepo));
};

const renameIconFiles: (
    pathToIconRepository: string,
    oldIcon: IconDescriptor,
    newIcon: IconAttributes
) => Observable<List<string>> = (pathToIconRepository, oldIcon, newIcon) =>
    Observable.of(void 0)
    .flatMap(() => oldIcon.iconFiles.toArray())
    .flatMap(iconFileDesc => {
        const oldIconPaths: IconFilePathComponents = getPathComponents(
            pathToIconRepository, oldIcon.name, iconFileDesc.format, iconFileDesc.size);
        const newIconPaths: IconFilePathComponents = getPathComponents(
            pathToIconRepository, newIcon.name, iconFileDesc.format, iconFileDesc.size);
        return renameFile(oldIconPaths.pathToIconFile, newIconPaths.pathToIconFile)
        .mapTo(List.of(oldIconPaths.pathToIconFileInRepo, newIconPaths.pathToIconFileInRepo));
    });

const deleteIconFile: (
    pathToIconRepository: string,
    iconName: string,
    iconFileDesc: IconFileDescriptor
) => Observable<List<string>>
= (pathToIconRepository, iconName, iconFileDesc) => {
    const pathCompos = getPathComponents(
        pathToIconRepository,
        iconName,
        iconFileDesc.format,
        iconFileDesc.size
    );
    return deleteFile(pathCompos.pathToIconFile)
    .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
            throw new IconNotFound(pathCompos.pathToIconFile);
        } else {
            return Observable.throw(error);
        }
    })
    .mapTo(List.of(pathCompos.pathToIconFileInRepo));
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
    `--author=${userName}@IconRepoServer <${userName}>`
];

const rollback: () => string[][] = () => [
    ["reset", "--hard", "HEAD"],
    ["clean", "-qfdx"]
];

interface IconFileJobTextProviders {
    logContext: string;
    getCommitMessage: (filesChanged: List<string>) => string;
}

type CreateIconFileJob = (
    iconFileOperation: () => Observable<List<string>>,
    messages: IconFileJobTextProviders,
    userName: string,
    gitCommandExecutor: GitCommandExecutor
) => SerializableJobImpl;

const createIconFileJob: CreateIconFileJob = (iconFileOperation, jobTexts, userName, gitCommandExecutor) => {
    const ctxLogger = loggerFactory("git: " + jobTexts.logContext);
    return () => iconFileOperation()
    .flatMap(iconFilePathsInRepo => iconFilePathsInRepo.toArray())
    .flatMap(oneFilePathInRepo => gitCommandExecutor(addToIndex(oneFilePathInRepo)).mapTo(oneFilePathInRepo))
    .reduce((fileList, oneIconFilePathInRepo) => fileList.push(oneIconFilePathInRepo), List<string>())
    .flatMap(fileList => gitCommandExecutor(commit(jobTexts.getCommitMessage(fileList), userName)))
    .map(() => ctxLogger.debug("Succeeded"))
    .catch(error => {
        ctxLogger.error(strformat("Failed: %o", error));
        gitCommandExecutor(rollback()[0])
        .flatMap(() => gitCommandExecutor(rollback()[1]))
        .catch(errorInRollback => {
            ctxLogger.error(errorInRollback);
            return "dummy return value";
        });
        return Observable.throw(error);
    });
};

type AddIconFile = (
    iconFileInfo: IconFile,
    modifiedBy: string
) => Observable<void>;

type UpdateIconFile = (
    iconFileInfo: IconFile,
    modifiedBy: string
) => Observable<void>;

type DeleteIconFile = (
    iconName: string,
    iconFileDesc: IconFileDescriptor,
    modifiedBy: string
) => Observable<void>;

type UpdateIcon = (
    oldIcon: IconDescriptor,
    newIcon: IconAttributes,
    modifiedBy: string
) => Observable<void>;

type DeleteIcon = (
    iconName: string,
    iconFileDescSet: Set<IconFileDescriptor>,
    modifiedBy: string
) => Observable<void>;

export interface GitAccessFunctions {
    readonly getRepoLocation: () => string;
    readonly isRepoInitialized: IsRepoInitialized;
    readonly createNewGitRepo: CreateNewGitRepo;
    readonly addIconFile: AddIconFile;
    readonly deleteIconFile: DeleteIconFile;
    readonly updateIcon: UpdateIcon;
    readonly deleteIcon: DeleteIcon;
}

type GitAFsProvider = (localIconRepositoryLocation: string) => GitAccessFunctions;

const addPathInRepo: (fiText: string, pathInRepo: string) => string
= (fileListText, pathInRepo) => fileListText + (fileListText.length > 0 ? "\n" : "") + pathInRepo;
const fileListAsText = (fileList: List<string>) =>
    fileList.reduce((fileListText, filePath) => addPathInRepo(fileListText, filePath), "");

const defaultCommitMsgProvider = (messageBase: string) => (fileList: List<string>) => {
    return fileListAsText(fileList) + " " + messageBase;
};

const createIconFileJobTextProviders: (
    logContext: string,
    getCommitMessage: (fileList: List<string>) => string
) => IconFileJobTextProviders
= (logContext, getCommitMessage) => ({logContext, getCommitMessage});

const gitAccessFunctionsProvider: GitAFsProvider = localIconRepositoryLocation => {
    const gitCommandExecutor: GitCommandExecutor = createGitCommandExecutor(localIconRepositoryLocation);

    return {
        getRepoLocation: () => localIconRepositoryLocation,

        isRepoInitialized: isRepoInitialized(localIconRepositoryLocation),

        createNewGitRepo: createNewGitRepo(localIconRepositoryLocation),

        addIconFile: (iconFileInfo, modifiedBy) => enqueueJob(
            createIconFileJob(
                () => createIconFile(localIconRepositoryLocation, iconFileInfo),
                createIconFileJobTextProviders("add icon file", defaultCommitMsgProvider("icon file(s) added")),
                modifiedBy,
                gitCommandExecutor
            )
        ),

        deleteIconFile: (iconName, iconFileDesc, modifiedBy) => enqueueJob(
            createIconFileJob(
                () => deleteIconFile(localIconRepositoryLocation, iconName, iconFileDesc),
                createIconFileJobTextProviders("delete icon file", defaultCommitMsgProvider("icon file(s) deleted")),
                modifiedBy,
                gitCommandExecutor
            )
        ),

        updateIcon: (oldIcon, newIcon, modifiedBy) => enqueueJob(
            createIconFileJob(
                () => renameIconFiles(localIconRepositoryLocation, oldIcon, newIcon),
                createIconFileJobTextProviders(
                    `update icon files for icon "${oldIcon.name}"`,
                    defaultCommitMsgProvider(
                        `icon file(s) for icon ${oldIcon.name} updated to ${JSON.stringify(newIcon)}`
                    )
                ),
                modifiedBy,
                gitCommandExecutor
            )
        ),

        deleteIcon: (iconName, iconFileDescSet, modifiedBy) => enqueueJob(
            createIconFileJob(
                () => Observable.of(void 0)
                    .flatMap(() => iconFileDescSet.toArray())
                    .flatMap(iconFileDesc => deleteIconFile(localIconRepositoryLocation, iconName, iconFileDesc)),
                createIconFileJobTextProviders(
                    `delete all files for icon "${iconName}"`,
                    (fileList: List<string>) =>
                            `all file(s) for icon "${iconName}" deleted:\n\n${fileListAsText(fileList)}`
                ),
                modifiedBy,
                gitCommandExecutor
            )
        )
    };
};

export default gitAccessFunctionsProvider;
