import { createTestGitRepo, deleteTestGitRepo, getTestRepoDir } from "../git/git-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { createTestPool, terminateTestPool, createTestSchema, getCheckIconFile } from "../db/db-test-utils";
import {
    iconEndpointPath,
    iconFileEndpointPath,
    createAddIconFormData,
    setAuthentication,
    getURL,
    convertToAddIconRequest,
    startServerWithBackdoorsProlog,
    closeServerEpilog,
    createAddIconFileFormData,
    testRequest,
    testUploadRequest } from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { Pool } from "pg";
import * as request from "request";
import { Observable } from "rxjs";
import { getIconFileFromDBProvider } from "../../src/db/db";
import { Server } from "http";

describe(iconFileEndpointPath, () => {
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
    afterEach(closeServerEpilog((() => server)));

    it ("POST should fail with 403 without either of CREATE_ICON or ADD_ICON_FILE privilege", done => {
        const jar = request.jar();
        setAuthentication(server, "zazie", [], jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(server, iconFileEndpointPath),
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
        setAuthentication(server, "zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(server, iconFileEndpointPath),
                method: "POST",
                formData: createAddIconFormData("cartouche", "french", "great"),
                jar
            })
            .map(result => expect(result.response.statusCode).toEqual(201)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with ADD_ICON_FILE privilege", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FILE
        ];
        const jar = request.jar();
        setAuthentication(server, "zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(server, iconFileEndpointPath),
                method: "POST",
                formData: createAddIconFormData("cartouche", "french", "great"),
                jar
            })
            .map(result => expect(result.response.statusCode).toEqual(201)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should add an icon file with the specified format and size to an existing icon", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const jar = request.jar();

        const format1 = "french";
        const size1 = "great";
        const iconFormData = createAddIconFormData("cartouche", format1, size1);
        const getIconFileFromDB = getIconFileFromDBProvider(pool);

        setAuthentication(server, "zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(server, iconEndpointPath),
                method: "POST",
                formData: iconFormData,
                jar
            })
            .flatMap(result1 => {
                expect(result1.response.statusCode).toEqual(201);
                const format2 = "belgian";
                const size2 = "great";
                const iconFileFormData = createAddIconFileFormData(result1.body.iconId, format2, size2);
                return testUploadRequest({
                    url: getURL(server, iconFileEndpointPath),
                    method: "POST",
                    formData: iconFileFormData,
                    jar
                })
                .flatMap(result2 => {
                    expect(result2.response.statusCode).toEqual(201);
                    // 1. Check icon table
                    // 2. check icon-file table
                    // 3. Check intial file with GET /iconFile
                    return testRequest({
                        url: getURL(
                            server,
                            `/icon/${result2.body.iconId}/format/${format2}/size/${size2}`
                        ),
                        method: "GET",
                        jar
                    });
                })
                .map(getResult => {
                    const actualContent = Buffer.from(getResult.body, "binary");
                    expect(getResult.response.statusCode).toEqual(200);
                    // expect(Buffer.compare(actualContent, formData.iconFile.value)).toEqual(0);
                    // 4. Check added icon file with GET /iconFile
                    // 5. Check all with GET /icons
                });
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));

    });

    it ("GET should return the requested icon file as specified by format and size", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const jar = request.jar();
        const formData = createAddIconFormData("cartouche", "french", "great");
        const getIconFileFromDB = getIconFileFromDBProvider(pool);

        setAuthentication(server, "zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                url: getURL(server, iconEndpointPath),
                method: "POST",
                formData,
                jar
            })
            .flatMap(result => {
                expect(result.response.statusCode).toEqual(201);
                expect(result.body.iconId).toEqual(1);
                return testRequest({
                    url: getURL(
                        server,
                        `/icon/${result.body.iconId}/format/${formData.fileFormat}/size/${formData.iconSize}`
                    ),
                    method: "GET",
                    jar
                })
                .map(getResult => {
                    const actualContent = Buffer.from(getResult.body, "binary");
                    expect(getResult.response.statusCode).toEqual(200);
                    expect(Buffer.compare(actualContent, formData.iconFile.value)).toEqual(0);
                });
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));

    });
});
