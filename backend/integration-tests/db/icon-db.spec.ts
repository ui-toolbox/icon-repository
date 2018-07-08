import * as crypto from "crypto";
import { Pool } from "pg";
import { Observable } from "rxjs";

import { createTestPool,
    terminateTestPool,
    createTestSchema,
    getCheckIconFile,
    assertIconCount
 } from "./db-test-utils";
import { IconFile } from "../../src/icon";
import { boilerplateSubscribe } from "../testUtils";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { createIcon, getIconFile } from "../../src/db/db";

describe("addIconToDBProvider", () => {
    let pool: Pool;

    beforeAll(createTestPool(p => pool = p, fail));
    afterAll(terminateTestPool((pool)));
    beforeEach(createTestSchema(() => pool, fail));
    afterEach(() => delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST);

    it("should be capable to add a first icon", done => {
        const user = "zazie";
        const iconFileInfo: IconFile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        createIcon(pool)(iconFileInfo, user)
        .flatMap(result => {
            const expectedId = 1;
            expect(result).toEqual(expectedId);
            return getCheckIconFile(getIconFile(pool), iconFileInfo);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should be capable to add a second icon", done => {
        const user = "zazie";
        const iconFileInfo1: IconFile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        const iconFileInfo2: IconFile = {
            name: "animal-icon",
            format: "french",
            size: "huge",
            content: crypto.randomBytes(4096)
        };
        createIcon(pool)(iconFileInfo1, user)
        .flatMap(result1 => createIcon(pool)(iconFileInfo2, user)
            .flatMap(result2 => {
                const expectedId1 = 1;
                const expectedId2 = 2;
                expect(result1).toEqual(expectedId1);
                expect(result2).toEqual(expectedId2);
                const getIconFileFromDB = getIconFile(pool);
                return getCheckIconFile(getIconFileFromDB, iconFileInfo1)
                    .flatMap(() => getCheckIconFile(getIconFileFromDB, iconFileInfo2));
            })
        )
        .flatMap(() => assertIconCount(pool, 2))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should rollback to last consistent state, in case an error occurs in sideEffect", done => {
        const user = "zazie";
        const iconFileInfo1: IconFile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        const iconFileInfo2: IconFile = {
            name: "animal-icon",
            format: "french",
            size: "huge",
            content: crypto.randomBytes(4096)
        };
        const sideEffectErrorMessage = "Error in creating side effect";
        createIcon(pool)(iconFileInfo1, user)
        .do(() => setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true"))
        .flatMap(result1 =>
            createIcon(pool)(iconFileInfo2, user, () => { throw Error(sideEffectErrorMessage); })
            .map(() => fail("Expected an error to make exection skip this part"))
            .catch(error => {
                expect(error.message).toEqual(sideEffectErrorMessage);
                return Observable.of(void 0);
            } )
            .flatMap(result2 => {
                expect(result2).toBeUndefined();
                const expectedId1 = 1;
                expect(result1).toEqual(expectedId1);
                const getIconFileFromDB = getIconFile(pool);
                return getCheckIconFile(getIconFileFromDB, iconFileInfo1)
                    .flatMap(() => assertIconCount(pool, 1));
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
