import * as crypto from "crypto";
import { manageTestResourcesBeforeAfter, Session, uxAuth, getCheckIconFile } from "./api-test-utils";
import { setAuth, updateIconFile, describeAllIcons } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { getTestIconData, addTestData, getTestDataDescriptor } from "./icon-api-test-utils";
import { IconFile } from "../../src/icon";

describe("PUT icons/:name/<file>", () => {

    const agent = manageTestResourcesBeforeAfter();

    it("should fail with 403 without proper privilege", done => {
        const newIconFile: IconFile = {
            name: "cartouche",
            format: "belge",
            size: "large",
            content: crypto.randomBytes(1024)
        };

        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), []))
        .flatMap(() => updateIconFile(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 403)
                .requestBuilder(),
            newIconFile
        ))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should succeed with UPDATE_ICON_FILE privilege", done => {
        const newIconFile: IconFile = {
            name: "cartouche",
            format: "belge",
            size: "large",
            content: crypto.randomBytes(1024)
        };

        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.UPDATE_ICON_FILE ]))
        .flatMap(() => updateIconFile(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 204)
                .requestBuilder(),
            newIconFile
        ))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should succeed with UPDATE_ICON privilege", done => {
        const newIconFile: IconFile = {
            name: "cartouche",
            format: "belge",
            size: "large",
            content: crypto.randomBytes(1024)
        };

        const testData = getTestIconData();
        const expectedAllIconsDescriptor = getTestDataDescriptor();

        // Used in asserting git result
        const session: Session = agent();

        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.UPDATE_ICON_FILE ]))
        .flatMap(() => updateIconFile(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 204)
                .requestBuilder(),
            newIconFile
        ))
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconsDesc =>
            expect(iconsDesc.toArray()).toEqual(expectedAllIconsDescriptor))
        .flatMap(() => getCheckIconFile(session, newIconFile))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
