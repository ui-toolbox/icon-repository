import { manageTestResourcesBeforeAfter, Session, uxAuth } from "./api-test-utils";
import { setAuth, deleteIcon, describeAllIcons } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { addTestData, getTestIconData, getTestDataDescriptor } from "./icon-api-test-utils";
import { IconFileDescriptor } from "../../src/icon";
import { assertNoSuchFile } from "../git/git-test-utils";

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

    it("should succeed with REMOVE_ICON privilege", done => {
        const testData = getTestIconData();
        const iconToDelete = testData.get(0);
        const expectedAllIconsDescriptor = getTestDataDescriptor();
        expectedAllIconsDescriptor.splice(0, 1);

        const getIconFileDescToDelete: (iconFileIndex: number) => IconFileDescriptor
            = index => ({
                format: iconToDelete.files.get(index).format,
                size: iconToDelete.files.get(index).size
            });

        const session: Session = agent();

        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON ]))
        .flatMap(() => deleteIcon(
            session
                .responseOK(resp => resp.status === 204)
                .requestBuilder(),
            iconToDelete.name))
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconsDesc =>
            expect(iconsDesc.toArray()).toEqual(expectedAllIconsDescriptor))
        .flatMap(() => assertNoSuchFile(iconToDelete.name, getIconFileDescToDelete(0)))
        .flatMap(() => assertNoSuchFile(iconToDelete.name, getIconFileDescToDelete(1)))
        .flatMap(() => assertNoSuchFile(iconToDelete.name, getIconFileDescToDelete(2)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
