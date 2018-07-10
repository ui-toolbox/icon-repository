import * as util from "util";
import * as crypto from "crypto";
import * as http from "http";
import * as request from "request";
import { Observable, Observer } from "rxjs";
import { Pool } from "pg";

const req = request.defaults({
    timeout: 4000
});
// request.debug = true;

import { getDefaultConfiguration, ConfigurationData } from "../../src/configuration";
import iconDAFsProvider, { createConnectionProperties } from "../../src/db/db";
import gitProvider from "../../src/git";
import serverProvider from "../../src/server";
import { Server } from "http";
import iconServiceProvider from "../../src/iconsService";
import iconHandlersProvider, { IconDTO } from "../../src/iconsHandlers";
import logger from "../../src/utils/logger";
import { getTestRepoDir, createTestGitRepo, deleteTestGitRepo } from "../git/git-test-utils";
import { createSchema } from "../../scripts/create-schema";
import { boilerplateSubscribe } from "../testUtils";
import { createTestPool, terminateTestPool } from "../db/db-test-utils";
import { Auth, describeAllIcons as describeAllIconsClient, getIconFile } from "./api-client";
import { List } from "immutable";

logger.setLevel("silly");

type StartServer = (customServerConfig: any) => Observable<Server>;

export const defaultTestServerconfig = Object.freeze({
    authentication_type: "basic"
});

let localServerRef: Server;

export const startServer: StartServer = customConfig => {
    const configData: ConfigurationData = Object.assign(
        Object.assign(
            getDefaultConfiguration(),
            defaultTestServerconfig
        ),
        Object.assign(customConfig, {server_port: 0})
    );
    const iconService = iconServiceProvider(
        {
            allowedFormats: configData.icon_data_allowed_formats,
            allowedSizes: configData.icon_data_allowed_sizes
        },
        iconDAFsProvider(createConnectionProperties(configData)),
        gitProvider(configData.icon_data_location_git)
    );
    const iconHandlers = iconHandlersProvider(iconService);
    return serverProvider(() => configData, iconHandlers)
    .map(server => {
        localServerRef = server;
        return server;
    });
};

export const startServerWithBackdoors: StartServer = customConfig =>
    startServer(Object.assign(customConfig, {enable_backdoors: true}));

export const setUpGitRepoAndDbSchemaAndServer = (pool: Pool, done: () => void) => {
    createTestGitRepo()
        .flatMap(() => createSchema(pool))
        .flatMap(() => startServerWithBackdoors({icon_data_location_git: getTestRepoDir()}))
    .subscribe(boilerplateSubscribe(fail, done));
};

export const tearDownGitRepoAndServer = (server: Server, done: () => void) => {
    delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
    deleteTestGitRepo()
        .map(() => server.close())
    .subscribe(boilerplateSubscribe(fail, done));
};

export const manageTestResourcesBeforeAfter = () => {
    let localPoolRef: Pool;
    beforeAll(createTestPool((p: Pool) => {
        localPoolRef = p;
    }, fail));
    beforeEach(done => setUpGitRepoAndDbSchemaAndServer(localPoolRef, done));
    afterAll(terminateTestPool(localPoolRef));
    afterEach(done => tearDownGitRepoAndServer(localServerRef, done));
};

const getURL = (path: string) => `http://localhost:${localServerRef.address().port}${path}`;
export const getBaseURLBasicAuth = (
    server: http.Server,
    auth: string) => `http://${auth}@localhost:${server.address().port}`;
interface UploadRequestBuffer {
    readonly value: Buffer;
    readonly options: {
        readonly filename: string
    };
}
export const createUploadBuffer: (size: number, filename?: string) => UploadRequestBuffer
= (size, filename = "a-file") => ({
    value: crypto.randomBytes(4096),
    options: {
        filename: "a-filename"
    }
});

interface RequestResult {
    readonly response: request.Response;
    readonly body: any;
}
type TestRequest = (
    options: any
) => Observable<RequestResult>;

export const authUX = Object.freeze({
    auth: {
        user: "ux",
        pass: "ux",
        sendImmediately: true
    }
});

export const authDEV = Object.freeze({
    auth: {
        user: "dev",
        pass: "dev",
        sendImmediately: true
    }
});

export const testRequest: TestRequest = options =>
    Observable.create((observer: Observer<RequestResult>) => {
        const engineeredOptions = Object.assign(
            options,
            {
                url: getURL(options.path),
                path: void 0
            },
            authDEV);
        req(
            engineeredOptions,
            (error: any, response: request.Response, body: any) => {
                logger.info("Reqest for %s is back: %o", options.url, {hasError: !!error});
                if (error) {
                    observer.error(util.format("error in request: %o", error));
                } else {
                    observer.next({ response, body });
                    observer.complete();
                }
            }
        );
    });

export const authenticationBackdoorPath = "/backdoor/authentication";

export const setAuthentication = (
    username: string,
    privileges: string[],
    jar: any
) => testRequest({
    path: authenticationBackdoorPath,
    method: "PUT",
    json: {username, privileges},
    jar
})
.map(
    result => {
        if (result.response.statusCode !== 200) {
            throw Error("Failed to set test authentication: " + result.response.statusCode);
        }
    }
)
.catch(error => {
    fail(error);
    return Observable.throw(error);
});

export interface UploadFormData {
    readonly iconFile: UploadRequestBuffer;
}

export interface CreateIconFormData extends UploadFormData {
    readonly name: string;
    readonly format: string;
    readonly size: string;
}

export const createAddIconFormData: (name: string, format: string, size: string) => CreateIconFormData
= (name, format, size) => ({ name, format, size, iconFile: createUploadBuffer(4096) });

export const createAddIconFileFormData: () => UploadFormData = () => ({
    iconFile: createUploadBuffer(4096)
});

interface TestUploadRequestData {
    path: string;
    method: string;
    formData: UploadFormData;
    jar: request.CookieJar;
}
type TestUploadRequest = (requestData: TestUploadRequestData) => Observable<RequestResult>;
export const testUploadRequest: TestUploadRequest
    = uploadRequestData => testRequest({...uploadRequestData, json: true});

const defaultAuth: Auth = {user: "ux", password: "ux"};

export const describeAllIcons: () => Observable<List<IconDTO>>
= () => describeAllIconsClient(`${getURL("")}`, defaultAuth);

export const getCheckIconFile: (formData: CreateIconFormData) => Observable<any>
    = formData => getIconFile(getURL(""), defaultAuth, formData.name, formData.format, formData.size)
    .map(buffer => expect(Buffer.compare(formData.iconFile.value, buffer)).toEqual(0));

export const getCheckIconFile1: (
    name: string,
    format: string,
    size: string,
    formData: UploadFormData
) => Observable<any>
= (name, format, size, formData) => getIconFile(getURL(""), defaultAuth, name, format, size)
    .map(buffer => expect(Buffer.compare(formData.iconFile.value, buffer)).toEqual(0));

export const iconEndpointPath = "/icons";
export const iconFileEndpointPath = "/icons/:id/formats/:format/sizes/:size";
