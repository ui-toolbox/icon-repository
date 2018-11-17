import { manageTestResourcesBeforeAndAfter, Session, uxAuth, defaultAuth } from "./api-test-utils";
import { setAuth, deleteIconfile, describeAllIcons } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import {
    testIconInputData,
    addTestData,
    getIngestedTestIconDataDescription,
    ingestedTestIconData } from "./icon-api-test-utils";
import { IconfileDescriptor, Iconfile } from "../../src/icon";
import { assertFileInRepo, assertFileNotInRepo } from "../git/git-test-utils";

import { flatMap, map } from "rxjs/operators";

describe("DEL /icon/:name/<file>", () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("should fail with 403 without proper privilege", done => {
        const nameOfIconToDeleteFrom = "cartouche";
        const descOfIconfileToDelete: IconfileDescriptor = { format: "belge", size: "large" };

        const session: Session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .pipe(
            flatMap(() => setAuth(session.requestBuilder(), [])),
            flatMap(() => deleteIconfile(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 403)
                    .requestBuilder(),
                nameOfIconToDeleteFrom,
                descOfIconfileToDelete
            ))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should succeed with REMOVE_ICONFILE privilege", done => {
        const nameOfIconToDeleteFrom = testIconInputData.get(0).name;
        const iconfileToDelete = testIconInputData.get(0).files.get(0);
        const descOfIconfileToDelete: IconfileDescriptor = {
            format: iconfileToDelete.format,
            size: iconfileToDelete.size
        };

        const session: Session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .pipe(
            flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICONFILE ])),
            flatMap(() => deleteIconfile(
                session.auth(uxAuth).requestBuilder(),
                nameOfIconToDeleteFrom,
                descOfIconfileToDelete
            ))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should fail with 404 for icon files associated with non-existent icon", done => {
        const nameOfIconToDeleteFrom = "cartouche";
        const descOfIconfileToDelete: IconfileDescriptor = { format: "belge", size: "large" };

        const session: Session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .pipe(
            flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICONFILE ])),
            flatMap(() => deleteIconfile(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 404)
                    .requestBuilder(),
                nameOfIconToDeleteFrom,
                descOfIconfileToDelete
            ))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should fail with 404 for non-existent icon files", done => {
        const nameOfIconToDeleteFrom = testIconInputData.get(0).name;
        const iconfileToDelete = testIconInputData.get(0).files.get(0);
        const descOfIconfileToDelete: IconfileDescriptor = {
            format: "cartouche",
            size: iconfileToDelete.size
        };

        const session: Session = agent();

        addTestData(session.requestBuilder(), testIconInputData)
        .pipe(
            flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICONFILE ])),
            flatMap(() => deleteIconfile(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 404)
                    .requestBuilder(),
                nameOfIconToDeleteFrom,
                descOfIconfileToDelete
            ))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should succeed with REMOVE_ICON privilege", done => {
        const iconToDeleteFrom = testIconInputData.get(0);
        const fileToDelete = iconToDeleteFrom.files.get(0);
        const descOfIconfileToDelete: IconfileDescriptor = { format: fileToDelete.format, size: fileToDelete.size };
        const expectedAllIconsDescriptor = getIngestedTestIconDataDescription();
        expectedAllIconsDescriptor[0].paths.splice(1, 1);

        // Used in asserting git result
        const expectedIconfile: Iconfile = { name: iconToDeleteFrom.name, ...fileToDelete };

        const session: Session = agent();

        addTestData(session.requestBuilder(), testIconInputData)
        .pipe(
            flatMap(() => assertFileInRepo(expectedIconfile)),
            flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON ])),
            flatMap(() => deleteIconfile(
                session.auth(uxAuth).requestBuilder(),
                iconToDeleteFrom.name,
                descOfIconfileToDelete
            )),
            flatMap(() => describeAllIcons(session.requestBuilder())),
            map(iconsDesc =>
                expect(iconsDesc.toArray()).toEqual(expectedAllIconsDescriptor)),
            flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, descOfIconfileToDelete))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should remove icon, if it has no other icon file associated with it", done => {
        const iconToDeleteFrom = ingestedTestIconData.get(0);
        const expectedAllIconsDescriptor = getIngestedTestIconDataDescription();
        expectedAllIconsDescriptor.splice(0, 1);

        const getIconfileDescToDelete: (iconfileIndex: number) => IconfileDescriptor
            = index => ({
                format: iconToDeleteFrom.files.get(index).format,
                size: iconToDeleteFrom.files.get(index).size
            });

        const session: Session = agent();

        addTestData(session.requestBuilder(), testIconInputData)
        .pipe(
            flatMap(() => deleteIconfile(
                session.requestBuilder(),
                iconToDeleteFrom.name,
                getIconfileDescToDelete(0)
            )),
            flatMap(() => deleteIconfile(
                session.requestBuilder(),
                iconToDeleteFrom.name,
                getIconfileDescToDelete(1)
            )),
            flatMap(() => deleteIconfile(
                session.requestBuilder(),
                iconToDeleteFrom.name,
                getIconfileDescToDelete(2)
            )),
            flatMap(() => describeAllIcons(session.requestBuilder())),
            map(iconsDesc =>
                expect(iconsDesc.toArray()).toEqual(expectedAllIconsDescriptor)),
            flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, getIconfileDescToDelete(0))),
            flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, getIconfileDescToDelete(1))),
            flatMap(() => assertFileNotInRepo(iconToDeleteFrom.name, getIconfileDescToDelete(2)))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
