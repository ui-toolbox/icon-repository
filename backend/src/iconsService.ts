import * as fs from "fs";
import * as path from "path";
import * as express from "express";
import { List, Map } from "immutable";
import * as Rx from "rxjs/Rx";

import * as appUtil from "./util";
import logger, { ContextAbleLogger } from "./logger";

const stripExtension = (fileName: string) => fileName.replace(/(.*)\.[^.]*$/, "$1");

const readdir: (path: string) => Rx.Observable<string[]> = Rx.Observable.bindNodeCallback(fs.readdir);
const readFile: (path: string) => Rx.Observable<Buffer> = Rx.Observable.bindNodeCallback(fs.readFile);

const debugIconFileNames = (ctxLogger: ContextAbleLogger, filesOfSize: string[]) => filesOfSize
    .forEach(file => {
        ctxLogger.silly("file=", file);
    });

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

interface IIconData {
    fileFormat: string;
    fileData: Buffer;
}

type GetAllowedIconFormats = () => Rx.Observable<string[]>;
type GetIcons = () => Rx.Observable<IconInfo[]>;
type GetIcon = (encodeIconPath: string) => Rx.Observable<IIconData>;
export interface IIconService {
    getAllowedIconFormats: GetAllowedIconFormats;
    getIcons: GetIcons;
    getIcon: GetIcon;
}

export const iconFormatListParser: (list: string) => string[]
= list => list.split(/[\s]*,[\s]*/).map(format => format.trim());

const iconServiceProvider: (allowedIconFormats: string, iconRepositoryLocation: string) => IIconService
= (allowedIconFormats, iconRepositoryLocation) => {

    const getAllowedIconFormats: GetAllowedIconFormats = () => {
        return Rx.Observable.of(iconFormatListParser(allowedIconFormats));
    };

    const getIcons: GetIcons = () => {
        const ctxLogger = logger.createChild("getAllIcons");
        ctxLogger.debug("BEGIN");
        const iconRepo = iconRepositoryLocation;
        return readdir(iconRepo)
            .flatMap(directoriesBySize => directoriesBySize)
                .filter(directoryForSize => directoryForSize.toUpperCase() === "SVG")
                .flatMap(directoryForSize => readdir(path.join(iconRepo, directoryForSize))
                    .do(filesOfSize => debugIconFileNames(ctxLogger, filesOfSize))
                    .map(filesOfSize => filesOfSize
                        .map(file => IconInfo.create(
                            stripExtension(file),
                            "SVG",
                            "/icon/" + appUtil.toBase64(path.join(iconRepo, directoryForSize, file))
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

    const decodeIconPath = (encodedIconPath: string) => appUtil.fromBase64(encodedIconPath);

    return {
        getAllowedIconFormats,
        getIcons,
        getIcon
    };
};

export default iconServiceProvider;
