import * as fs from "fs";
import * as crypto from "crypto";
import { Pool } from "pg";
import { Observable } from "rxjs";
import * as request from "request";
import { boilerplateSubscribe } from "../testUtils";

import {
    testRequest,
    testHTTPStatus,
    getURL,
    setAuthentication,
    createUploadBuffer,
    startServerWithBackdoors,
    startServer,
    IHTTPStatusTestParams,
    IUploadRequestBuffer,
    createUploadFormData,
    IUploadFormData,
    convertToIconFileInfo,
    iconEndpointPath} from "./api-test-utils";
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
    getTestRepoDir,
    deleteTestGitRepo,
    createTestGitRepo,
    getCurrentCommit as getCurrentGitCommit,
    assertGitStatus } from "../git/git-test-utils";
import { getIconFileFromDBProvider } from "../../src/db/db";
import { setEnvVar } from "../../src/configuration.spec";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";

describe(iconEndpointPath, () => {
    let pool: Pool;

    beforeEach(done => {
        createTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });

    afterEach(done => {
        delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
        deleteTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });

    beforeAll(done => createTestPool(p => pool = p, fail, done));
    afterAll(done => terminateTestPool(pool, done));
    beforeEach(done => createTestSchema(pool, fail, done));

    it ("POST should fail with 403 without CREATE_ICON privilege", done => {
        const params: IHTTPStatusTestParams = {
            serverOptions: {icon_data_location_git: getTestRepoDir()},
            requestOptions: {url: iconEndpointPath, method: "POST"},
            authentication: {username: "zazie", privileges: []},
            expectedStatusCode: 403,
            fail,
            done
        };
        testHTTPStatus(params);
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        const params: IHTTPStatusTestParams = {
            serverOptions: {icon_data_location_git: getTestRepoDir()},
            requestOptions: {
                url: iconEndpointPath,
                method: "POST",
                formData: createUploadFormData("cartouche")
            },
            authentication: {
                username: "zazie",
                privileges
            },
            expectedStatusCode: 201,
            fail,
            done
        };
        testHTTPStatus(params);
    });

    it ("POST should be capable of creating multiple icons in a row", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const formData1: IUploadFormData = createUploadFormData("cartouche");
        const formData2: IUploadFormData = createUploadFormData("cartouche1");

        const getIconFileFromDB = getIconFileFromDBProvider(pool);

        const jar = request.jar();
        startServerWithBackdoors({icon_data_location_git: getTestRepoDir()})
        .flatMap(server =>
            setAuthentication(server, "zazie", privileges, jar)
            .flatMap(() => testRequest({
                url: getURL(server, iconEndpointPath),
                method: "POST",
                formData: formData1,
                jar,
                json: true
            }))
            .flatMap(result1 => {
                expect(result1.response.statusCode).toEqual(201);
                return getCurrentGitCommit()
                .flatMap(gitSha1 =>
                    testRequest({
                        url: getURL(server, iconEndpointPath),
                        method: "POST",
                        formData: formData2,
                        jar,
                        json: true
                    })
                    .flatMap(result2 => {
                        expect(result2.response.statusCode).toEqual(201);
                        return getCurrentGitCommit()
                        .map(gitSha2 => expect(gitSha1).not.toEqual(gitSha2))
                        .flatMap(() =>
                            getCheckIconFile(
                                getIconFileFromDB,
                                result1.body.iconId,
                                convertToIconFileInfo(formData1)))
                        .flatMap(() =>
                            getCheckIconFile(
                                getIconFileFromDB,
                                result2.body.iconId,
                                convertToIconFileInfo(formData2)
                            ));
                    })
                );
            })
        )
        .flatMap(() => assertIconCount(pool, 2))
        .flatMap(() => assertGitStatus())
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should rollback to last consistent state, in case an error occurs", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const formData1: IUploadFormData = createUploadFormData("cartouche");
        const formData2: IUploadFormData = createUploadFormData("cartouche1");

        const getIconFileFromDB = getIconFileFromDBProvider(pool);

        const jar = request.jar();
        startServerWithBackdoors({icon_data_location_git: getTestRepoDir()})
        .flatMap(server =>
            setAuthentication(server, "zazie", privileges, jar)
            .flatMap(() => testRequest({
                url: getURL(server, iconEndpointPath),
                method: "POST",
                formData: formData1,
                jar,
                json: true
            }))
            .flatMap(result1 => {
                expect(result1.response.statusCode).toEqual(201);
                return getCurrentGitCommit()
                .flatMap(gitSha1 => {
                    setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true");
                    return testRequest({
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
                            convertToIconFileInfo(formData1)));
                });
            })
        )
        .flatMap(() => assertIconCount(pool, 1))
        .flatMap(() => assertGitStatus())
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
