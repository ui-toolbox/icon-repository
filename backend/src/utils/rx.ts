import { promisify } from "util";

import * as path from "path";
import * as _rimraf from "rimraf";
const rimraf = promisify(_rimraf);
import loggerFactory from "./logger";

import * as fs from "fs";
import { delay } from "lodash";
export const stat = promisify(fs.stat);
export const mkdir = promisify(fs.mkdir);
export const readFile = promisify(fs.readFile);
const _appendFile = promisify(fs.appendFile);
export const renameFile = promisify(fs.rename);
export const moveFile = renameFile;
export const deleteFile = promisify(fs.unlink);

export const fileExists = async (pathToFile: string): Promise<boolean> => {
    try {
        await stat(pathToFile);
        return true;
    } catch (err) {
        if (err.code === "ENONENT") {
            return false;
        } else {
            throw err;
        }
    }
}

export const readTextFile = async (pathToFile: string) => readFile(pathToFile, "utf8");
export const rmdir = async (pathToDir: string) => rimraf(pathToDir);

export const hasSubDirectory = async (pathToParentDir: string, childDir: string): Promise<boolean> => {
    const parentStats = await stat(pathToParentDir)
    if (!parentStats || !parentStats.isDirectory()) {
        return false;
    }
    const childStats = await stat(path.resolve(pathToParentDir, childDir));
    return childStats
        ? childStats.isDirectory()
        : false;
};

export const mkdirMaybe = async (pathToDir: string): Promise<string> => {
    const dirStats = await stat(pathToDir);
    if (dirStats) {
        if (!dirStats.isDirectory()) {
            throw Error(`File exists, but it is not a directory: ${pathToDir}`);
        }
    } else {
        await mkdir(pathToDir);
        return pathToDir;
    }
    return pathToDir;
}

export const rmdirMaybe = async (pathToDir: string): Promise<string> => {
    const dirStats = await stat(pathToDir);
    if (dirStats) {
        if (!dirStats.isDirectory()) {
            throw Error(`File exists, but it is not a directory: ${pathToDir}`);
        } else {
            await rmdir(pathToDir);
            return pathToDir;
        }
    }
}

export const appendFile = async (pathToFile: string, data: Buffer, options: fs.WriteFileOptions): Promise<string> => {
    await _appendFile(pathToFile, data, options)
    return pathToFile;
}

const retryOnErrorLogger = loggerFactory("rx-retryOnError");

export const retryOnError = async <T> (
    action: () => Promise<void>,
    delayMsecs: number,
    retryCount: number,
    errorCodeToRetryOn: string
): Promise<void> => {
    let count = 0;
    while (true) {
        count++;
        try {
            await action();
        } catch (err) {
            if (err.code === errorCodeToRetryOn && count < retryCount) {
                await new Promise(resolve => setTimeout(resolve, delayMsecs));
                continue;
            } else {
                throw err;
            }
        }
    }
};
