import * as crypto from "crypto";
import * as fs from "fs";
import * as util from "util";
import * as express from "express";
import * as Rx from "rxjs/Rx";
import fetch from "node-fetch";
import logger from "./logger";

export const throwErrorWOStackTrace: (errorMessage: string) => void
= errorMessage => {
    const error = new Error(errorMessage);
    logger.createChild("util#throwErrorWOStackTrace").error("", error.stack);
    delete error.stack;
    throw error.message;
};

export const toBase64: (source: string) => string = source => Buffer.from(source).toString("base64");
export const fromBase64: (b64string: string) => string = b64string => Buffer.from(b64string, "base64").toString("utf8");

export const fileExists: (pathToFile: string) => Rx.Observable<boolean> = Rx.Observable.bindCallback(fs.exists);

const readFile: (pathToFile: string, callback: (err: NodeJS.ErrnoException, data: string) => void) => void
= (pathToFile, callback) => fs.readFile(pathToFile, "utf8", callback);

export const readTextFile: (pathToFile: string) => Rx.Observable<string> = Rx.Observable.bindNodeCallback(readFile);

export const doFetch = <T> (
        url: string,
        method: string,
        headers: {[key: string]: string},
        data: any,
        responseIsJSON: boolean = true
) => Rx.Observable.create((observer: Rx.Observer<T>) => {
    const log = logger.createChild("util#doFetch");
    fetch(url, {
        method,
        headers,
        body: data
    })
    .then(
        response => {
            if (response.status < 200 || response.status >= 300) {
                log.error("Request failed: ", url, response.status);
                observer.error(response.status);
                throwErrorWOStackTrace(util.format(
                    "Request to %s failed with %o", url, response.status
                ));
            } else {
                if (responseIsJSON) {
                    return response.json();
                } else {
                    return Promise.resolve(response.body);
                }
            }
        },
        error => {
            log.error("Request failed: ", url, error);
            observer.error(error);
        }
    )
    .then(
        json => {
            observer.next(json);
            observer.complete();
        },
        error => observer.error(error)
    );
});

export const randomstring: (length?: number) => string
= length => crypto.randomBytes(length ? length : 32).toString("hex");

export type LogoutSuccessHandler = (req: express.Request, res: express.Response) => void;
