import { randomBytes } from "crypto";
import { createPool,
    query,
    createConnectionProperties,
    getPooledConnection,
    tableExists,
    ExecuteQuery } from "../../src/db/db";
import { Pool, QueryResult } from "pg";
import { Observable, of, from } from "rxjs";
import { iconTableSpec } from "../../src/db/db-schema";
import { Iconfile, IconDescriptor } from "../../src/icon";
import { getDefaultConfiguration } from "../../src/configuration";
import { map, flatMap, finalize, last, mapTo, tap } from "rxjs/operators";
import createSchema from "../../src/db/create-schema";
import { boilerplateSubscribe } from "../testUtils";
import { GetIconfile } from "../../src/db/icon";
import { updateDefaultLogLevel } from "../../src/utils/logger";
import { Set, List } from "immutable";
import { executeDataUpgrade } from "../../src/db/data-upgrade";

updateDefaultLogLevel("debug");

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
        pool = undefined;
    }
    done();
};

export const deleteData: (executeQuery: ExecuteQuery) => () => Observable<void>
= executeQuery => () => {
    return from(["icon", "icon_file", "tag", "icon_to_tags"])
    .pipe(
        flatMap(tableName => executeQuery(`DELETE FROM ${tableName}`)),
        last(),
        mapTo(undefined)
    );
};

export const makeSureHasUptodateSchemaWithNoData = (localPool: Pool) => {
    return getPooledConnection(localPool)
    .pipe(
        flatMap(connection => {
            const executeQuery: ExecuteQuery = connection.executeQuery;
            return tableExists(executeQuery, "icon")
            .pipe(
                flatMap(exists => {
                    if (!exists) {
                        return createSchema(localPool)();
                    } else {
                        return of(undefined);
                    }
                }),
                flatMap(executeDataUpgrade(localPool)),
                flatMap(deleteData(executeQuery)),
                finalize(() => connection.release())
            );
        })
    );
};

export const manageTestResourcesBeforeAndAfter: () => () => Pool = () => {
    beforeAll(createTestPool(
        p => {
            if (pool) {
                throw new Error("Database connection pool already initialized");
            } else {
                pool = p;
            }
        },
        fail
    ));
    afterAll(terminateTestPool());
    beforeEach(done =>
        makeSureHasUptodateSchemaWithNoData(pool)
        .subscribe(boilerplateSubscribe(fail, done))
    );
    afterEach(() => delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST);
    return () => pool;
};

export const testData = {
    iconfiles: [
        {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: randomBytes(4096)
        },
        {
            name: "zazie-icon",
            format: "french",
            size: "great",
            content: randomBytes(4096)
        }
    ],
    modifiedBy: "ux",
    tag1: "used-in-marvinjs",
    tag2: "some other tag"
};

export const assertIconDescriptorMatchesIconfile = (
    icondDesc: IconDescriptor,
    iconfile: Iconfile,
    expectedTags: Set<string>) => {
    expect(icondDesc.name).toEqual(iconfile.name);
    expect(icondDesc.iconfiles.toArray()[0].format).toEqual(iconfile.format);
    expect(icondDesc.iconfiles.toArray()[0].size).toEqual(iconfile.size);
    expect(icondDesc.tags).toEqual(expectedTags);
};

export const verifyIconToTag = (localPool: Pool, expectedTagIds: Set<number>) =>
    query(localPool, "select tag_id from icon_to_tags", [])
    .pipe(
        map((i2tResult: QueryResult) => {
            const actual = List(i2tResult.rows)
                .map(row => row.tag_id)
                .toSet();
            expect(actual).toEqual(actual);
        })
    );
