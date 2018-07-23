import { manageTestResourcesBeforeAfter, Session, uxAuth } from "./api-test-utils";
import { setAuth, deleteIcon } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { addTestData, getTestIconData } from "./icon-api-test-utils";

describe("DEL /icons", () => {

    const agent = manageTestResourcesBeforeAfter();

    it("should fail with 403 without proper privilege", done => {
        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), []))
            .flatMap(() => deleteIcon(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 403)
                    .requestBuilder(),
                testData.get(0).name))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should fail with 403 with only REMOVE_ICON_FILE privilege", done => {
        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON_FILE ]))
            .flatMap(() => deleteIcon(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 403)
                    .requestBuilder(),
                testData.get(0).name))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should should succeed with REMOVE_ICON privilege", done => {
        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON ]))
            .flatMap(() => deleteIcon(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 200)
                    .requestBuilder(),
                testData.get(0).name))
            .subscribe(boilerplateSubscribe(fail, done));
    });
});
