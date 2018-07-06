import * as util from "util";
import * as crypto from "crypto";
import * as http from "http";
import * as request from "request";
import { Observable, Observer, Subscription } from "rxjs";
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
import iconHandlersProvider from "../../src/iconsHandlers";
import { CreateIconInfo, IconDescriptor } from "../../src/icon";
import logger from "../../src/utils/logger";
import { getTestRepoDir, createTestGitRepo, deleteTestGitRepo } from "../git/git-test-utils";
import { createSchema } from "../../scripts/create-schema";
import { boilerplateSubscribe } from "../testUtils";

logger.setLevel("silly");

type StartServer = (customServerConfig: any) => Observable<Server>;

export const defaultTestServerconfig = Object.freeze({
    authentication_type: "basic"
});

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
    return serverProvider(() => configData, iconHandlers);
};

export const startServerWithBackdoors: StartServer = customConfig =>
    startServer(Object.assign(customConfig, {enable_backdoors: true}));

export const setUpGitRepoAndDbSchemaAndServer = (
    pool: Pool,
    assignServer: (sourceServer: Server) => void,
    done: () => void
) => {
    createTestGitRepo()
        .flatMap(() => createSchema(pool))
        .flatMap(() => startServerWithBackdoors({icon_data_location_git: getTestRepoDir()}))
        .map(testServer => assignServer(testServer))
    .subscribe(boilerplateSubscribe(fail, done));
};

export const tearDownGitRepoAndServer = (server: Server, done: () => void) => {
    delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
    deleteTestGitRepo()
        .map(() => server.close())
    .subscribe(boilerplateSubscribe(fail, done));
};

export const getURL = (server: http.Server, path: string) => `http://localhost:${server.address().port}${path}`;
export const getURLBasicAuth = (
    server: http.Server,
    auth: string,
    path: string) => `http://${auth}@localhost:${server.address().port}${path}`;

interface IUploadRequestBuffer {
    readonly value: Buffer;
    readonly options: {
        readonly filename: string
    };
}
export const createUploadBuffer: (size: number, filename?: string) => IUploadRequestBuffer
= (size, filename = "a-file") => ({
    value: crypto.randomBytes(4096),
    options: {
        filename: "a-filename"
    }
});

interface IRequestResult {
    readonly response: request.Response;
    readonly body: any;
}
type TestRequest = (
    options: any
) => Observable<IRequestResult>;

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
    Observable.create((observer: Observer<IRequestResult>) => {
        req(Object.assign(options, authDEV),
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
    server: http.Server,
    username: string,
    privileges: string[],
    jar: any
) => testRequest({
    url: getURL(server, authenticationBackdoorPath),
    method: "PUT",
    json: {username, privileges},
    jar
})
.map(
    result => {
        if (result.response.statusCode !== 200) {
            throw Error("Failed to set test authentication: " + result.response.statusCode);
        }
        return server;
    }
)
.catch(error => {
    fail(error);
    return Observable.throw(error);
});

export interface IUploadFormData {
    readonly iconFile: IUploadRequestBuffer;
}

export interface ICreateIconFormData extends IUploadFormData {
    readonly name: string;
    readonly format: string;
    readonly size: string;
}

export const createAddIconFormData: (name: string, format: string, size: string) => ICreateIconFormData
= (name, format, size) => ({ name, format, size, iconFile: createUploadBuffer(4096) });

export const convertToAddIconRequest: (formData: ICreateIconFormData) => CreateIconInfo = formData => ({
    name: formData.name,
    format: formData.format,
    size: formData.size,
    content: formData.iconFile.value
});

export const convertToIconInfo: (iconFormData: ICreateIconFormData, id: number) => IconDescriptor
= (iconFormData, id) => new IconDescriptor(
    iconFormData.name,
    null).addIconFile({
        format: iconFormData.format,
        size: iconFormData.size
    });

export const createAddIconFileFormData: () => IUploadFormData = () => ({
    iconFile: createUploadBuffer(4096)
});

interface TestUploadRequestData {
    url: string;
    method: string;
    formData: IUploadFormData;
    jar: request.CookieJar;
}
type TestUploadRequest = (requestData: TestUploadRequestData) => Observable<IRequestResult>;
export const testUploadRequest: TestUploadRequest
    = uploadRequestData => testRequest({...uploadRequestData, json: true});

export const iconEndpointPath = "/icons";
export const iconFileEndpointPath = "/icons/:id/formats/:format/sizes/:size";
