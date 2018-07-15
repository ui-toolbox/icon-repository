import { manageTestResourcesBeforeAfter, Session, uxAuth } from "./api-test-utils";
import { setAuth, deleteIconFile } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { getTestIconData, addTestData } from "./icon-api-test-utils";

describe("DEL icons/:name/<file>", () => {

    const agent = manageTestResourcesBeforeAfter();

    it("should fail with 403 without proper privilege", done => {
        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), []))
            .flatMap(() => deleteIconFile(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 403)
                    .requestBuilder(),
                {name: testData.get(0).name, ...testData.get(0).files.get(0)}))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should should succeed with REMOVE_ICON_FILE privilege", done => {
        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON_FILE ]))
            .flatMap(() => deleteIconFile(
                session.auth(uxAuth).requestBuilder(),
                {name: testData.get(0).name, ...testData.get(0).files.get(0)})
            )
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should should succeed with REMOVE_ICON privilege", done => {
        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON ]))
            .flatMap(() => deleteIconFile(
                session.auth(uxAuth).requestBuilder(),
                {name: testData.get(0).name, ...testData.get(0).files.get(0)})
            )
            .subscribe(boilerplateSubscribe(fail, done));
    });

});
