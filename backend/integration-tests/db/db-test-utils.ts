import { createPool, query, GetIconfile, createConnectionProperties } from "../../src/db/db";
import { Pool } from "pg";
import { Observable } from "rxjs";
import { iconTableSpec } from "../../src/db/db-schema";
import { Iconfile } from "../../src/icon";
import { getDefaultConfiguration } from "../../src/configuration";
import { map } from "rxjs/operators";

export const assertIconCount = (pool: Pool, expectedCount: number) =>
    query(pool, `SELECT count(*) from ${iconTableSpec.tableName}`, [])
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

export const terminateTestPool = (pool: Pool) => (done: () => void) => {
    if (pool) {
        pool.end();
    }
    done();
};
