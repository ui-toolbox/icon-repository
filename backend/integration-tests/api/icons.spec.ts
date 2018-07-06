import * as Rx from "rxjs";
import {
    startServer,
    testRequest,
    getURL,
    createAddIconFormData,
    createAddIconFileFormData,
    createUploadBuffer,
    ICreateIconFormData,
    setUpGitRepoAndDbSchemaAndServer,
    tearDownGitRepoAndServer
} from "./api-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { createInitialIcon, addIconFile } from "./iconFile.spec";
import { IconFileDescriptor } from "../../src/icon";
import { Pool } from "pg";
import { Server } from "http";
import { createTestPool, terminateTestPool } from "../db/db-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

const iconRepoConfigPath = "/icons/config";

describe(iconRepoConfigPath, () => {
    it("should return the correct default", done => {
        startServer({})
        .flatMap(server => testRequest({
                            url: getURL(server, iconRepoConfigPath)
                        })
                        .map(result => {
                            server.close();
                            expect(result.response.statusCode).toEqual(200);
                            expect(JSON.parse(result.response.body)).toEqual({
                                allowedFileFormats: [
                                    "svg",
                                    "png"
                                ],
                                allowedIconSizes: [
                                    "18px", "24px", "48px", // for svg
                                    "18dp", "24dp", "36dp", "48dp", "144dp" // for png
                                ]
                            });
                        })
                        .catch(error => {
                            server.close();
                            return Rx.Observable.throw(error);
                        })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});

const allIconsPath = "/icons";

describe(allIconsPath, () => {

    let pool: Pool;
    let server: Server;

    beforeAll(createTestPool(p => pool = p, fail));
    afterAll(terminateTestPool(pool));
    beforeEach(done => setUpGitRepoAndDbSchemaAndServer(pool, sourceServer => server = sourceServer, done));
    afterEach(done => tearDownGitRepoAndServer(server, done));

    it("GET should return the description of all icons in the repository", done => {
        const icon1: ICreateIconFormData = {
            name: "zazie",
            format: "french",
            size: "great",
            iconFile: createUploadBuffer(4096)
        };
        const icon1File2: IconFileDescriptor = {
            format: "french",
            size: "big"
        };

        const icon2: ICreateIconFormData = {
            name: "cartouche",
            format: "belgique",
            size: "huge",
            iconFile: createUploadBuffer(4096)
        };
        const icon2File2: IconFileDescriptor = {
            format: "quebecois",
            size: "great"
        };

        const expectedReply = [
            {
                iconName: icon1.name,
                iconFiles: {
                    [icon1.format]: {
                        [icon1.size]: `/icons/formats/${icon1.format}/sizes/${icon1.size}`,
                        [icon1File2.size]: `/icons/formats/${icon1.format}/sizes/${icon1File2.size}`
                    }
                }
            },
            {
                iconName: icon2.name,
                iconFiles: {
                    [icon2.format]: {
                        [icon2.size]: `/icons/formats/${icon2.format}/sizes/${icon2.size}`
                    },
                    [icon2File2.format]: {
                        [icon2File2.size]: `/icons/formats/${icon2File2.format}/sizes/${icon2File2.size}`
                    }
                }
            }
        ];

        const createIcon1Form = createAddIconFormData(icon1.name, icon1.format, icon1.size);
        const icon1File2FormData = createAddIconFileFormData();
        const createIcon2Form = createAddIconFormData(icon2.name, icon2.format, icon2.size);
        const icon2File2FormData = createAddIconFileFormData();
        return createInitialIcon(server, createIcon1Form)
        .flatMap(iconId => addIconFile(
            server,
            [
                privilegeDictionary.ADD_ICON_FILE
            ],
            icon1.name, icon1File2.format, icon1File2.size, icon1File2FormData))
        .flatMap(() => createInitialIcon(server, createIcon2Form))
        .flatMap(iconId => addIconFile(
            server,
            [
                privilegeDictionary.ADD_ICON_FILE
            ],
            icon2.name, icon2File2.format, icon2File2.size, icon2File2FormData))
        .flatMap(() => testRequest({
            url: getURL(server, "/icons")
        }))
        .map(actualReply => expect(JSON.parse(actualReply.body)).toEqual(expectedReply))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});

const singleIconPath = allIconsPath + "/:name";
describe(singleIconPath, () => {
    let pool: Pool;
    let server: Server;

    beforeAll(createTestPool(p => pool = p, fail));
    afterAll(terminateTestPool(pool));
    beforeEach(done => setUpGitRepoAndDbSchemaAndServer(pool, sourceServer => server = sourceServer, done));
    afterEach(done => tearDownGitRepoAndServer(server, done));

    it ("GET should describe the icon", done => {
        const icon1: ICreateIconFormData = {
            name: "zazie",
            format: "french",
            size: "great",
            iconFile: createUploadBuffer(4096)
        };
        const icon1File2: IconFileDescriptor = {
            format: "french",
            size: "big"
        };

        const expectedReply = {
            iconName: icon1.name,
            iconFiles: {
                [icon1.format]: {
                    [icon1.size]: `/icons/formats/${icon1.format}/sizes/${icon1.size}`,
                    [icon1File2.size]: `/icons/formats/${icon1.format}/sizes/${icon1File2.size}`
                }
            }
        };

        const createIcon1Form = createAddIconFormData(icon1.name, icon1.format, icon1.size);
        const icon1File2FormData = createAddIconFileFormData();
        return createInitialIcon(server, createIcon1Form)
        .flatMap(iconId => addIconFile(
            server,
            [
                privilegeDictionary.ADD_ICON_FILE
            ],
            icon1.name, icon1File2.format, icon1File2.size, icon1File2FormData))
        .flatMap(() => testRequest({
            url: getURL(server, `/icons/${icon1.name}`)
        }))
        .map(actualReply => {
            expect(actualReply.response.statusCode).toEqual(200);
            expect(JSON.parse(actualReply.body)).toEqual(expectedReply);
        })
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("GET should return 404 for non-existent icon", done => {
        testRequest({
            url: getURL(server, `/icons/somenonexistentname`)
        })
        .map(actualReply => expect(actualReply.response.statusCode).toEqual(404))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
