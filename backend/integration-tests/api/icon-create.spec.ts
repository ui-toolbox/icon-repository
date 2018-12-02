import { boilerplateSubscribe } from "../testUtils";
import { flatMap, map } from "rxjs/operators";
import {
    iconEndpointPath,
    manageTestResourcesBeforeAndAfter,
    getCheckIconfile,
    defaultAuth} from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

import {
    getCurrentCommit as getCurrentGitCommit,
    assertGitCleanStatus } from "../git/git-test-utils";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { List } from "immutable";
import { setAuth, createIcon, describeAllIcons, getFilePath, describeIcon } from "./api-client";
import { IconDTO } from "../../src/iconsHandlers";
import {
    testIconInputData,
    addTestData,
    getIngestedTestIconDataDescription,
    getDemoIconfileContent } from "./icon-api-test-utils";
import { Iconfile, IconfileDescriptor } from "../../src/icon";

describe(iconEndpointPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it ("POST should fail with 403 without CREATE_ICON privilege", done => {
        const iconName: string = "dock";
        const format = "png";
        const sizeInDP = "36dp";

        const session = agent();
        setAuth(session.requestBuilder(), [])
        .pipe(
            flatMap(() => getDemoIconfileContent(iconName, { format, size: sizeInDP })),
            flatMap(content => createIcon(
                    session.responseOK(resp => resp.status === 403).requestBuilder(),
                    iconName, content))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const iconName = "dock";
        const format = "png";
        const sizeInDP = "36dp";
        const size = "54px";

        const expectedIconInfo: IconDTO = {
            name: iconName,
            modifiedBy: defaultAuth.user,
            paths: [{
                path: getFilePath(iconName, {format, size}),
                format,
                size
            }],
            tags: []
        };

        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        const session = agent();
        setAuth(session.requestBuilder(), privileges)
        .pipe(
            flatMap(() => getDemoIconfileContent(iconName, { format, size: sizeInDP})),
            flatMap(content => createIcon(session.requestBuilder(), iconName, content)),
            flatMap(iconfileInfo => {
                expect(iconfileInfo).toEqual({iconName, format, size, path: expectedIconInfo.paths[0].path});
                return describeAllIcons(session.requestBuilder());
            }),
            map(iconInfoList => {
                expect(iconInfoList.size).toEqual(1);
                expect({...iconInfoList.get(0)}).toEqual({...expectedIconInfo});
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should be capable of creating multiple icons in a row", done => {
        const sampleIconName1 = testIconInputData.get(0).name;
        const sampleIconfileDesc1: IconfileDescriptor = testIconInputData.get(0).files.get(0);
        const sampleIconName2 = testIconInputData.get(1).name;
        const sampleIconfileDesc2: IconfileDescriptor = testIconInputData.get(1).files.get(1);

        const session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
            .pipe(
                flatMap(() => testIconInputData.toArray()),
                flatMap(() => getDemoIconfileContent(sampleIconName1, sampleIconfileDesc1)),
                flatMap(content => getCheckIconfile(session, {
                    name: sampleIconName1,
                    ...sampleIconfileDesc1,
                    content
                })),
                flatMap(() => getDemoIconfileContent(sampleIconName2, sampleIconfileDesc2)),
                flatMap(content => getCheckIconfile(session, {
                    name: sampleIconName2,
                    ...sampleIconfileDesc2,
                    content
                })),
                flatMap(() => assertGitCleanStatus()),
                flatMap(() => describeAllIcons(session.requestBuilder())),
                map(iconDTOList =>
                    expect(new Set(iconDTOList.toArray()))
                        .toEqual(new Set(getIngestedTestIconDataDescription())))
            )
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should rollback to last consistent state, in case an error occurs", done => {
        const iconfileToFind1: Iconfile = {
            name: testIconInputData.get(0).name,
            ...testIconInputData.get(0).files.get(0)
        };
        const iconfileToFind2: Iconfile = {
            name: testIconInputData.get(0).name,
            ...testIconInputData.get(0).files.get(1)
        };

        const session = agent();
        addTestData(session.requestBuilder(), List.of(testIconInputData.get(0)))
        .pipe(
            flatMap(() =>
                getCurrentGitCommit()
                .pipe(
                    flatMap(gitSha1 => {
                        setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true");
                        return addTestData(
                            session
                                .responseOK(resp => resp.status === 500)
                                .requestBuilder(),
                            List.of(testIconInputData.get(1))
                        )
                        .pipe(
                            flatMap(() => getCurrentGitCommit()
                                .pipe(map(gitSha2 => expect(gitSha1).toEqual(gitSha2)))),
                            flatMap(() => getCheckIconfile(session, iconfileToFind1)),
                            flatMap(() => getCheckIconfile(session, iconfileToFind2))
                        );
                    })
                )),
            flatMap(() => assertGitCleanStatus()),
            flatMap(() => describeAllIcons(session.requestBuilder())),
            map(iconInfoList => {
                expect(iconInfoList.size).toEqual(1);
                expect(iconInfoList.get(0)).toEqual(getIngestedTestIconDataDescription()[0]);
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
