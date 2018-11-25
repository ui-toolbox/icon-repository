import { flatMap } from "rxjs/operators";
import { manageTestResourcesBeforeAndAfter, Session, uxAuth } from "./api-test-utils";
import { testIconInputData } from "./icon-api-test-utils";
import { createIcon, setAuth, addTag } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";

describe("POST /icon/:name/tag", () => {

    const agent = manageTestResourcesBeforeAndAfter();

    fit("should fail without permision", done => {
        const testIcon = testIconInputData.get(0);
        const tag = "Ahoj";

        const session: Session = agent();

        createIcon(session.requestBuilder(), testIcon.name, testIcon.files.get(0).content)
        .pipe(
            flatMap(() => setAuth(session.requestBuilder(), [])),
            flatMap(() => addTag(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 403)
                    .requestBuilder(),
                    testIcon.name, tag))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
