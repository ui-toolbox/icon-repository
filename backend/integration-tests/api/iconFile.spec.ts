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
import {
    getIconFile as getIconFileFromDBProvider,
    getAllIcons as getAllIconsFromDB,
    GetIconFile } from "../../src/db/db";
import { Server } from "http";
import { IconDescriptor } from "../../src/icon";

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

    const checkIconFileContent = (
        iconId: number, format: string, size: string, expectedContent: Buffer
    ) => {
        return testRequest({
            url: getURL(
                server,
                createIconFileURL(iconId, format, size)
            ),
            method: "GET"
        })
        .map(getResult => {
            const actualContent = Buffer.from(getResult.body, "binary");
            expect(getResult.response.statusCode).toEqual(200);
            expect(Buffer.compare(actualContent, expectedContent)).toEqual(0);
        });
    };

    const createIconThenAddIconFileWithPrivileges = (privileges: string[]) => {
        const getIconFileFromDB: GetIconFile = getIconFileFromDBProvider(pool);

        const jar = request.jar();
        const format = "french";
        const size1 = "great";
        const upForm1 = createAddIconFormData("cartouche", format, size1);
        const upForm2 = createAddIconFileFormData();
        const size2 = "large";
        return createInitialIcon(server, upForm1)
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
            .flatMap(getAllIconsFromDB(pool))
            .flatMap(iconInfoList => {
                expect(iconInfoList.size).toEqual(1);
                expect(iconInfoList.get(0).id).toEqual(iconId);
                expect(iconInfoList.get(0).iconFiles.size).toEqual(2);
                return getIconFileFromDB(iconId, format, size1)
                .map(buffer => {
                    expect(Buffer.compare(buffer, upForm1.iconFile.value)).toEqual(0);
                    return getIconFileFromDB(iconId, format, size2);
                });
            })
            .flatMap(() => checkIconFileContent(iconId, format, size1, upForm1.iconFile.value))
            .flatMap(() => checkIconFileContent(iconId, format, size2, upForm2.iconFile.value)));
    };

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        createIconThenAddIconFileWithPrivileges(privileges)
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with ADD_ICON_FILE privilege", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FILE
        ];
        createIconThenAddIconFileWithPrivileges(privileges)
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("GET should return the requested icon file as specified by format and size", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const jar = request.jar();
        const formData = createAddIconFormData("cartouche", "french", "great");

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
                return checkIconFileContent(
                    result.body.iconId, formData.fileFormat, formData.iconSize, formData.iconFile.value
                );
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
