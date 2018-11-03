import { retryOnError } from "./rx";
import { interval, of } from "rxjs";
import { tap, map, catchError } from "rxjs/operators";
import { boilerplateSubscribe } from "../../integration-tests/testUtils";

describe("retryOnError", () => {
    it("should retry 'n' times", done => {
        const retryDelay = 200;
        const retryCount = 5;
        const errorCode = "TEST ERROR";
        let tryCount = 0;
        const source = interval(100);
        source.pipe(
            tap(val => {
                tryCount++;
                throw {code: errorCode};
            }),
            retryOnError(retryDelay, retryCount, errorCode),
            catchError(error => {
                return of(void 0);
            }),
            map(() => expect(tryCount).toEqual(retryCount))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should retry only on errors with specific error code", done => {
        const retryDelay = 200;
        const retryCount = 5;
        const nonRetryErrorIdx = 3;
        const errorCode = "TEST ERROR";
        let tryCount = 0;
        const source = interval(100);
        source.pipe(
            tap(val => {
                tryCount++;
                throw {code: tryCount < nonRetryErrorIdx ? errorCode : "something else"};
            }),
            retryOnError(retryDelay, retryCount, errorCode),
            catchError(error => {
                return of(void 0);
            }),
            map(() => expect(tryCount).toEqual(nonRetryErrorIdx))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
