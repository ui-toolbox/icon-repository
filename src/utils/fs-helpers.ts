import * as fs from "fs";
import * as path from "path";
import { mkdir, rm, stat, unlink } from "fs/promises";
import { isNil } from "lodash";
import { createLogger } from "./logger";

const logger = createLogger("fs-helpers");

export const hasSubDirectory = async (pathToParentDir: string, childDir: string): Promise<boolean> => {
	try {
		const parentStats = await stat(pathToParentDir);
		if (!parentStats?.isDirectory()) {
			return false;
		}
		const childStats = await stat(path.resolve(pathToParentDir, childDir));
		return childStats.isDirectory();
	} catch (err) {
		if (err.code === "ENOENT") {
			return false;
		}
		throw err;
	}
};

/*
 * @return an Observable for path to the directory at issue
 */
export const mkdirMaybe = async (pathToDir: string): Promise<void> => {
	try {
		const stats = await stat(pathToDir);
		if (!isNil(stats)) {
			if (!stats.isDirectory()) {
				throw Error(`File exists, but it is not a directory: ${pathToDir}`);
			}
		}
	} catch (err) {
		logger.debug("#mkdirMaybe: err: %o", err);
		if (err.code === "ENOENT") {
			await mkdir(pathToDir);
		} else {
			throw err;
		}
	}
};

export const rmdirMaybe = async (pathToDir: string): Promise<void> => {
	try {
		const stats = await stat(pathToDir);
		if (!stats.isDirectory()) {
			throw Error(`File exists, but it is not a directory: ${pathToDir}`);
		}
		await rm(pathToDir, { recursive: true, force: true });
	} catch (err) {
		if (err.code !== "ENOENT") {
			throw err;
		}
	}
};

export const appendFile = async (pathToFile: string, data: Buffer, options: fs.WriteFileOptions): Promise<void> => {
	await new Promise((resolve, reject) => {
		fs.appendFile(pathToFile, data, options, (err: NodeJS.ErrnoException) => {
			if (isNil(err)) {
				resolve(undefined);
			} else {
				reject(err);
			}
		});
	});
};

export const deleteFile = async (pathToFile: string): Promise<void> => {
	await unlink(pathToFile);
};

export const renameFile = async (oldPath: string, newPath: string): Promise<void> => {
	await new Promise((resolve, reject) => {
		fs.rename(oldPath, newPath, error => {
			if (isNil(error)) {
				resolve(undefined);
			} else {
				reject(error);
			}
		});
	});
};

export const moveFile = async (source: string, target: string): Promise<void> => {
	await new Promise((resolve, reject) => {
		fs.rename(source, target, (err: NodeJS.ErrnoException) => {
			if (isNil(err)) {
				resolve(undefined);
			} else {
				reject(err);
			}
		}
		);
	});
};

export const retryOnError = async (
	delayMsecs: number,
	retryCount: number,
	allowedErrorCode: string,
	what: () => Promise<void>
): Promise<void> => {
	const retryLogger = createLogger("retryOnError");
	for (let retryCountSoFar = 0; retryCountSoFar < retryCount; retryCountSoFar++) {
		try {
			await what();
			break;
		} catch (err) {
			retryLogger.error("...while trying...");
			if (err.code === allowedErrorCode) {
				retryLogger.info("retrying in delayMsecs...");
				await new Promise(resolve => setTimeout(resolve, delayMsecs));
			} else {
				retryLogger.info("unacceptable error, backing out...");
				throw err;
			}
		}
	}
};
