import { randomBytes } from "crypto";
import { Pool } from "pg";
import { flatMap, map} from "rxjs/operators";

import { manageTestResourcesBeforeAndAfter } from "./db-test-utils";
import { Iconfile } from "../../src/icon";
import { query } from "../../src/db/db";
import { boilerplateSubscribe } from "../testUtils";
import { createIcon, deleteIcon } from "../../src/db/icon";

describe("deleteIconFromDB", () => {

    const getPool: () => Pool = manageTestResourcesBeforeAndAfter();

    it("should delete all entries associated with the icon", done => {
        const user = "zazie";
        const iconfileInfo: Iconfile = {
            name: "metro-icon",
            format: "french",
            size: "great",
            content: randomBytes(4096)
        };

        createIcon(getPool())(iconfileInfo, user)
        .pipe(
            flatMap(() => deleteIcon(getPool())(iconfileInfo.name, user)),
            flatMap(() => query(getPool(), "select count(*) as row_count from icon", [])),
            map(result => expect(result.rows[0].row_count).toEqual("0")),
            flatMap(() => query(getPool(), "select count(*) as row_count from icon_file", [])),
            map(result => expect(result.rows[0].row_count).toEqual("0"))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
