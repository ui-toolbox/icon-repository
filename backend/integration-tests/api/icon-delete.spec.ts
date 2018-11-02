import { manageTestResourcesBeforeAndAfter, Session, uxAuth } from "./api-test-utils";
import { setAuth, deleteIcon, describeAllIcons } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { addTestData, testIconInputData, getIngestedTestIconDataDescription } from "./icon-api-test-utils";
import { IconFileDescriptor } from "../../src/icon";
import { assertFileNotInRepo } from "../git/git-test-utils";
import clone from "../../src/utils/clone";

describe("DEL /icons", () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("should fail with 403 without proper privilege", done => {
        const session: Session = agent();

        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), []))
        .flatMap(() => deleteIcon(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 403)
                .requestBuilder(),
            testIconInputData.get(0).name))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should fail with 403 with only REMOVE_ICONFILE privilege", done => {
        const session: Session = agent();

        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICONFILE ]))
        .flatMap(() => deleteIcon(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 403)
                .requestBuilder(),
            testIconInputData.get(0).name))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should succeed with REMOVE_ICON privilege", done => {
        const iconToDelete = testIconInputData.get(0);
        const expectedAllIconsDescriptor = clone(getIngestedTestIconDataDescription());
        expectedAllIconsDescriptor.splice(0, 1);

        const getIconFileDescToDelete: (iconFileIndex: number) => IconFileDescriptor
            = index => ({
                format: iconToDelete.files.get(index).format,
                size: iconToDelete.files.get(index).size
            });

        const session: Session = agent();

        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON ]))
        .flatMap(() => deleteIcon(
            session
                .responseOK(resp => resp.status === 204)
                .requestBuilder(),
            iconToDelete.name))
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconsDesc =>
            expect(iconsDesc.toArray()).toEqual(expectedAllIconsDescriptor))
        .flatMap(() => assertFileNotInRepo(iconToDelete.name, getIconFileDescToDelete(0)))
        .flatMap(() => assertFileNotInRepo(iconToDelete.name, getIconFileDescToDelete(1)))
        .flatMap(() => assertFileNotInRepo(iconToDelete.name, getIconFileDescToDelete(2)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
