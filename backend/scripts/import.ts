import * as path from "path";
import * as superagent from "superagent";
import { Server } from "http";
import { Observable, Observer } from "rxjs";

import {
    startServer,
    getURL,
    getURLBasicAuth,
    iconFileEndpointPath
} from "../integration-tests/api/api-test-utils";
import logger from "../src/utils/logger";
import { readdir, readFile } from "../src/utils/rx";
import { Set, List } from "immutable";
import configuration, { ConfigurationDataProvider, getDefaultConfiguration } from "../src/configuration";
import { createConnectionProperties, createPool } from "../src/db/db";
import { createSchema } from "./create-schema";
import { commandExecutor } from "../src/utils/command-executor";

const defaultSourceDir = path.resolve(
    __dirname,
    ".." /* exit "script" dir */,
    ".." /* exit "build" dir */,
    "demo-data");
const sourceDir = process.env.ICON_IMPORT_SOURCE_DIR || defaultSourceDir;
const createNewDB: boolean = process.env.CREATE_NEW_DB;

delete process.env.ICON_DATA_LOCATION_GIT;

const ctxLogger = logger.createChild("importer");

interface IconFileData {
    name: string;
    format: string;
    size: string;
    filePath: string;
}

const stripExtension = (fileName: string) => fileName.replace(/(.*)\.[^.]*$/, "$1");

const sourceDirProcessor: () => Observable<IconFileData>
= () => {
    return readdir(sourceDir)
    .flatMap(directoriesForFormats => directoriesForFormats)
    .flatMap(directoryForFormat =>
        readdir(path.join(sourceDir, directoryForFormat))
        .flatMap(directoriesForSizes => directoriesForSizes)
        .flatMap(directoryForSize =>
            readdir(path.join(sourceDir, directoryForFormat, directoryForSize))
            .flatMap(files => files)
            .map(file => ({
                name: stripExtension(file),
                format: directoryForFormat,
                size: directoryForSize,
                filePath: file
            }))));
};

const doesIconExist: (server: Server, iconName: string) => Observable<boolean>
= (server, iconName) => Observable.create((observer: Observer<boolean>) => {
    superagent
        .get(getURL(server, `/icons/${iconName}`)).auth("ux", "ux")
        .ok(res => res.status === 200 || res.status === 404)
        .then(
            response => {
                switch (response.status) {
                    case 200:
                        observer.next(true);
                        observer.complete();
                        break;
                    case 404:
                        observer.next(false);
                        observer.complete();
                        break;
                    default:
                        observer.error(`Failed to query icon ${iconName}: ${response.error}`);
                }
            },
            error => observer.error(error)
        )
        .catch(error => {
            observer.error(error);
        });
});

const addIconFile: (
    server: Server,
    iconName: string,
    format: string,
    size: string,
    content: Buffer,
    create: boolean) => Observable<void>
= (server, iconName, format, size, content, create) => Observable.create((observer: Observer<void>) => {
    const url: string = create
        ? getURLBasicAuth(server, "ux:ux", `/icons`)
        : getURLBasicAuth(server, "ux:ux", `/icons/${iconName}/formats/${format}/sizes/${size}`);

    const request = create
        ? superagent.post(url).field({name: iconName}).field({format}).field({size})
        : superagent.post(url);

    return request
    .attach("icon", content, iconName)
    .then(
        response => {
            if (response.status === 201) {
                observer.next(void 0);
            } else {
                observer.error(`Adding ${iconName} ${format} ${size} failed with error: ${response.error}`);
            }
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error));
});

let iconsProcessed = Set();

const processIconFile: (server: Server, data: IconFileData) => Observable<void>
= (server, iconFileData) => {
    ctxLogger.info("Processing icon file: %o", iconFileData);
    return readFile(path.join(sourceDir, iconFileData.format, iconFileData.size, iconFileData.filePath))
    .flatMap(content => (iconsProcessed.contains(iconFileData.name)
            ? Observable.of(true)
            : doesIconExist(server, iconFileData.name))
        .flatMap(iconExists => {
            iconsProcessed = iconsProcessed.add(iconFileData.name);
            return addIconFile(
                server,
                iconFileData.name,
                iconFileData.format,
                iconFileData.size,
                content,
                !iconExists);
        }));
}

const importIcons: (server: Server) => Observable<any> = server => {
    ctxLogger.info("Start importing from %s", sourceDir);
    return sourceDirProcessor()
    .flatMap(iconFileData => processIconFile(server, iconFileData));
};

// @WindowsUnfriendly
const createNewGitRepo: (location: string) => Observable<string>
= location => {
    const newGitRepoLogger = logger.createChild("create-new-git-repo");
    return commandExecutor(newGitRepoLogger, "rm", [ "-rf", location])
    .flatMap(() => commandExecutor(newGitRepoLogger, "mkdir", [ "-p", location ]))
    .flatMap(() => commandExecutor(newGitRepoLogger, "git", [ "init" ], { cwd: location }));
};

const createNewDBMaybe: (configProvider: ConfigurationDataProvider) => Observable<ConfigurationDataProvider>
= configProvider => {
    if (createNewDB) {
        return createPool(createConnectionProperties(configProvider()))
        .flatMap(pool => createSchema(pool)
            .finally(() => pool.end()))
        .flatMap(() => createNewGitRepo(configProvider().icon_data_location_git))
        .map(() => configProvider);
    } else {
        return Observable.of(configProvider);
    }
};

configuration
.flatMap(createNewDBMaybe)
.flatMap(configProvider => startServer(configProvider()))
.flatMap(server => {
    return importIcons(server)
    .finally(() => server.close());
})
.subscribe(
    void 0,
    error => ctxLogger.error("Importing icons failed: %o", error),
    () => ctxLogger.info("Import finshed")
);
