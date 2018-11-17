
import {throwError as observableThrowError,  Observable, of } from "rxjs";
import { flatMap, mapTo, reduce, map, catchError } from "rxjs/operators";
import * as path from "path";
import { mkdirMaybe, appendFile, deleteFile, renameFile, hasSubDirectory } from "./utils/rx";
import {
    SerializableJobImpl,
    create as createSerializer
} from "./utils/serializer";
import { Iconfile, IconfileDescriptor, IconDescriptor, IconAttributes, IconNotFound } from "./icon";
import { commandExecutor } from "./utils/command-executor";
import { Set, List } from "immutable";
import { format as strformat } from "util";
import loggerFactory from "./utils/logger";
import { stringify } from "querystring";

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
    .pipe(
        flatMap(() => commandExecutor(newGitRepoLogger, "mkdir", [ "-p", location ])),
        flatMap(() => commandExecutor(newGitRepoLogger, "git", [ "init" ], { cwd: location })),
        flatMap(() => commandExecutor(
            newGitRepoLogger,
            "git", [ "config", "user.name", "Icon Repo Server"],
            { cwd: location }
        )),
        flatMap(() => commandExecutor(
            newGitRepoLogger,
            "git", [ "config", "user.email", "IconRepoServer@UIToolBox"],
            { cwd: location }
        ))
    );
};

const enqueueJob = createSerializer("G I T");

const getFileName: (iconName: string, format: string, size: string) => string
    = (iconName, format, size) => `${iconName}@${size}.${format}`;

