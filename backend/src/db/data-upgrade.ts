import { List } from "immutable";
import { Pool } from "pg";
import { getPooledConnection, ExecuteQuery } from "./db";
import { Observable, of, from } from "rxjs";
import { flatMap, map, mapTo, finalize, last } from "rxjs/operators";
import loggerFactory from "../utils/logger";

const logger = loggerFactory("data-upgrade");

interface UpgradeScript {
    readonly version: string;
    readonly sqls: List<string>;
}

const scripts: List<UpgradeScript> = List([
    {
        version: "2018-12-30/1 - tag support",
        sqls: List([
            "CREATE TABLE tag(id serial primary key, text text)",
            "CREATE TABLE icon_to_tags (" +
                "icon_id int REFERENCES icon(id) ON DELETE CASCADE, " +
                "tag_id  int REFERENCES tag(id)  ON DELETE CASCADE" +
            ")"
        ])
    }
]);

const scriptComparator = (u1: UpgradeScript, u2: UpgradeScript) => u1.version.localeCompare(u2.version);

const makeSureMetaExists = (executeQuery: ExecuteQuery) => {
    const sql = "CREATE TABLE IF NOT EXISTS meta (version TEXT primary key, upgrade_date TIMESTAMP)";
    return executeQuery(sql, []);
};

const isUpgradeApplied: (executeQuery: ExecuteQuery, version: string) => Observable<boolean>
= (executeQuery, version) =>
    makeSureMetaExists(executeQuery)
    .pipe(
        flatMap(() => {
            const sql: string = "SELECT count(*) as upgrade_count FROM meta WHERE version = $1";
            return executeQuery(sql, [version]);
        }),
        map(result => {
            const upgradeCount: number = parseInt(result.rows[0].upgrade_count, 10);
            return upgradeCount > 0;
        })
    );

const createMetaRecrod: (executeQuery: ExecuteQuery, version: string) => Observable<void>
= (executeQuery, version) => executeQuery(
    "INSERT INTO meta(version, upgrade_date) VALUES($1, current_timestamp)",
    [version]
).pipe(mapTo(void 0));

const applyUpgrade: (executeQuery: ExecuteQuery, u: UpgradeScript) => Observable<void>
= (executeQuery, u) =>
    from(u.sqls.toArray())
    .pipe(
        flatMap(sql => executeQuery(sql, [])),
        last(),
        flatMap(() => createMetaRecrod(executeQuery, u.version))
    );

export type ExecuteDataUpgrade = () => Observable<void>;
export const executeDataUpgrade: (pool: Pool) => ExecuteDataUpgrade
= pool => () => {
    const sorted = scripts.sort(scriptComparator);
    return getPooledConnection(pool)
    .pipe(
        flatMap(connection =>
            from(sorted.keySeq().toArray())
            .pipe(
                flatMap(key => {
                    const upgrade = sorted.get(key);
                    return isUpgradeApplied(connection.executeQuery, upgrade.version)
                    .pipe(
                        flatMap(applied => {
                            if (applied) {
                                logger.info("Version already applied: %s", upgrade.version);
                                return of(void 0);
                            } else {
                                logger.info("Applying upgrade: \"%s\" ...", upgrade.version);
                                return applyUpgrade(connection.executeQuery, upgrade);
                            }
                        })
                    );
                }),
                finalize(connection.release)
            )
        )
    );
};
