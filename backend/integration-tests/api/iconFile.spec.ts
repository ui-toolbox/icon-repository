import { createTestGitRepo, deleteTestGitRepo } from "../git/git-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { createTestPool, terminateTestPool, createTestSchema } from "../db/db-test-utils";
import {
    iconEndpointPath,
    iconFileEndpointPath,
    createAddIconFormData,
    setAuthentication,
    getURL,
    startServerWithBackdoorsProlog,
    closeServerEpilog,
    testRequest,
    testUploadRequest,
    createAddIconFileFormData,
    IAddIconFormData} from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { Pool } from "pg";
import * as request from "request";
import { Observable } from "rxjs";
import { getIconFileFromDBProvider, getAllIconsFromDBProvider, GetIconFileFromDB } from "../../src/db/db";
import { Server } from "http";
import { IconInfo } from "../../src/icon";

const createInitialIcon: (server: Server, createIconFormData: IAddIconFormData) => Observable<number>
= (server, createIconFormData) => {
    const privileges = [
        privilegeDictionary.CREATE_ICON
    ];
    const jar = request.jar();

    return setAuthentication(server, "zazie", privileges, jar)
    .flatMap(() =>
        testUploadRequest({
            url: getURL(server, iconEndpointPath),
            method: "POST",
            formData: createIconFormData,
            jar
        }))
    .map(result => (result.body.iconId as number));
};

const createIconFileURL: (iconId: number, format: string, size: string) => string
    = (iconId, format, size) => `/icon/${iconId}/format/${format}/size/${size}`;

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

    it ("POST should fail on insufficient data", done => {
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
            .map(result => expect(result.response.statusCode).toEqual(400)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    fit ("POST should complete with CREATE_ICON privilege", done => {
        const getIconFileFromDB: GetIconFileFromDB = getIconFileFromDBProvider(pool);

        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        const jar = request.jar();
        const format = "french";
        const size1 = "great";
        const upForm1 = createAddIconFormData("cartouche", format, size1);
        const upForm2 = createAddIconFileFormData();
        const size2 = "large";
        createInitialIcon(server, upForm1)
        .flatMap(iconId =>
            setAuthentication(server, "zazie", privileges, jar)
            .flatMap(() =>
                testUploadRequest({
                    url: getURL(server, createIconFileURL(iconId, format, size2)),
                    method: "POST",
                    formData: upForm2,
                    jar
                }))
            .map(result => expect(result.response.statusCode).toEqual(201))
            .flatMap(getAllIconsFromDBProvider(pool))
            .flatMap(iconInfoList => {
                expect(iconInfoList.size).toEqual(1);
                expect(iconInfoList.get(0).id).toEqual(iconId);
                expect(iconInfoList.get(0).iconFiles.size).toEqual(2);
                return getIconFileFromDB(iconId, format, size1)
                .map(buffer => {
                    expect(Buffer.compare(buffer, upForm1.iconFile.value)).toEqual(0);
                    return getIconFileFromDB(iconId, format, size2)
                });
            }))
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
                const iconFileFormData = createAddIconFileFormData();
                return testUploadRequest({
                    url: getURL(server, createIconFileURL(result1.body.iconId, format2, size2)),
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
