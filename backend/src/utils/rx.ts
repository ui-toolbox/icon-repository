import * as fs from "fs";
import * as rimraf from "rimraf";
import { Observable, Observer } from "rxjs";

export const fileExists: (pathToFile: string) => Observable<boolean> = Observable.bindCallback(fs.exists);

const readFile: (pathToFile: string, callback: (err: NodeJS.ErrnoException, data: string) => void) => void
= (pathToFile, callback) => fs.readFile(pathToFile, "utf8", callback);

export const readTextFile: (pathToFile: string) => Observable<string> = Observable.bindNodeCallback(readFile);

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

/*
 * @return an Observable for path to the directory at issue
 */
export const mkdirMaybe: (pathToDir: string) => Observable<string>
= pathToDir => stat(pathToDir)
    .flatMap(stats => {
        if (stats) {
            if (!stats.isDirectory()) {
                throw Error(`File exists, but it is not a directory: ${pathToDir}`);
            }
        } else {
            return mkdir(pathToDir);
        }
        return Observable.of(void 0);
    })
    .mapTo(pathToDir);

export const rmdirMaybe: (pathToDir: string) => Observable<string>
= pathToDir => stat(pathToDir)
    .flatMap(stats => {
        if (stats) {
            if (!stats.isDirectory()) {
                throw Error(`File exists, but it is not a directory: ${pathToDir}`);
            } else {
                return rmdir(pathToDir);
            }
        }
        return Observable.of(void 0);
    });

export const appendFile: (pathToFile: string, data: Buffer, options: {
    encoding?: string,
    mode?: number,
    flag?: string
}) => Observable<string>
= (pathToFile, data, options) => Observable.create((observer: Observer<string>) =>
    fs.appendFile(pathToFile, data, (err: NodeJS.ErrnoException) => {
        if (err) {
            observer.error(err);
        } else {
            observer.next(pathToFile);
            observer.complete();
        }
    }));

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
