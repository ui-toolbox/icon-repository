import { createPool, query, GetIconFile, createConnectionProperties } from "../../src/db/db";
import { Pool } from "pg";
import { Observable } from "rxjs";
import { iconTableSpec } from "../../src/db/db-schema";
import { IconFile } from "../../src/icon";
import { getDefaultConfiguration } from "../../src/configuration";
import { map } from "rxjs/operators";

export const assertIconCount = (pool: Pool, expectedCount: number) =>
    query(pool, `SELECT count(*) from ${iconTableSpec.tableName}`, [])
        .pipe(map(countResult => expect(parseInt(countResult.rows[0].count, 10)).toEqual(expectedCount)));

export const getCheckIconFile: (
    getIconFileFromDB: GetIconFile,
    iconFileInfo: IconFile
) => Observable<boolean>
= (getIconFileFromDB, iconFileInfo) => {
    return getIconFileFromDB(iconFileInfo.name, iconFileInfo.format, iconFileInfo.size)
        .pipe(map(content1 => expect(Buffer.compare(content1, iconFileInfo.content)).toEqual(0)));
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
