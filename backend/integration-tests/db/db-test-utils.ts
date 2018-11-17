import { createPool, query, GetIconfile, createConnectionProperties } from "../../src/db/db";
import { Pool } from "pg";
import { Observable } from "rxjs";
import { iconTableSpec } from "../../src/db/db-schema";
import { Iconfile } from "../../src/icon";
import { getDefaultConfiguration } from "../../src/configuration";
import { map } from "rxjs/operators";
import createSchema from "../../src/db/create-schema";
import { boilerplateSubscribe } from "../testUtils";

export const assertIconCount = (connPool: Pool, expectedCount: number) =>
    query(connPool, `SELECT count(*) from ${iconTableSpec.tableName}`, [])
        .pipe(map(countResult => expect(parseInt(countResult.rows[0].count, 10)).toEqual(expectedCount)));

export const getCheckIconfile: (
    getIconfileFromDB: GetIconfile,
    iconfileInfo: Iconfile
) => Observable<boolean>
= (getIconfileFromDB, iconfileInfo) => {
    return getIconfileFromDB(iconfileInfo.name, iconfileInfo.format, iconfileInfo.size)
        .pipe(map(content1 => expect(Buffer.compare(content1, iconfileInfo.content)).toEqual(0)));
};

export const createTestPool = (setPool: (p: Pool) => void, fail: (err: any) => void) => (done: () => void) =>
    createPool(createConnectionProperties(getDefaultConfiguration()))
    .subscribe(
        p => {
            setPool(p);
        },
        error => {
            fail(error);
            done();
        },
        done
    );

let pool: Pool;

export const terminateTestPool = () => (done: () => void) => {
    if (pool) {
        pool.end();
    }
    done();
};

export const manageTestResourcesBeforeAndAfter: () => () => Pool = () => {
    beforeAll(createTestPool(p => pool = p, fail));
    afterAll(terminateTestPool());
    beforeEach(done => createSchema(pool)().subscribe(boilerplateSubscribe(fail, done)));
    afterEach(() => delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST);
    return () => pool;
};
