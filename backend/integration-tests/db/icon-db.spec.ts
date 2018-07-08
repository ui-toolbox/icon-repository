import * as crypto from "crypto";
import { Pool } from "pg";
import { Observable } from "rxjs";

import { createTestPool,
    terminateTestPool,
    createTestSchema,
    getCheckIconFile,
    assertIconCount
 } from "./db-test-utils";
import { IIconFile } from "../../src/icon";
import { boilerplateSubscribe } from "../testUtils";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { addIconToDBProvider, getIconFileFromDBProvider } from "../../src/db/db";

describe("addIconToDBProvider", () => {
    let pool: Pool;

    beforeAll(done => createTestPool(p => pool = p, fail, done));
    afterAll(done => terminateTestPool(pool, done));
    beforeEach(done => createTestSchema(pool, fail, done));
    afterEach(() => delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST);

    it("should be capable to add a first icon", done => {
        const user = "zazie";
        const iconFileInfo: IIconFile = {
            iconName: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        addIconToDBProvider(pool)(iconFileInfo, user)
        .flatMap(result => {
            const expectedId = 1;
            expect(result).toEqual(expectedId);
            return getCheckIconFile(getIconFileFromDBProvider(pool), expectedId, iconFileInfo);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should be capable to add a second icon", done => {
        const user = "zazie";
        const iconFileInfo1: IIconFile = {
            iconName: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        const iconFileInfo2: IIconFile = {
            iconName: "animal-icon",
            format: "french",
            size: "huge",
            content: crypto.randomBytes(4096)
        };
        addIconToDBProvider(pool)(iconFileInfo1, user)
        .flatMap(result1 => addIconToDBProvider(pool)(iconFileInfo2, user)
            .flatMap(result2 => {
                const expectedId1 = 1;
                const expectedId2 = 2;
                expect(result1).toEqual(expectedId1);
                expect(result2).toEqual(expectedId2);
                const getIconFileFromDB = getIconFileFromDBProvider(pool);
                return getCheckIconFile(getIconFileFromDB, expectedId1, iconFileInfo1)
                    .flatMap(() => getCheckIconFile(getIconFileFromDB, expectedId2, iconFileInfo2));
            })
        )
        .flatMap(() => assertIconCount(pool, 2))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should rollback to last consistent state, in case an error occurs in sideEffect", done => {
        const user = "zazie";
        const iconFileInfo1: IIconFile = {
            iconName: "metro-icon",
            format: "french",
            size: "great",
            content: crypto.randomBytes(4096)
        };
        const iconFileInfo2: IIconFile = {
            iconName: "animal-icon",
            format: "french",
            size: "huge",
            content: crypto.randomBytes(4096)
        };
        const sideEffectErrorMessage = "Error in creating side effect";
        addIconToDBProvider(pool)(iconFileInfo1, user)
        .do(() => setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true"))
        .flatMap(result1 =>
            addIconToDBProvider(pool)(iconFileInfo2, user, () => { throw Error(sideEffectErrorMessage); })
            .map(() => fail("Expected an error to make exection skip this part"))
            .catch(error => {
                expect(error.message).toEqual(sideEffectErrorMessage);
                return Observable.of(void 0);
            } )
            .flatMap(result2 => {
                expect(result2).toBeUndefined();
                const expectedId1 = 1;
                expect(result1).toEqual(expectedId1);
                const getIconFileFromDB = getIconFileFromDBProvider(pool);
                return getCheckIconFile(getIconFileFromDB, expectedId1, iconFileInfo1)
                    .flatMap(() => assertIconCount(pool, 1));
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
