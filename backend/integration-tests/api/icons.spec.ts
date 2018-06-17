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
import { CreateIconInfo, IconFileDescriptor } from "../../src/icon";
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
                                    "1x",
                                    "2x",
                                    "3x"
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

const getAllIconsPath = "/icons";

describe(getAllIconsPath, () => {

    let pool: Pool;
    let server: Server;

    beforeAll(createTestPool(p => pool = p, fail));
    afterAll(terminateTestPool(pool));
    beforeEach(done => setUpGitRepoAndDbSchemaAndServer(pool, sourceServer => server = sourceServer, done));
    afterEach(done => tearDownGitRepoAndServer(server, done));

    it("should return the description of all icons in the repository", done => {
        const icon1: ICreateIconFormData = {
            iconName: "zazie",
            fileFormat: "french",
            iconSize: "great",
            iconFile: createUploadBuffer(4096)
        };
        const icon1File2: IconFileDescriptor = {
            format: "french",
            size: "big"
        };

        const icon2: ICreateIconFormData = {
            iconName: "cartouche",
            fileFormat: "belgique",
            iconSize: "huge",
            iconFile: createUploadBuffer(4096)
        };
        const icon2File2: IconFileDescriptor = {
            format: "quebecois",
            size: "great"
        };

        const createIcon1Form = createAddIconFormData(icon1.iconName, icon1.fileFormat, icon1.iconSize);
        const icon1File2FormData = createAddIconFileFormData();
        const createIcon2Form = createAddIconFormData(icon2.iconName, icon2.fileFormat, icon2.iconSize);
        const icon2File2FormData = createAddIconFileFormData();
        return createInitialIcon(server, createIcon1Form)
        .flatMap(iconId => addIconFile(
            server,
            [
                privilegeDictionary.ADD_ICON_FILE
            ],
            iconId, icon1File2.format, icon1File2.size, icon1File2FormData))
        .flatMap(() => createInitialIcon(server, createIcon2Form))
        .flatMap(iconId => addIconFile(
            server,
            [
                privilegeDictionary.ADD_ICON_FILE
            ],
            iconId, icon2File2.format, icon2File2.size, icon2File2FormData));
    });
});
