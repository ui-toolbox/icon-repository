import * as util from "util";
import * as crypto from "crypto";
import * as http from "http";
import * as request from "request";
import { Observable, Observer, Subscription } from "rxjs";

const req = request.defaults({
    timeout: 4000
});
// request.debug = true;

import { getDefaultConfiguration } from "../../src/configuration";
import iconDAFsProvider from "../../src/db/db";
import gitProvider from "../../src/git";
import serverProvider from "../../src/server";
import { Server } from "http";
import iconServiceProvider from "../../src/iconsService";
import iconHandlersProvider from "../../src/iconsHandlers";
import { CreateIconInfo, IconDescriptor } from "../../src/icon";
import logger from "../../src/utils/logger";
import { getTestRepoDir } from "../git/git-test-utils";

logger.setLevel("silly");

type StartServer = (customServerConfig: any) => Observable<Server>;

export const defaultTestServerconfig = Object.freeze({
    authentication_type: "basic"
});

export const startServer: StartServer = customConfig => {
    const configData = Object.assign(
        Object.assign(
            getDefaultConfiguration(),
            defaultTestServerconfig
        ),
        Object.assign(customConfig, {server_port: 0})
    );
    const iconService = iconServiceProvider(
        getDefaultConfiguration,
        iconDAFsProvider(() => configData),
        gitProvider(configData.icon_data_location_git)
    );
    const iconHandlers = iconHandlersProvider(iconService);
    return serverProvider(() => configData, iconHandlers);
};

export const startServerWithBackdoors: StartServer = customConfig =>
    startServer(Object.assign(customConfig, {enable_backdoors: true}));

export const startServerWithBackdoorsProlog:
    (fail: (error: any) => void, serverConsumer: (testServer: Server) => void) => (done: () => void) => Subscription
= (fail, serverConsumer) => done => startServerWithBackdoors({icon_data_location_git: getTestRepoDir()})
    .subscribe(
        testServer => {
            serverConsumer(testServer);
        },
        error => {
            fail(error);
            done();
        },
        done
    );
export const closeServerEpilog: (sp: () => Server) => () => void = sp => () => sp().close();

export const getURL = (server: http.Server, path: string) => `http://localhost:${server.address().port}${path}`;

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

export interface IAddIconFormData extends IUploadFormData {
    readonly iconName: string;
    readonly fileFormat: string;
    readonly iconSize: string;
}

export const createAddIconFormData: (iconName: string, format: string, size: string) => IAddIconFormData
= (iconName, format, size) => ({
    iconName,
    fileFormat: format,
    iconSize: size,
    iconFile: createUploadBuffer(4096)
});

export const convertToAddIconRequest: (formData: IAddIconFormData) => CreateIconInfo = formData => ({
    iconName: formData.iconName,
    format: formData.fileFormat,
    size: formData.iconSize,
    content: formData.iconFile.value
});

export const convertToIconInfo: (iconFormData: IAddIconFormData, id: number) => IconDescriptor
= (iconFormData, id) => new IconDescriptor(
    id,
    iconFormData.iconName,
    null).addIconFile({
        format: iconFormData.fileFormat,
        size: iconFormData.iconSize
    });

export const createAddIconFileFormData: () => IUploadFormData = () => ({
    iconFile: createUploadBuffer(4096)
});

interface ITestUploadRequestData {
    url: string;
    method: string;
    formData: IUploadFormData;
    jar: request.CookieJar;
}
type TestUploadRequest = (requestData: ITestUploadRequestData) => Observable<IRequestResult>;
export const testUploadRequest: TestUploadRequest
    = uploadRequestData => testRequest({...uploadRequestData, json: true});

export const iconEndpointPath = "/icon";
export const iconFileEndpointPath = "/icon/:id/format/:format/size/:size";
