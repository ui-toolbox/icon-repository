import * as util from "util";
import fetch from "node-fetch";
import { Observable, Observer } from "rxjs";

import loggerFactory from "./logger";
import { throwErrorWOStackTrace } from "./error-handling";

export default <T> (
    url: string,
    method: string,
    headers: {[key: string]: string},
    data: any,
    responseIsJSON: boolean = true
) => Observable.create((observer: Observer<T>) => {
const log = loggerFactory("util#doFetch");
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
