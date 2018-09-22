import * as crypto from "crypto";
import { boilerplateSubscribe } from "../testUtils";

import {
    iconEndpointPath,
    manageTestResourcesBeforeAndAfter,
    getCheckIconFile } from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

import {
    getCurrentCommit as getCurrentGitCommit,
    assertGitCleanStatus } from "../git/git-test-utils";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { List } from "immutable";
import { setAuth, createIcon, describeAllIcons, getFilePath, describeIcon } from "./api-client";
import { IconDTO } from "../../src/iconsHandlers";
import { getTestIconData, addTestData, getTestDataDescriptor, Icon } from "./icon-api-test-utils";
import { IconFile, IconFileData } from "../../src/icon";

describe(iconEndpointPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it ("POST should fail with 403 without CREATE_ICON privilege", done => {
        const testIcon = {
            name: "some icon name",
            format: "some format",
            size: "some size",
            content: crypto.randomBytes(4096)
        };

        const session = agent();
        setAuth(session.requestBuilder(), [])
            .flatMap(() => createIcon(
                session.responseOK(resp => resp.status === 403).requestBuilder(),
                testIcon
            ))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const testIcon = {
            name: "some icon name",
            modifiedBy: "ux",
            format: "some format",
            size: "some size",
            content: crypto.randomBytes(4096)
        };
        const expectedIconInfo: IconDTO = {
            name: testIcon.name,
            modifiedBy: testIcon.modifiedBy,
            paths: [{
                format: testIcon.format,
                size: testIcon.size,
                path: getFilePath(testIcon.name, {format: testIcon.format, size: testIcon.size})
            }]
        };

        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        const session = agent();
        setAuth(session.requestBuilder(), privileges)
            .flatMap(() => createIcon(session.requestBuilder(), testIcon))
            .flatMap(() => describeAllIcons(session.requestBuilder()))
            .map(iconInfoList => {
                expect(iconInfoList.size).toEqual(1);
                expect({...iconInfoList.get(0)}).toEqual({...expectedIconInfo});
            })
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should be capable of creating multiple icons in a row", done => {
        const testData = getTestIconData();

        const sampleIconFileData1: IconFileData = testData.get(0).files.get(0);
        const sampleIconFile1: IconFile = {
            name: testData.get(0).name,
            ...sampleIconFileData1
        };
        const sampleIconFileData2: IconFileData = testData.get(1).files.get(1);
        const sampleIconFile2: IconFile = {
            name: testData.get(1).name,
            ...sampleIconFileData2
        };

        const session = agent();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => testData.toArray())
            .flatMap(() => getCheckIconFile(session, sampleIconFile1))
            .flatMap(() => getCheckIconFile(session, sampleIconFile2))
            .flatMap(() => assertGitCleanStatus())
            .flatMap(() => describeAllIcons(session.requestBuilder()))
            .map(iconDTOList => expect(new Set(iconDTOList.toArray())).toEqual(new Set(getTestDataDescriptor())))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should rollback to last consistent state, in case an error occurs", done => {
        const testData = getTestIconData();

        const iconFileToFind1: IconFile = {
            name: testData.get(0).name,
            ...testData.get(0).files.get(0)
        };
        const iconFileToFind2: IconFile = {
            name: testData.get(0).name,
            ...testData.get(0).files.get(1)
        };

        const session = agent();
        addTestData(session.requestBuilder(), List.of(testData.get(0)))
        .flatMap(() =>
            getCurrentGitCommit()
            .flatMap(gitSha1 => {
                setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true");
                return addTestData(
                    session
                        .responseOK(resp => resp.status === 500)
                        .requestBuilder(),
                    List.of(testData.get(1))
                )
                .flatMap(() => getCurrentGitCommit()
                    .map(gitSha2 => expect(gitSha1).toEqual(gitSha2)))
                .flatMap(() => getCheckIconFile(session, iconFileToFind1))
                .flatMap(() => getCheckIconFile(session, iconFileToFind2));
            }))
        .flatMap(() => assertGitCleanStatus())
        .flatMap(() => describeAllIcons(session.requestBuilder()))
        .map(iconInfoList => {
            expect(iconInfoList.size).toEqual(1);
            expect(iconInfoList.get(0)).toEqual(getTestDataDescriptor()[0]);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
