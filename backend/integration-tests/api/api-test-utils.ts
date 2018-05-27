import * as util from "util";
import * as crypto from "crypto";
import * as http from "http";
import * as request from "request";
import * as Rx from "rxjs";
import { jar as cookieJar } from "request";
import { boilerplateSubscribe } from "../testUtils";

const req = request.defaults({
    timeout: 4000
});
// request.debug = true;

import { getDefaultConfiguration } from "../../src/configuration";
import iconDAFsProvider from "../../src/db/db";
import gitProvider from "../../src/git";
import serverProvider from "../../src/server";
import { Server } from "https";
import iconServiceProvider from "../../src/iconsService";
import iconHandlersProvider from "../../src/iconsHandlers";
import { IIconFile } from "../../src/icon";

type StartServer = (customServerConfig: any) => Rx.Observable<http.Server>;

export const startServer: StartServer = customConfig => {
    const configData = Object.assign(
        getDefaultConfiguration(),
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

export const getURL = (server: http.Server, path: string) => `http://localhost:${server.address().port}${path}`;

export interface IUploadRequestBuffer {
    value: Buffer;
    options: {
        filename: string
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
    response: request.Response;
    body: any;
}
type TestRequest = (
    options: any
) => Rx.Observable<IRequestResult>;

export const testRequest: TestRequest = options =>
    Rx.Observable.create((observer: Rx.Observer<IRequestResult>) => {
        req(options,
            (error: any, response: request.Response, body: any) => {
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
    return Rx.Observable.throw(server);
});

export interface IHTTPStatusTestParams {
    serverOptions?: any;
    requestOptions: any;
    authentication: {username: string, privileges: string[]};
    expectedStatusCode: number;
    fail: (error: any) => void;
    done: () => void;
}

type TestHTTPStatus = (params: IHTTPStatusTestParams) => void;
export const testHTTPStatus: TestHTTPStatus = params => {
    const jar = cookieJar();
    startServerWithBackdoors(params.serverOptions || {})
    .flatMap(server =>
        setAuthentication(server, params.authentication.username, params.authentication.privileges, jar)
        .flatMap(() => testRequest(Object.assign(params.requestOptions, {
                url: getURL(server, params.requestOptions.url),
                jar
            })))
            .map(result => {
                expect(result.response.statusCode).toEqual(params.expectedStatusCode);
                server.close();
            })
            .catch(error => {
                server.close();
                return Rx.Observable.throw(error);
            })
    )
    .subscribe(boilerplateSubscribe(params.fail, params.done));
};

export interface IUploadFormData {
    iconName: string;
    modifiedBy: string;
    fileFormat: string;
    iconSize: string;
    iconFile: IUploadRequestBuffer;
}

export const createUploadFormData: (iconName: string) => IUploadFormData = iconName => ({
    iconName,
    modifiedBy: "zazie",
    fileFormat: "french",
    iconSize: "great",
    iconFile: createUploadBuffer(4096)
});

export const convertToIconFileInfo: (formData: IUploadFormData) => IIconFile = formData => ({
    iconName: formData.iconName,
    format: formData.fileFormat,
    size: formData.iconSize,
    content: formData.iconFile.value
});

export const iconEndpointPath = "/icon";
export const iconFileEndpointPath = "/icon/:id/format/:format/size/:size";