interface IconfilePathComponents {
    pathToFormatDir: string;
    pathToSizeDir: string;
    pathToIconfile: string;
    pathToIconfileInRepo: string;
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

const getPathComponents1 = (pathToIconRepository: string, iconfileInfo: Iconfile) =>
    getPathComponents(
        pathToIconRepository,
        iconfileInfo.name,
        iconfileInfo.format,
        iconfileInfo.size
    );

export const getPathToIconfile: (pathToRepo: string, iconName: string, format: string, size: string) => string
= (pathToRepo, iconName, format, size) => getPathComponents(pathToRepo, iconName, format, size).pathToIconfile;

const createIconfile: (pathToIconRepository: string, iconfileInfo: Iconfile) => Observable<List<string>>
= (pathToIconRepository, iconfileInfo) => {
    const pathCompos = getPathComponents1(pathToIconRepository, iconfileInfo);
    return mkdirMaybe(pathCompos.pathToFormatDir)
    .pipe(
        flatMap(() => mkdirMaybe(pathCompos.pathToSizeDir)),
        flatMap(() => appendFile(pathCompos.pathToIconfile, iconfileInfo.content, { flag: "w"})),
        mapTo(List.of(pathCompos.pathToIconfileInRepo))
    );
};

const updateIconfile: (pathToIconRepository: string, iconfileInfo: Iconfile) => Observable<List<string>>
= (pathToIconRepository, iconfileInfo) => {
    const pathCompos = getPathComponents1(pathToIconRepository, iconfileInfo);
    return appendFile(pathCompos.pathToIconfile, iconfileInfo.content, { flag: "w"})
    .pipe(mapTo(List.of(pathCompos.pathToIconfileInRepo)));
};

const renameIconfiles: (
    pathToIconRepository: string,
    oldIcon: IconDescriptor,
    newIcon: IconAttributes
) => Observable<List<string>> = (pathToIconRepository, oldIcon, newIcon) =>
    of(void 0)
    .pipe(
        flatMap(() => oldIcon.iconfiles.toArray()),
        flatMap(iconfileDesc => {
            const oldIconPaths: IconfilePathComponents = getPathComponents(
                pathToIconRepository, oldIcon.name, iconfileDesc.format, iconfileDesc.size);
            const newIconPaths: IconfilePathComponents = getPathComponents(
                pathToIconRepository, newIcon.name, iconfileDesc.format, iconfileDesc.size);
            return renameFile(oldIconPaths.pathToIconfile, newIconPaths.pathToIconfile)
            .pipe(mapTo(List.of(oldIconPaths.pathToIconfileInRepo, newIconPaths.pathToIconfileInRepo)));
        })
    );

const deleteIconfile: (
    pathToIconRepository: string,
    iconName: string,
    iconfileDesc: IconfileDescriptor
) => Observable<List<string>>
= (pathToIconRepository, iconName, iconfileDesc) => {
    const pathCompos = getPathComponents(
        pathToIconRepository,
        iconName,
        iconfileDesc.format,
        iconfileDesc.size
    );
    return deleteFile(pathCompos.pathToIconfile)
    .pipe(
        catchError((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") {
                throw new IconNotFound(pathCompos.pathToIconfile);
            } else {
                return observableThrowError(error);
            }
        }),
        mapTo(List.of(pathCompos.pathToIconfileInRepo))
    );
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

interface IconfileJobTextProviders {
    logContext: string;
    getCommitMessage: (filesChanged: List<string>) => string;
}

type CreateIconfileJob = (
    iconfileOperation: () => Observable<List<string>>,
    messages: IconfileJobTextProviders,
    userName: string,
    gitCommandExecutor: GitCommandExecutor
) => SerializableJobImpl;

const createIconfileJob: CreateIconfileJob = (iconfileOperation, jobTexts, userName, gitCommandExecutor) => {
    const ctxLogger = loggerFactory("git: " + jobTexts.logContext);
    return () => iconfileOperation()
    .pipe(
        flatMap(iconfilePathsInRepo => iconfilePathsInRepo.toArray()),
        flatMap(oneFilePathInRepo => gitCommandExecutor(addToIndex(oneFilePathInRepo)).pipe(mapTo(oneFilePathInRepo))),
        reduce<string, List<string>>(
            (fileList, oneIconfilePathInRepo) => fileList.push(oneIconfilePathInRepo),
            List<string>()
        ),
        flatMap(fileList => gitCommandExecutor(commit(jobTexts.getCommitMessage(fileList), userName))),
        map(() => ctxLogger.debug("Succeeded")),
        catchError(error => {
            ctxLogger.error(strformat("Failed: %o", error));
            gitCommandExecutor(rollback()[0])
            .pipe(
                flatMap(() => gitCommandExecutor(rollback()[1])),
                catchError(errorInRollback => {
                    ctxLogger.error(errorInRollback);
                    return "dummy return value";
                })
            );
            return observableThrowError(error);
        })
    );
};

type AddIconfile = (
    iconfileInfo: Iconfile,
    modifiedBy: string
) => Observable<void>;

type UpdateIconfile = (
    iconfileInfo: Iconfile,
    modifiedBy: string
) => Observable<void>;

type DeleteIconfile = (
    iconName: string,
    iconfileDesc: IconfileDescriptor,
    modifiedBy: string
) => Observable<void>;

type UpdateIcon = (
    oldIcon: IconDescriptor,
    newIcon: IconAttributes,
    modifiedBy: string
) => Observable<void>;

type DeleteIcon = (
    iconName: string,
    iconfileDescSet: Set<IconfileDescriptor>,
    modifiedBy: string
) => Observable<void>;

export interface GitAccessFunctions {
    readonly getRepoLocation: () => string;
    readonly isRepoInitialized: IsRepoInitialized;
    readonly createNewGitRepo: CreateNewGitRepo;
    readonly addIconfile: AddIconfile;
    readonly deleteIconfile: DeleteIconfile;
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

const createIconfileJobTextProviders: (
    logContext: string,
    getCommitMessage: (fileList: List<string>) => string
) => IconfileJobTextProviders
= (logContext, getCommitMessage) => ({logContext, getCommitMessage});

const gitAccessFunctionsProvider: GitAFsProvider = localIconRepositoryLocation => {
    const gitCommandExecutor: GitCommandExecutor = createGitCommandExecutor(localIconRepositoryLocation);

    return {
        getRepoLocation: () => localIconRepositoryLocation,

        isRepoInitialized: isRepoInitialized(localIconRepositoryLocation),

        createNewGitRepo: createNewGitRepo(localIconRepositoryLocation),

        addIconfile: (iconfileInfo, modifiedBy) => enqueueJob(
            createIconfileJob(
                () => createIconfile(localIconRepositoryLocation, iconfileInfo),
                createIconfileJobTextProviders("add icon file", defaultCommitMsgProvider("icon file(s) added")),
                modifiedBy,
                gitCommandExecutor
            )
        ),

        deleteIconfile: (iconName, iconfileDesc, modifiedBy) => enqueueJob(
            createIconfileJob(
                () => deleteIconfile(localIconRepositoryLocation, iconName, iconfileDesc),
                createIconfileJobTextProviders("delete icon file", defaultCommitMsgProvider("icon file(s) deleted")),
                modifiedBy,
                gitCommandExecutor
            )
        ),

        updateIcon: (oldIcon, newIcon, modifiedBy) => enqueueJob(
            createIconfileJob(
                () => renameIconfiles(localIconRepositoryLocation, oldIcon, newIcon),
                createIconfileJobTextProviders(
                    `update icon files for icon "${oldIcon.name}"`,
                    defaultCommitMsgProvider(
                        `icon file(s) for icon ${oldIcon.name} updated to ${JSON.stringify(newIcon)}`
                    )
                ),
                modifiedBy,
                gitCommandExecutor
            )
        ),

        deleteIcon: (iconName, iconfileDescSet, modifiedBy) => enqueueJob(
            createIconfileJob(
                () => of(void 0)
                .pipe(
                    flatMap(() => iconfileDescSet.toArray()),
                    flatMap(iconfileDesc => deleteIconfile(localIconRepositoryLocation, iconName, iconfileDesc))
                ),
                createIconfileJobTextProviders(
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
