import * as request from "request";
import { boilerplateSubscribe } from "../testUtils";

import {
    getURL,
    setAuthentication,
    createAddIconFormData,
    CreateIconFormData,
    iconEndpointPath,
    testUploadRequest,
    manageTestResourcesBeforeAfter,
    defaultAuth,
    getCheckIconFile} from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

import {
    getCurrentCommit as getCurrentGitCommit,
    assertGitStatus } from "../git/git-test-utils";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { List } from "immutable";
import { describeAllIcons } from "./api-client";
import { IconDTO } from "../../src/iconsHandlers";

const createIconDTO = (formData: CreateIconFormData) => ({
    name: formData.name,
    paths: {
        [formData.format]: {
            [formData.size]: `/icons/${formData.name}/formats/${formData.format}/sizes/${formData.size}`
        }
    }
});

describe(iconEndpointPath, () => {

    manageTestResourcesBeforeAfter();

    it ("POST should fail with 403 without CREATE_ICON privilege", done => {
        const jar = request.jar();
        setAuthentication("zazie", [], jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(iconEndpointPath),
                method: "POST",
                formData: createAddIconFormData("cartouche", "french", "great"),
                jar
            })
            .map(result => expect(result.response.statusCode).toEqual(403)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        const jar = request.jar();
        const iconFormData: CreateIconFormData = createAddIconFormData("cartouche", "french", "great");
        const expectedIconInfo: IconDTO = createIconDTO(iconFormData);

        setAuthentication("zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(iconEndpointPath),
                method: "POST",
                formData: iconFormData,
                jar
            }))
        .map(result => {
            expect(result.response.statusCode).toEqual(201);
            expect(result.body.iconId).toEqual(1);
        })
        .flatMap(() => describeAllIcons(getURL(""), defaultAuth))
        .map(iconInfoList => {
            expect(iconInfoList.size).toEqual(1);
            expect({...iconInfoList.get(0)}).toEqual({...expectedIconInfo});
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should be capable of creating multiple icons in a row", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const formData1: CreateIconFormData = createAddIconFormData("cartouche", "french", "great");
        const formData2: CreateIconFormData = createAddIconFormData("cartouche1", "french", "great");

        const expectedIconInfoList: List<IconDTO> = List([
            createIconDTO(formData1),
            createIconDTO(formData2)
        ]);

        const jar = request.jar();
        setAuthentication("zazie", privileges, jar)
        .flatMap(() => testUploadRequest({
            url: getURL(iconEndpointPath),
            method: "POST",
            formData: formData1,
            jar
        }))
        .flatMap(result1 => {
            expect(result1.response.statusCode).toEqual(201);
            return getCurrentGitCommit();
        })
        .flatMap(gitSha1 =>
            testUploadRequest({
                url: getURL(iconEndpointPath),
                method: "POST",
                formData: formData2,
                jar
            })
            .flatMap(result2 => {
                expect(result2.response.statusCode).toEqual(201);
                return getCurrentGitCommit()
            .map(gitSha2 => expect(gitSha1).not.toEqual(gitSha2));
        }))
        .flatMap(() => getCheckIconFile(getURL(""), formData1))
        .flatMap(() => getCheckIconFile(getURL(""), formData2))
        .flatMap(() => assertGitStatus())
        .flatMap(() => describeAllIcons(getURL(""), defaultAuth))
        .map((iconDTOList: List<IconDTO>) => {
            expect(iconDTOList.size).toEqual(2);
            expect(iconDTOList).toEqual(expectedIconInfoList);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should rollback to last consistent state, in case an error occurs", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const formData1: CreateIconFormData = createAddIconFormData("cartouche", "french", "great");
        const formData2: CreateIconFormData = createAddIconFormData("cartouche1", "french", "great");

        const expectedIconInfoList = List([createIconDTO(formData1)]);

        const jar = request.jar();
        setAuthentication("zazie", privileges, jar)
        .flatMap(() => testUploadRequest({
            url: getURL(iconEndpointPath),
            method: "POST",
            formData: formData1,
            jar
        }))
        .flatMap(result1 => {
            expect(result1.response.statusCode).toEqual(201);
            return getCurrentGitCommit()
            .flatMap(gitSha1 => {
                setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true");
                return testUploadRequest({
                    url: getURL(iconEndpointPath),
                    method: "POST",
                    formData: formData2,
                    jar
                })
                .map(result2 => expect(result2.response.statusCode).toEqual(500))
                .flatMap(() => getCurrentGitCommit()
                    .map(gitSha2 => expect(gitSha1).toEqual(gitSha2)))
                .flatMap(() => getCheckIconFile(getURL(""), formData1));
            });
        })
        .flatMap(() => assertGitStatus())
        .flatMap(() => describeAllIcons(getURL(""), defaultAuth))
        .map(iconInfoList => {
            expect(iconInfoList.size).toEqual(1);
            expect(iconInfoList).toEqual(expectedIconInfoList);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
