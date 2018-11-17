import { randomBytes } from "crypto";
import { manageTestResourcesBeforeAndAfter } from "./db-test-utils";
import { Pool } from "pg";

import { IconfileDescriptor, Iconfile, IconfileAlreadyExists } from "../../src/icon";
import { flatMap, map, catchError} from "rxjs/operators";
import { createIcon, deleteIconfile, query, addIconfileToIcon } from "../../src/db/db";
import { boilerplateSubscribe } from "../testUtils";
import { throwError, Observable, of } from "rxjs";

describe("addIconfileToDB", () => {

    const getPool: () => Pool = manageTestResourcesBeforeAndAfter();

    it("should throw IconfileAlreadyExists on duplicate iconfile", done => {
        const user = "zazie";
        const iconfileDesc: IconfileDescriptor = {
            format: "french",
            size: "great"
        };
        const iconfileInfo: Iconfile = {
            name: "metro-icon",
            ...iconfileDesc,
            content: randomBytes(4096)
        };

        createIcon(getPool())(iconfileInfo, user)
        .pipe(
            flatMap(() => addIconfileToIcon(getPool())(
                {
                    name: iconfileInfo.name,
                    ...iconfileDesc,
                    content: randomBytes(234)
                },
                user
            )),
            map(() => fail()),
            catchError(error => {
                expect(error instanceof IconfileAlreadyExists).toBeTruthy();
                return of(void 0);
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
