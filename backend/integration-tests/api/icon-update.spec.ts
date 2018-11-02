import { boilerplateSubscribe } from "../testUtils";
import {
    iconEndpointPath,
    manageTestResourcesBeforeAndAfter } from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

import { setAuth, describeAllIcons, updateIcon, ingestIconfile, describeIcon } from "./api-client";
import {
    testIconInputData,
    addTestData,
    ingestedTestIconData,
    getIngestedTestIconDataDescription,
    moreTestIconInputData } from "./icon-api-test-utils";
import { IconAttributes } from "../../src/icon";
import { assertGitCleanStatus, assertFileInRepo, assertFileNotInRepo } from "../git/git-test-utils";
import clone from "../../src/utils/clone";
import { createIconfilePath } from "../../src/iconsHandlers";

describe(`PATCH ${iconEndpointPath}`, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it ("should fail with 403 without UPDATE_ICON privilege", done => {
        const oldIconName = "cartouche";
        const newIcon: IconAttributes = {
            name: "some icon name"
        };

        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), []))
        .flatMap(() => updateIcon(
            session.responseOK(resp => resp.status === 403).requestBuilder(),
            oldIconName,
            newIcon
        ))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("should complete with UPDATE_ICON privilege", done => {
        const testAllIconDescriptor = getIngestedTestIconDataDescription();

        const oldIconName = testIconInputData.get(0).name;
        const newIconAttributes: IconAttributes = Object.freeze({
            name: "some new icon name"
        });

        const changedIconDTO = {
            name: newIconAttributes.name,
            modifiedBy: testAllIconDescriptor[1].modifiedBy,
            paths: [
                { format: "png", size: "36px", path: `/icons/${newIconAttributes.name}/formats/png/sizes/36px` },
                { format: "svg", size: "18px", path: `/icons/${newIconAttributes.name}/formats/svg/sizes/18px` },
                { format: "svg", size: "24px", path: `/icons/${newIconAttributes.name}/formats/svg/sizes/24px` }
            ]
        };
        // Expected order is lexicographic by icon name: "cast..." first, "some icon name" second
        const expectedIconDescriptors = [
            testAllIconDescriptor[1],
            changedIconDTO
        ];

        const oldIngestedIconFiles = ingestedTestIconData.get(0).files;

        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.UPDATE_ICON ]))
            .flatMap(() => updateIcon(
                session.responseOK(resp => resp.status === 204).requestBuilder(),
                oldIconName,
                newIconAttributes
            ))
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconInfoList => expect(iconInfoList.toArray()).toEqual(expectedIconDescriptors))
        // Assert GIT status:
        .flatMap(() => assertGitCleanStatus())
        .flatMap(() => assertFileNotInRepo(oldIconName, testIconInputData.get(0).files.get(0)))
        .flatMap(() => assertFileNotInRepo(oldIconName, testIconInputData.get(0).files.get(1)))
        .flatMap(() => assertFileNotInRepo(oldIconName, testIconInputData.get(0).files.get(2)))
        .flatMap(() => assertFileInRepo({ name: newIconAttributes.name, ...oldIngestedIconFiles.get(0) }))
        .flatMap(() => assertFileInRepo({ name: newIconAttributes.name, ...oldIngestedIconFiles.get(1) }))
        .flatMap(() => assertFileInRepo({ name: newIconAttributes.name, ...oldIngestedIconFiles.get(2) }))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});

describe(`POST ${iconEndpointPath}`, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("should not allow adding icon-files without proper privilege", done => {
        const testAllIconDescriptor = getIngestedTestIconDataDescription();

        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [])
            .flatMap(() => ingestIconfile(
                session.responseOK(resp => resp.status === 403).requestBuilder(),
                testIconInputData.get(0).name,
                moreTestIconInputData.get(0).files.get(0).content
            )))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should allow adding icon-files with UPDATE_ICON privilege", done => {
        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.UPDATE_ICON])
            .flatMap(() => ingestIconfile(
                session.responseOK(resp => resp.status === 200).requestBuilder(),
                testIconInputData.get(0).name,
                moreTestIconInputData.get(0).files.get(1).content
            )))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should allow adding icon-files with ADD_ICONFILE privilege", done => {
        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.ADD_ICONFILE])
            .flatMap(() => ingestIconfile(
                session.responseOK(resp => resp.status === 200).requestBuilder(),
                testIconInputData.get(0).name,
                moreTestIconInputData.get(0).files.get(1).content
            )))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should allow adding icon-files with new format-size combinations", done => {
        const nameOfIconToUpdate = testIconInputData.get(0).name;
        const iconfileToAdd = moreTestIconInputData.get(0).files.get(1);

        const expectedIconDescription = clone(getIngestedTestIconDataDescription()[0]);
        const addedIconfileDescription = {
            format: iconfileToAdd.format,
            size: iconfileToAdd.size,
            path: createIconfilePath("/icons", nameOfIconToUpdate, iconfileToAdd)
        };
        expectedIconDescription.paths.push(addedIconfileDescription);

        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.ADD_ICONFILE])
            .flatMap(() => ingestIconfile(
                session.responseOK(resp => resp.status === 200).requestBuilder(),
                nameOfIconToUpdate,
                iconfileToAdd.content
            )))
        .flatMap(iconfileInfo => {
            expect(iconfileInfo).toEqual({iconName: nameOfIconToUpdate, ...addedIconfileDescription});
            return describeIcon(session.requestBuilder(), nameOfIconToUpdate);
        })
        .map(iconDescription => {
            expect(iconDescription.name).toEqual(expectedIconDescription.name);
            expect(iconDescription.paths).toEqual(expectedIconDescription.paths);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should not allow adding icon-files with already existing format-size combinations", done => {
        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.ADD_ICONFILE])
            .flatMap(() => ingestIconfile(
                session.responseOK(resp => resp.status === 409).requestBuilder(),
                testIconInputData.get(0).name,
                moreTestIconInputData.get(0).files.get(0).content
            )))
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
