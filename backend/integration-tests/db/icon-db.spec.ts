import * as crypto from "crypto";
import { Pool } from "pg";
import { Observable, of } from "rxjs";

import { createTestPool,
    terminateTestPool,
    getCheckIconfile,
    assertIconCount
 } from "./db-test-utils";
import { Iconfile } from "../../src/icon";
import { boilerplateSubscribe } from "../testUtils";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { createIcon, getIconfile } from "../../src/db/db";
import { createSchema } from "../../src/db/create-schema";
import { map, flatMap, tap, catchError } from "rxjs/operators";

describe("addIconToDBProvider", () => {
    let pool: Pool;

    beforeAll(createTestPool(p => pool = p, fail));
    afterAll(terminateTestPool((pool)));
    beforeEach(done => createSchema(pool)().subscribe(boilerplateSubscribe(fail, done)));
    afterEach(() => delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST);

    it("should be capable to add a first icon", done => {
        const user = "zazie";
        const iconfileInfo: Iconfile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        createIcon(pool)(iconfileInfo, user)
        .pipe(
            flatMap(result => {
                const expectedId = 1;
                expect(result).toEqual(expectedId);
                return getCheckIconfile(getIconfile(pool), iconfileInfo);
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
        createIcon(pool)(iconfileInfo1, user)
        .pipe(
            flatMap(result1 => createIcon(pool)(iconfileInfo2, user)
                .pipe(
                    flatMap(result2 => {
                        const expectedId1 = 1;
                        const expectedId2 = 2;
                        expect(result1).toEqual(expectedId1);
                        expect(result2).toEqual(expectedId2);
                        const getIconfileFromDB = getIconfile(pool);
                        return getCheckIconfile(getIconfileFromDB, iconfileInfo1)
                            .pipe(
                                flatMap(() => getCheckIconfile(getIconfileFromDB, iconfileInfo2))
                            );
                    })
                )),
            flatMap(() => assertIconCount(pool, 2))
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
        createIcon(pool)(iconfileInfo1, user)
        .pipe(
            tap(() => setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true")),
            flatMap(result1 =>
                createIcon(pool)(iconfileInfo2, user, () => { throw Error(sideEffectErrorMessage); })
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
                        const getIconfileFromDB = getIconfile(pool);
                        return getCheckIconfile(getIconfileFromDB, iconfileInfo1)
                            .pipe(
                                flatMap(() => assertIconCount(pool, 1))
                            );
                    })
                ))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
