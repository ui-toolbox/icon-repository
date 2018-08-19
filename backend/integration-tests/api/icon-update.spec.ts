import { boilerplateSubscribe } from "../testUtils";

import {
    iconEndpointPath,
    manageTestResourcesBeforeAndAfter } from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

import { setAuth, describeAllIcons, updateIcon } from "./api-client";
import { getTestIconData, getTestDataDescriptor, addTestData } from "./icon-api-test-utils";
import { IconAttributes } from "../../src/icon";
import { assertGitCleanStatus, assertFileInRepo, assertFileNotInRepo } from "../git/git-test-utils";

describe(iconEndpointPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it ("POST should fail with 403 without UPDATE_ICON privilege", done => {
        const testData = getTestIconData();
        const oldIconName = "cartouche";
        const newIcon: IconAttributes = {
            name: "some icon name"
        };

        const session = agent();
        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), []))
            .flatMap(() => updateIcon(
                session.responseOK(resp => resp.status === 403).requestBuilder(),
                oldIconName,
                newIcon
            ))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with UPDATE_ICON privilege", done => {
        const testData = getTestIconData();
        const testAllIconDescriptor = getTestDataDescriptor();

        const oldIconName = "cartouche";
        const newIcon: IconAttributes = {
            name: "some icon name"
        };

        testAllIconDescriptor[0].name = newIcon.name;
        testAllIconDescriptor[0].paths = {
            french: {
                great: `/icons/${newIcon.name}/formats/french/sizes/great`,
                large: `/icons/${newIcon.name}/formats/french/sizes/large`
            },
            belge: {
                large: `/icons/${newIcon.name}/formats/belge/sizes/large`
            }
        };
        // Expected order is lexicographic by icon name: "flonflon" first, "some icon name" second
        const expectedIconDescriptors = [
            testAllIconDescriptor[1],
            testAllIconDescriptor[0]
        ];

        const oldIconFiles = testData.get(0).files;

        const session = agent();
        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.UPDATE_ICON ]))
            .flatMap(() => updateIcon(
                session.responseOK(resp => resp.status === 204).requestBuilder(),
                oldIconName,
                newIcon
            ))
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconInfoList => expect(iconInfoList.toArray()).toEqual(expectedIconDescriptors))
        // Assert GIT status:
        .flatMap(() => assertGitCleanStatus())
        .flatMap(() => assertFileNotInRepo(oldIconName, testData.get(0).files.get(0)))
        .flatMap(() => assertFileNotInRepo(oldIconName, testData.get(0).files.get(1)))
        .flatMap(() => assertFileNotInRepo(oldIconName, testData.get(0).files.get(2)))
        .flatMap(() => assertFileInRepo({ name: newIcon.name, ...oldIconFiles.get(0) }))
        .flatMap(() => assertFileInRepo({ name: newIcon.name, ...oldIconFiles.get(1) }))
        .flatMap(() => assertFileInRepo({ name: newIcon.name, ...oldIconFiles.get(2) }))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
