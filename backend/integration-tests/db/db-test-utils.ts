import { createPool, query, getIconFileFromDBProvider, GetIconFileFromDB } from "../../src/db/db";
import { Pool } from "pg";
import { Observable } from "rxjs";
import { createSchema } from "../../scripts/create-schema";
import { boilerplateSubscribe } from "../testUtils";
import { iconTableSpec } from "../../src/db/db-schema";
import { IAddIconRequestData } from "../../src/icon";

export const assertIconCount = (pool: Pool, expectedCount: number) =>
query(pool, `SELECT count(*) from ${iconTableSpec.tableName}`, [])
    .map(countResult => expect(parseInt(countResult.rows[0].count, 10)).toEqual(expectedCount));

export const getCheckIconFile: (
    getIconFileFromDB: GetIconFileFromDB,
    iconID: number,
    iconFileInfo: IAddIconRequestData
) => Observable<boolean>
= (getIconFileFromDB, iconID, iconFileInfo) => {
    return getIconFileFromDB(iconID, iconFileInfo.format, iconFileInfo.size)
        .map(content1 => expect(Buffer.compare(content1, iconFileInfo.content)).toEqual(0));
};

export const createTestPool = (setPool: (p: Pool) => void, fail: (err: any) => void) => (done: () => void) =>
    createPool()
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

export const createTestSchema = (pp: () => Pool, fail: (error: any) => void) => (done: () => void) =>
    createSchema(pp())
    .subscribe(boilerplateSubscribe(fail, done));
