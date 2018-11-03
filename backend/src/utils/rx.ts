import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";
import { Observable, Observer, bindCallback, bindNodeCallback, of, throwError, concat } from "rxjs";
import { flatMap, map, mapTo, catchError, retryWhen, delay, take, tap, takeWhile } from "rxjs/operators";
import loggerFactory from "./logger";

export const fileExists: (pathToFile: string) => Observable<boolean> = bindCallback(fs.exists);

const readFileUTF8: (pathToFile: string, callback: (err: NodeJS.ErrnoException, data: string) => void) => void
= (pathToFile, callback) => fs.readFile(pathToFile, "utf8", callback);

export const readTextFile: (pathToFile: string) => Observable<string> = bindNodeCallback(readFileUTF8);

export const readdir: (path: string) => Observable<string[]> = bindNodeCallback(fs.readdir);
export const readFile: (path: string) => Observable<Buffer> = bindNodeCallback(fs.readFile);

export const stat: (pathToDir: string) => Observable<fs.Stats>
= pathToDir => Observable.create((observer: Observer<fs.Stats>) =>
    fs.stat(pathToDir, (err: NodeJS.ErrnoException, stats: fs.Stats) => {
        let result: fs.Stats;
        if (err) {
            if (err.code === "ENOENT") {
                result = null;
            } else {
                observer.error(err);
            }
        } else {
            result = stats;
        }
        observer.next(result);
        observer.complete();
    }));

export const mkdir = (pathToDir: string) => Observable.create((observer: Observer<void>) => {
    fs.mkdir(pathToDir, (err: NodeJS.ErrnoException) => {
        if (err) {
            observer.error(err);
        } else {
            observer.next(void 0);
            observer.complete();
        }
    });
});
export const rmdir: (pathToDir: string) => Observable<string>
= pathToDir => Observable.create((observer: Observer<string>) => {
    rimraf(pathToDir, (err: NodeJS.ErrnoException) => {
        if (err) {
            observer.error(err);
        } else {
            observer.next(pathToDir);
            observer.complete();
        }
    });
});

export const hasSubDirectory: (pathToParentDir: string, childDir: string) => Observable<boolean>
= (pathToParentDir, childDir) =>
    stat(pathToParentDir)
    .pipe(
        flatMap(parentStats =>
            !parentStats || !parentStats.isDirectory()
                ? of(false)
                : stat(path.resolve(pathToParentDir, childDir))
                    .pipe(
                        map(childStats =>
                            childStats
                                ? childStats.isDirectory()
                                : false)
                    ))
    );

/*
 * @return an Observable for path to the directory at issue
 */
export const mkdirMaybe: (pathToDir: string) => Observable<string>
= pathToDir => stat(pathToDir)
    .pipe(
        flatMap(stats => {
            if (stats) {
                if (!stats.isDirectory()) {
                    throw Error(`File exists, but it is not a directory: ${pathToDir}`);
                }
            } else {
                return mkdir(pathToDir);
            }
            return of(void 0);
        }),
        mapTo(pathToDir)
    );

export const rmdirMaybe: (pathToDir: string) => Observable<string>
= pathToDir => stat(pathToDir)
    .pipe(
        flatMap(stats => {
            if (stats) {
                if (!stats.isDirectory()) {
                    throw Error(`File exists, but it is not a directory: ${pathToDir}`);
                } else {
                    return rmdir(pathToDir);
                }
            }
            return of(void 0);
        })
    );

export const appendFile: (pathToFile: string, data: Buffer, options: {
    encoding?: string,
    mode?: number,
    flag?: string
}) => Observable<string>
= (pathToFile, data, options) => Observable.create((observer: Observer<string>) =>
    fs.appendFile(pathToFile, data, options, (err: NodeJS.ErrnoException) => {
        if (err) {
            observer.error(err);
        } else {
            observer.next(pathToFile);
            observer.complete();
        }
    }));

export const deleteFile: (pathToFile: string) => Observable<void>
= pathToFile => Observable.create((observer: Observer<void>) =>
    fs.unlink(pathToFile, (error: NodeJS.ErrnoException) => {
        if (error) {
            observer.error(error);
        } else {
            observer.next(void 0);
            observer.complete();
        }
    })
);

export const renameFile: (oldPath: string, newPath: string) => Observable<void>
= (oldPath, newPath) => Observable.create((observer: Observer<void>) => {
    fs.rename(oldPath, newPath, error => {
        if (error) {
            observer.error(error);
        } else {
            observer.next(void 0);
            observer.complete();
        }
    });
});

export const moveFile: (
    source: string,
    target: string
) => Observable<void>
= (source, target) => Observable.create((observer: Observer<void>) => {
    fs.rename(
        source,
        target,
        (err: NodeJS.ErrnoException) => {
            if (err) {
                observer.error(err);
            } else {
                observer.next(void 0);
                observer.complete();
            }
        }
    );
});

const retryOnErrorLogger = loggerFactory("rx-retryOnError");

export const retryOnError: (
    delayMsecs: number,
    retryCount: number,
    errorCode: string
) => <T>(source: Observable<T>) => Observable<T>
= (delayMsecs, retryCount, errorCode) => source => {
    return source.pipe(
        retryWhen(error => concat(
            error
            .pipe(
                takeWhile(err => err.code === errorCode),
                tap(err => retryOnErrorLogger.warn("Retrying on %s", err.code)),
                delay(delayMsecs),
                take(retryCount)
            ),
            throwError(error)
        ))
    );
};
