import { retryOnError } from "./rx";
import { interval, of } from "rxjs";
import { tap, map, catchError } from "rxjs/operators";
import { boilerplateSubscribe } from "../../integration-tests/testUtils";

describe("retryOnError", () => {
    it("should retry 'n' times", done => {
        const retryDelay = 200;
        const expectedRetryCount = 5;
        const errorCodeToRetryOn = "TEST ERROR";
        const expectedFinalErrorCode = errorCodeToRetryOn;
        let actualRetryCount = -1; // The first increment (to 0) won't be an actual REtry yet
        let finalThrownErrorChecked = false;
        const source = interval(100);
        source.pipe(
            tap(val => {
                actualRetryCount++;
                throw {code: errorCodeToRetryOn};
            }),
            retryOnError(retryDelay, expectedRetryCount, errorCodeToRetryOn),
            catchError(error => {
                finalThrownErrorChecked = true;
                expect(error).toEqual({code: expectedFinalErrorCode});
                return of(error);
            }),
            map(() => expect(actualRetryCount).toEqual(expectedRetryCount)),
            map(() => expect(finalThrownErrorChecked).toBeTruthy())
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should retry only on errors with specific error code", done => {
        const retryDelay = 200;
        const retryCount = 5;
        const nonRetryErrorIdx = 3;
        const errorCodeToRetryOn = "TEST ERROR";
        const expectedFinalErrorCode = "something else";
        let tryCount = 0;
        const source = interval(100);
        source.pipe(
            tap(val => {
                tryCount++;
                throw {code: tryCount < nonRetryErrorIdx ? errorCodeToRetryOn :  expectedFinalErrorCode};
            }),
            retryOnError(retryDelay, retryCount, errorCodeToRetryOn),
            catchError(error => {
                expect(error).toEqual({code: expectedFinalErrorCode});
                return of(void 0);
            }),
            map(() => expect(tryCount).toEqual(nonRetryErrorIdx))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
