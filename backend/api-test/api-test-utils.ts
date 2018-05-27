import * as http from "http";
import * as request from "request";
import * as Rx from "rxjs";
import { jar as cookieJar } from "request";

const req = request.defaults({
    timeout: 4000
});

import { getDefaultConfiguration } from "../src/configuration";
import serverProvider from "../src/server";
import { Server } from "https";

type StartServer = (customServerConfig: any) => Rx.Observable<http.Server>;

export const startServer: StartServer = customConfig => serverProvider(
    () => Object.assign(
        getDefaultConfiguration(),
        Object.assign(customConfig, {server_port: 0})
    )
);

export const startServerWithBackdoors: StartServer = customConfig =>
    startServer(Object.assign(customConfig, {enable_backdoors: true}));

export const getURL = (server: http.Server, path: string) => `http://localhost:${server.address().port}${path}`;

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
                    observer.error("error in request");
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
    return Rx.Observable.of(server);
});

type TestHTTPStatus = (
    url: string,
    method: string,
    authentication: {username: string, privileges: string[]},
    expectedStatusCode: number,
    fail: (error: any) => void,
    done: () => void
) => void;
export const testHTTPStatus: TestHTTPStatus = (url, method, authentication, expectedStatusCode, fail, done) => {
    const jar = cookieJar();
    startServerWithBackdoors({})
    .flatMap(server => setAuthentication(server, authentication.username, authentication.privileges, jar))
    .flatMap(server => testRequest({
            url: getURL(server, url),
            method,
            jar
        })
        .map(result => {
            expect(result.response.statusCode).toEqual(expectedStatusCode);
            server.close();
        })
        .catch(error => {
            server.close();
            return Rx.Observable.of(server);
        })
    )
    .subscribe(
        () => {
            done();
        },
        error => {
            fail(error);
            done();
        }
    );
};
