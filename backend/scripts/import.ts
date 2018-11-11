import { format as strformat } from "util";
import * as path from "path";
import * as superagent from "superagent";
import { Observable, Observer, of } from "rxjs";
import { flatMap, map, finalize } from "rxjs/operators";

import {
    startServer,
    getBaseUrl,
    Session
} from "../integration-tests/api/api-test-utils";
import loggerFactory from "../src/utils/logger";
import { readdir, readFile } from "../src/utils/rx";
import configuration from "../src/configuration";
import { create as createSerializer } from "../src/utils/serializer";
import { Set } from "immutable";
import { describeIcon } from "../integration-tests/api/api-client";

const defaultSourceDir = path.resolve(
    __dirname,
    ".." /* exit "script" dir */,
    ".." /* exit "build" dir */,
    "demo-data");
const sourceDir = process.env.ICON_IMPORT_SOURCE_DIR || defaultSourceDir;

delete process.env.ICON_DATA_LOCATION_GIT;

const ctxLogger = loggerFactory("importer");

interface SourceFileDescriptor {
    name: string;
    format: string;
    size: string;
    filePath: string;
}

const stripExtension = (fileName: string) => fileName.replace(/(.*)\.[^.]*$/, "$1");

const iconfileCollector: () => Observable<SourceFileDescriptor>
= () => {
    return readdir(sourceDir)
    .pipe(
        flatMap(directoriesForFormats => directoriesForFormats),
        flatMap(directoryForFormat =>
            readdir(path.join(sourceDir, directoryForFormat))
            .pipe(
                flatMap(directoriesForSizes => directoriesForSizes),
                flatMap(directoryForSize =>
                    readdir(path.join(sourceDir, directoryForFormat, directoryForSize))
                    .pipe(
                        flatMap(files => files),
                        map(file => ({
                            name: stripExtension(file),
                            format: directoryForFormat,
                            size: directoryForSize,
                            filePath: file
                        }))
                    ))
            ))
    );
};

const createSession = () => new Session(
    getBaseUrl(),
    superagent,
    {
        user: "ux",
        password: "ux"
    },
    void 0
);

const doesIconExist: (iconName: string) => Observable<boolean>
= iconName =>
    describeIcon(
        createSession().requestBuilder(),
        iconName
    )
    .pipe(map(icon => !!icon));

const addIconfile: (
    iconName: string,
    format: string,
    size: string,
    content: Buffer,
    create: boolean) => Observable<void>
= (iconName, format, size, content, create) => Observable.create((observer: Observer<void>) => {
    const url: string = create
        ? `/icon`
        : `/icon/${iconName}`;

    const request = create
        ? createSession().requestBuilder().post(url).field({name: iconName})
        : createSession().requestBuilder().post(url);

    return request
    .attach("icon", content, iconName)
    .then(
        response => {
            if (create && response.status === 201 || response.status === 200) {
                const message = create
                    ? `"${iconName}" created with ${format} ${size}`
                    : `${format} ${size} added to "${iconName}"`;
                ctxLogger.info(message);
                observer.next(void 0);
                observer.complete();
            } else {
                const errorMessage = create
                    ? strformat("Creating \"%s\" with %s %s failed: %o", iconName, format, size, response.error)
                    : strformat("Adding %s %s to \"%s\" failed with %o", format, size, iconName, response.error);
                observer.error(errorMessage);
            }
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error));
});

const enqueueJob = createSerializer("I M P O R T");
let existingIcons: Set<string> = Set();

const readAndUploadIconfile: (descriptor: SourceFileDescriptor) => Observable<void>
= descriptor => {
    ctxLogger.debug("Processing icon file: %o", descriptor);
    return readFile(path.join(sourceDir, descriptor.format, descriptor.size, descriptor.filePath))
    .pipe(
        flatMap(content =>
            (existingIcons.contains(descriptor.name)
                ? of(true)
                : doesIconExist(descriptor.name))
            .pipe(
                flatMap(iconExists => {
                    existingIcons = existingIcons.add(descriptor.name);
                    return addIconfile(
                        descriptor.name,
                        descriptor.format,
                        descriptor.size,
                        content,
                        !iconExists
                    );
                })
            ))
    );
};

const importIcons: () => Observable<any> = () => {
    ctxLogger.info("Start importing from %s", sourceDir);
    return iconfileCollector()
    .pipe(
        flatMap(iconfileData => enqueueJob(() => readAndUploadIconfile(iconfileData)))
    );
};

configuration
.pipe(
    flatMap(configProvider => startServer(configProvider)),
    flatMap(server => {
        return importIcons()
        .pipe(
            finalize(() => server.close)
        );
    })
)
.subscribe(
    void 0,
    error => {
        ctxLogger.error(strformat("Importing icons failed: %o", error));
        process.exit(1);
    },
    () => {
        ctxLogger.info("Import finshed");
        process.exit(0);
    }
);
