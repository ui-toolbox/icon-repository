import { Server } from "http";
import { Pool } from "pg";
import * as request from "request";
import { boilerplateSubscribe } from "../testUtils";

import {
    getURL,
    setAuthentication,
    createAddIconFormData,
    IAddIconFormData,
    convertToAddIconRequest,
    iconEndpointPath,
    closeServerEpilog,
    startServerWithBackdoorsProlog,
    testUploadRequest,
    convertToIconInfo} from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

import {
    createTestPool,
    terminateTestPool,
    createTestSchema,
    assertIconCount,
    getCheckIconFile
 } from "../db/db-test-utils";
import { start } from "repl";
import {
    deleteTestGitRepo,
    createTestGitRepo,
    getCurrentCommit as getCurrentGitCommit,
    assertGitStatus } from "../git/git-test-utils";
import { getIconFile, getAllIcons } from "../../src/db/db";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { IconDescriptor } from "../../src/icon";
import { List } from "immutable";

describe(iconEndpointPath, () => {
    let pool: Pool;
    let server: Server;

    beforeEach(done => {
        createTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });
    afterEach(done => {
        delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
        deleteTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });

    beforeAll(createTestPool(p => pool = p, fail));
    afterAll(terminateTestPool(pool));
    beforeEach(createTestSchema(() => pool, fail));

    beforeEach(startServerWithBackdoorsProlog(fail, testServer => server = testServer));
    afterEach(closeServerEpilog(() => server));

    it ("POST should fail with 403 without CREATE_ICON privilege", done => {
        const jar = request.jar();
        setAuthentication(server, "zazie", [], jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(server, iconEndpointPath),
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
        const iconFormData: IAddIconFormData = createAddIconFormData("cartouche", "french", "great");
        const expectedIconInfo: IconDescriptor = convertToIconInfo(iconFormData, 1);

        setAuthentication(server, "zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(server, iconEndpointPath),
                method: "POST",
                formData: iconFormData,
                jar
            }))
        .map(result => {
            expect(result.response.statusCode).toEqual(201);
            expect(result.body.iconId).toEqual(1);
        })
        .flatMap(() => getAllIcons(pool)())
        .map(iconInfoList => {
            expect(iconInfoList.size).toEqual(1);
            expect(iconInfoList.get(0)).toEqual(expectedIconInfo);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should be capable of creating multiple icons in a row", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const formData1: IAddIconFormData = createAddIconFormData("cartouche", "french", "great");
        const formData2: IAddIconFormData = createAddIconFormData("cartouche1", "french", "great");

        const expectedIconInfoList: List<IconDescriptor> = List<IconDescriptor>()
            .push(convertToIconInfo(formData1, 1))
            .push(convertToIconInfo(formData2, 2));

        const getIconFileFromDB = getIconFile(pool);

        const jar = request.jar();
        setAuthentication(server, "zazie", privileges, jar)
        .flatMap(() => testUploadRequest({
            url: getURL(server, iconEndpointPath),
            method: "POST",
            formData: formData1,
            jar
        }))
        .flatMap(result1 => {
            expect(result1.response.statusCode).toEqual(201);
            return getCurrentGitCommit()
            .flatMap(gitSha1 =>
                testUploadRequest({
                    url: getURL(server, iconEndpointPath),
                    method: "POST",
                    formData: formData2,
                    jar
                })
                .flatMap(result2 => {
                    expect(result2.response.statusCode).toEqual(201);
                    return getCurrentGitCommit()
                    .map(gitSha2 => expect(gitSha1).not.toEqual(gitSha2))
                    .flatMap(() =>
                        getCheckIconFile(
                            getIconFileFromDB,
                            result1.body.iconId,
                            convertToAddIconRequest(formData1)))
                    .flatMap(() =>
                        getCheckIconFile(
                            getIconFileFromDB,
                            result2.body.iconId,
                            convertToAddIconRequest(formData2)
                        ));
                })
            );
        })
        .flatMap(() => assertIconCount(pool, 2))
        .flatMap(() => assertGitStatus())
        .flatMap(() => getAllIcons(pool)())
        .map(iconInfoList => {
            expect(iconInfoList.size).toEqual(2);
            expect(iconInfoList).toEqual(expectedIconInfoList);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should rollback to last consistent state, in case an error occurs", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const formData1: IAddIconFormData = createAddIconFormData("cartouche", "french", "great");
        const formData2: IAddIconFormData = createAddIconFormData("cartouche1", "french", "great");

        const expectedIconInfoList = List<IconDescriptor>().push(convertToIconInfo(formData1, 1));

        const getIconFileFromDB = getIconFile(pool);

        const jar = request.jar();
        setAuthentication(server, "zazie", privileges, jar)
        .flatMap(() => testUploadRequest({
            url: getURL(server, iconEndpointPath),
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
                    url: getURL(server, iconEndpointPath),
                    method: "POST",
                    formData: formData2,
                    jar
                })
                .map(result2 => expect(result2.response.statusCode).toEqual(500))
                .flatMap(() => getCurrentGitCommit()
                    .map(gitSha2 => expect(gitSha1).toEqual(gitSha2)))
                .flatMap(() =>
                    getCheckIconFile(
                        getIconFileFromDB,
                        result1.body.iconId,
                        convertToAddIconRequest(formData1)));
            });
        })
        .flatMap(() => assertIconCount(pool, 1))
        .flatMap(() => assertGitStatus())
        .flatMap(() => getAllIcons(pool)())
        .map(iconInfoList => {
            expect(iconInfoList.size).toEqual(1);
            expect(iconInfoList).toEqual(expectedIconInfoList);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
