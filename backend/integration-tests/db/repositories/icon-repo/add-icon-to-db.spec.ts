import * as crypto from "crypto";
import { of } from "rxjs";

import {
    getCheckIconfile,
    assertIconCount,
    manageTestResourcesBeforeAndAfter
 } from "../../db-test-utils";
import { Iconfile } from "../../../../src/icon";
import { boilerplateSubscribe } from "../../../testUtils";
import { setEnvVar } from "../../../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../../../src/git";
import { createIcon, getIconfile } from "../../../../src/db/repositories/icon-repo";
import { map, flatMap, tap, catchError } from "rxjs/operators";

describe("addIconToDB", () => {

    const getPool = manageTestResourcesBeforeAndAfter();

    it("should be capable to add a first icon", done => {
        const user = "zazie";
        const iconfileInfo: Iconfile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        createIcon(getPool())(iconfileInfo, user)
        .pipe(
            flatMap(result => {
                const expectedId = 1;
                expect(result).toEqual(expectedId);
                return getCheckIconfile(getIconfile(getPool()), iconfileInfo);
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should be capable to add a second icon", done => {
        const user = "zazie";
        const iconfileInfo1: Iconfile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        const iconfileInfo2: Iconfile = {
            name: "animal-icon",
            format: "french",
            size: "huge",
            content: crypto.randomBytes(4096)
        };
        createIcon(getPool())(iconfileInfo1, user)
        .pipe(
            flatMap(result1 => createIcon(getPool())(iconfileInfo2, user)
                .pipe(
                    flatMap(result2 => {
                        const expectedId1 = 1;
                        const expectedId2 = 2;
                        expect(result1).toEqual(expectedId1);
                        expect(result2).toEqual(expectedId2);
                        const getIconfileFromDB = getIconfile(getPool());
                        return getCheckIconfile(getIconfileFromDB, iconfileInfo1)
                            .pipe(
                                flatMap(() => getCheckIconfile(getIconfileFromDB, iconfileInfo2))
                            );
                    })
                )),
            flatMap(() => assertIconCount(getPool(), 2))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should rollback to last consistent state, in case an error occurs in sideEffect", done => {
        const user = "zazie";
        const iconfileInfo1: Iconfile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        const iconfileInfo2: Iconfile = {
            name: "animal-icon",
            format: "french",
            size: "huge",
            content: crypto.randomBytes(4096)
        };
        const sideEffectErrorMessage = "Error in creating side effect";
        createIcon(getPool())(iconfileInfo1, user)
        .pipe(
            tap(() => setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true")),
            flatMap(result1 =>
                createIcon(getPool())(iconfileInfo2, user, () => { throw Error(sideEffectErrorMessage); })
                .pipe(
                    map(() => fail("Expected an error to make exection skip this part")),
                    catchError(error => {
                        expect(error.message).toEqual(sideEffectErrorMessage);
                        return of(void 0);
                    }),
                    flatMap(result2 => {
                        expect(result2).toBeUndefined();
                        const expectedId1 = 1;
                        expect(result1).toEqual(expectedId1);
                        const getIconfileFromDB = getIconfile(getPool());
                        return getCheckIconfile(getIconfileFromDB, iconfileInfo1)
                            .pipe(
                                flatMap(() => assertIconCount(getPool(), 1))
                            );
                    })
                ))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
