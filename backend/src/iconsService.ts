import * as fs from "fs";
import * as path from "path";
import { List, Set } from "immutable";
import { Observable } from "rxjs/Rx";

import { CreateIconInfo, IconFile, IconDescriptor } from "./icon";
import { IconDAFs } from "./db/db";
import { GitAccessFunctions } from "./git";
import logger, { ContextAbleLogger } from "./utils/logger";
import { fromBase64 } from "./utils/encodings";
import csvSplitter from "./utils/csvSplitter";
import { ConfigurationDataProvider } from "./configuration";

const stripExtension = (fileName: string) => fileName.replace(/(.*)\.[^.]*$/, "$1");

const readdir: (path: string) => Observable<string[]> = Observable.bindNodeCallback(fs.readdir);
const readFile: (path: string) => Observable<Buffer> = Observable.bindNodeCallback(fs.readFile);

const debugIconFileNames = (ctxLogger: ContextAbleLogger, filesOfSize: string[]) => filesOfSize
    .forEach(file => {
        ctxLogger.silly("file=", file);
    });

interface IconRepoConfig {
    readonly allowedFileFormats: List<string>;
    readonly allowedIconSizes: List<string>;
}

interface IconFileData {
    readonly fileFormat: string;
    readonly fileData: Buffer;
}

type GetIconRepoConfig = () => Observable<IconRepoConfig>;
export type GetAllIcons = () => Observable<List<IconDescriptor>>;
type GetIcon = (encodeIconPath: string) => Observable<IconFileData>;
type GetIconFile = (iconId: number, fileFormat: string, iconSize: string) => Observable<Buffer>;
type CreateIcon = (
    initialIconFileInfo: CreateIconInfo,
    modifiedBy: string) => Observable<number>;
type AddIconFile = (
    addIconFileRequestData: IconFile,
    modifiedBy: string) => Observable<number>;
export interface IconService {
    readonly getRepoConfiguration: GetIconRepoConfig;
    readonly getAllIconsFromGit: GetAllIcons;
    readonly getAllIcons: GetAllIcons;
    readonly getIcon: GetIcon;
    readonly getIconFile: GetIconFile;
    readonly createIcon: CreateIcon;
    readonly addIconFile: AddIconFile;
}

export const iconFormatListParser = csvSplitter;

export const iconSizeListParser = csvSplitter;

const iconServiceProvider: (
    appConfig: ConfigurationDataProvider,
    iconDAFs: IconDAFs,
    gitAFs: GitAccessFunctions
) => IconService
= (appConfig, iconDAFs, gitAFs) => {

    const getRepoConfiguration: GetIconRepoConfig = () => {
        return Observable.of({
            allowedFileFormats: iconFormatListParser(appConfig().icon_data_allowed_formats),
            allowedIconSizes: iconSizeListParser(appConfig().icon_data_allowed_sizes)
        });
    };

    const getAllIconsFromGit: GetAllIcons = () => {
        const ctxLogger = logger.createChild("getAllIcons");
        const iconRepo: string = gitAFs.getRepoLocation(); // TODO: retrieve icons from the db instead of from git
        ctxLogger.debug(`Getting icons from file://${iconRepo}`);
        return readdir(iconRepo)
            .flatMap(directoriesBySize => directoriesBySize)
            .filter(directoryForSize => directoryForSize.toUpperCase() === "SVG")
            .flatMap(directoryForSize => readdir(path.join(iconRepo, directoryForSize)))
            .do(filesOfSize => debugIconFileNames(ctxLogger, filesOfSize))
            .flatMap(filesOfSize => filesOfSize
                .map(file => new IconDescriptor(
                        1,
                        stripExtension(file),
                        Set.of({
                            format: "svg",
                            size: "1x",
                            file
                        })
                    )
                )
                .map(iconDescriptorArray => List(iconDescriptorArray))
            );
    };

    const getAllIcons: GetAllIcons = () => iconDAFs.getAllIcons();

    const getIcon: GetIcon = encodeIconPath => {
        const ctxLogger = logger.createChild("Get icon file " + encodeIconPath);
        ctxLogger.silly(decodeIconPath(encodeIconPath));
        return readFile(decodeIconPath(encodeIconPath))
            // .do(data => ctxLogger.debug("fileformat=svg"))
            .map(data => ({
                fileFormat: "svg",
                fileData: data
            }));
    };

    const getIconFile: GetIconFile = (iconId, fileFormat, iconSize) =>
        iconDAFs.getIconFile(iconId, fileFormat, iconSize);

    const createIcon: CreateIcon = (iconfFileInfo, modifiedBy) =>
        iconDAFs.createIcon(
            iconfFileInfo,
            modifiedBy,
            () => gitAFs.addIconFile(iconfFileInfo, modifiedBy));

    const addIconFile: AddIconFile = (addIconFileRequestData, modifiedBy) =>
        iconDAFs.addIconFileToIcon(addIconFileRequestData, modifiedBy);

    const decodeIconPath = (encodedIconPath: string) => fromBase64(encodedIconPath);

    return {
        getRepoConfiguration,
        getAllIcons,
        getAllIconsFromGit,
        getIcon,
        getIconFile,
        createIcon,
        addIconFile
    };
};

export default iconServiceProvider;
