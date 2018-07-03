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
type GetIconFile = (iconName: string, fileFormat: string, iconSize: string) => Observable<Buffer>;
type CreateIcon = (
    initialIconFileInfo: CreateIconInfo,
    modifiedBy: string) => Observable<number>;
type AddIconFile = (
    addIconFileRequestData: IconFile,
    modifiedBy: string) => Observable<number>;

export interface IconService {
    readonly getRepoConfiguration: GetIconRepoConfig;
    readonly getAllIcons: GetAllIcons;
    readonly getIcon: GetIcon;
    readonly getIconFile: GetIconFile;
    readonly createIcon: CreateIcon;
    readonly addIconFile: AddIconFile;
}

export const iconFormatListParser = csvSplitter;

export const iconSizeListParser = csvSplitter;

export interface IconRepoSettings {
    allowedFormats: string;
    allowedSizes: string;
}

const iconServiceProvider: (
    iconRepoSettings: IconRepoSettings,
    iconDAFs: IconDAFs,
    gitAFs: GitAccessFunctions
) => IconService
= (iconRepoConfig, iconDAFs, gitAFs) => {
    const getRepoConfiguration: GetIconRepoConfig = () => {
        return Observable.of({
            allowedFileFormats: iconFormatListParser(iconRepoConfig.allowedFormats),
            allowedIconSizes: iconSizeListParser(iconRepoConfig.allowedSizes)
        });
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

    const getIconFile: GetIconFile = (iconName, fileFormat, iconSize) =>
        iconDAFs.getIconFile(iconName, fileFormat, iconSize);

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
        getIcon,
        getIconFile,
        createIcon,
        addIconFile
    };
};

export default iconServiceProvider;
