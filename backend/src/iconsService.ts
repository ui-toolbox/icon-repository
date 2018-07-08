import * as fs from "fs";
import * as path from "path";
import * as express from "express";
import { List, Map } from "immutable";
import * as Rx from "rxjs/Rx";

import { IIconFile } from "./icon";
import { IIconDAFs } from "./db/db";
import { IGitAccessFunctions } from "./git";
import logger, { ContextAbleLogger } from "./utils/logger";
import { toBase64, fromBase64 } from "./utils/encodings";
import csvSplitter from "./utils/csvSplitter";
import { ConfigurationDataProvider } from "./configuration";

const stripExtension = (fileName: string) => fileName.replace(/(.*)\.[^.]*$/, "$1");

const readdir: (path: string) => Rx.Observable<string[]> = Rx.Observable.bindNodeCallback(fs.readdir);
const readFile: (path: string) => Rx.Observable<Buffer> = Rx.Observable.bindNodeCallback(fs.readFile);

const debugIconFileNames = (ctxLogger: ContextAbleLogger, filesOfSize: string[]) => filesOfSize
    .forEach(file => {
        ctxLogger.silly("file=", file);
    });

interface IIconRepoConfig {
    readonly allowedFileFormats: List<string>;
    readonly allowedIconSizes: List<string>;
}

class IconInfo {
    public static create: (name: string, size: string, pathToFile: string) => IconInfo = (name, size, pathToFile) => {
        return new IconInfo(name, Map.of(size, pathToFile), null);
    }

    private readonly name: string;
    private readonly paths: Map<string, string>;
    private readonly tags: List<string>;

    constructor(
        name: string,
        size2path: Map<string, string>,
        tags: List<string>
    ) {
        this.name = name;
        this.paths = size2path;
        this.tags = tags;
    }
}

interface IIconFileData {
    readonly fileFormat: string;
    readonly fileData: Buffer;
}

type GetIconRepoConfig = () => Rx.Observable<IIconRepoConfig>;
type GetIcons = () => Rx.Observable<IconInfo[]>;
type GetIcon = (encodeIconPath: string) => Rx.Observable<IIconFileData>;
type GetIconFile = (iconId: number, fileFormat: string, iconSize: string) => Rx.Observable<Buffer>;
type CreateIcon = (
    initialIconFileInfo: IIconFile,
    username: string) => Rx.Observable<number>;
export interface IIconService {
    readonly getRepoConfiguration: GetIconRepoConfig;
    readonly getIcons: GetIcons;
    readonly getIcon: GetIcon;
    readonly getIconFile: GetIconFile;
    readonly createIcon: CreateIcon;
}

export const iconFormatListParser = csvSplitter;

export const iconSizeListParser = csvSplitter;

const iconServiceProvider: (
    appConfig: ConfigurationDataProvider,
    iconDAFs: IIconDAFs,
    gitAFs: IGitAccessFunctions
) => IIconService
= (appConfig, iconDAFs, gitAFs) => {

    const getRepoConfiguration: GetIconRepoConfig = () => {
        return Rx.Observable.of({
            allowedFileFormats: iconFormatListParser(appConfig().icon_data_allowed_formats),
            allowedIconSizes: iconSizeListParser(appConfig().icon_data_allowed_sizes)
        });
    };

    const getIcons: GetIcons = () => {
        const ctxLogger = logger.createChild("getAllIcons");
        const iconRepo: string = gitAFs.getRepoLocation(); // TODO: retrieve icons from the db instead of from git
        ctxLogger.debug(`Getting icons from file://${iconRepo}`);
        return readdir(iconRepo)
            .flatMap(directoriesBySize => directoriesBySize)
                .filter(directoryForSize => directoryForSize.toUpperCase() === "SVG")
                .flatMap(directoryForSize => readdir(path.join(iconRepo, directoryForSize))
                    .do(filesOfSize => debugIconFileNames(ctxLogger, filesOfSize))
                    .map(filesOfSize => filesOfSize
                        .map(file => IconInfo.create(
                            stripExtension(file),
                            "SVG",
                            "/icon/" + toBase64(path.join(iconRepo, directoryForSize, file))
                        ))
                    )
                );
    };

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
        iconDAFs.getIconFileFromDB(iconId, fileFormat, iconSize);

    const createIcon: CreateIcon = (iconfFileInfo, modifiedBy) =>
        iconDAFs.addIconToDB(
            iconfFileInfo,
            modifiedBy,
            () => gitAFs.addIconFile(iconfFileInfo, modifiedBy));

    const decodeIconPath = (encodedIconPath: string) => fromBase64(encodedIconPath);

    return {
        getRepoConfiguration,
        getIcons,
        getIcon,
        getIconFile,
        createIcon
    };
};

export default iconServiceProvider;
