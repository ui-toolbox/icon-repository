import { manageTestResourcesBeforeAndAfter, Session, uxAuth, defaultAuth } from "./api-test-utils";
import { setAuth, deleteIconFile, describeAllIcons } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { getTestIconData, addTestData, getTestDataDescriptor } from "./icon-api-test-utils";
import { IconFileDescriptor, IconFile } from "../../src/icon";
import { assertFileInRepo, assertFileNotInRepo } from "../git/git-test-utils";

describe("DEL icons/:name/<file>", () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("should fail with 403 without proper privilege", done => {
        const nameOfIconToDeleteFrom = "cartouche";
        const descOfIconFileToDelete: IconFileDescriptor = { format: "belge", size: "large" };

        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), []))
        .flatMap(() => deleteIconFile(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 403)
                .requestBuilder(),
            nameOfIconToDeleteFrom,
            descOfIconFileToDelete
        ))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should succeed with REMOVE_ICON_FILE privilege", done => {
        const nameOfIconToDeleteFrom = "cartouche";
        const descOfIconFileToDelete: IconFileDescriptor = { format: "belge", size: "large" };

        const session: Session = agent();
        const testData = getTestIconData();
        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON_FILE ]))
        .flatMap(() => deleteIconFile(
            session.auth(uxAuth).requestBuilder(),
            nameOfIconToDeleteFrom,
            descOfIconFileToDelete
        ))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should succeed with REMOVE_ICON privilege", done => {
        const testData = getTestIconData();
        const iconToDeleteFrom = testData.get(0);
        const fileToDelete = iconToDeleteFrom.files.get(0);
        const descOfIconFileToDelete: IconFileDescriptor = { format: fileToDelete.format, size: fileToDelete.size };
        const expectedAllIconsDescriptor = getTestDataDescriptor();
        expectedAllIconsDescriptor[0].paths.splice(1, 1);

        // Used in asserting git result
        const expectedIconFile: IconFile = { name: iconToDeleteFrom.name, ...fileToDelete };

        const session: Session = agent();

        addTestData(session.requestBuilder(), testData)
        .flatMap(() => assertFileInRepo(expectedIconFile))
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON ]))
        .flatMap(() => deleteIconFile(
            session.auth(uxAuth).requestBuilder(),
            iconToDeleteFrom.name,
            descOfIconFileToDelete
        ))
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconsDesc =>
            expect(iconsDesc.toArray()).toEqual(expectedAllIconsDescriptor))
        .flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, descOfIconFileToDelete))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should remove icon, if it has no other icon file associated with it", done => {
        const testData = getTestIconData();
        const iconToDeleteFrom = testData.get(0);
        const expectedAllIconsDescriptor = getTestDataDescriptor();
        expectedAllIconsDescriptor.splice(0, 1);

        const getIconFileDescToDelete: (iconFileIndex: number) => IconFileDescriptor
            = index => ({
                format: iconToDeleteFrom.files.get(index).format,
                size: iconToDeleteFrom.files.get(index).size
            });

        const session: Session = agent();

        addTestData(session.requestBuilder(), testData)
        .flatMap(() => deleteIconFile(
            session.requestBuilder(),
            iconToDeleteFrom.name,
            getIconFileDescToDelete(0)
        ))
        .flatMap(() => deleteIconFile(
            session.requestBuilder(),
            iconToDeleteFrom.name,
            getIconFileDescToDelete(1)
        ))
        .flatMap(() => deleteIconFile(
            session.requestBuilder(),
            iconToDeleteFrom.name,
            getIconFileDescToDelete(2)
        ))
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconsDesc =>
            expect(iconsDesc.toArray()).toEqual(expectedAllIconsDescriptor))
        .flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, getIconFileDescToDelete(0)))
        .flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, getIconFileDescToDelete(1)))
        .flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, getIconFileDescToDelete(2)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
