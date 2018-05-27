import * as http from "http";
import * as request from "request";
import { Observable } from "rxjs/Observable";
import {
    startServer,
    getURL,
    testRequest,
    setAuthentication,
    authenticationBackdoorPath } from "./api-test-utils";
import serverProvider from "../src/server";

describe("backdoor to privileges", () => {
    it("mustn't be available by default", done => {
        startServer({})
        .flatMap(server =>
            testRequest({
                url: getURL(server, "/backdoor/authentication"),
                method: "POST"
            })
            .map(result => {
                expect(result.response.statusCode).toEqual(404);
                server.close();
            })
            .catch(error => {
                server.close();
                return Observable.throw(error);
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
    });

    it("should be available when enabled", done => {
        startServer({enable_backdoors: true})
        .flatMap(server =>
            testRequest({url: getURL(server, "/backdoor/authentication")})
            .map(result => {
                expect(result.response.statusCode).toEqual(200);
                server.close();
            })
            .catch(error => {
                server.close();
                return Observable.throw(error);
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
    });

    describe(authenticationBackdoorPath, () => {
        it("should allow to set privileges on the current session", done => {
            const testPrivileges = [ "asdf" ];

            const cookieJar = request.jar();

            startServer({enable_backdoors: true})
            .flatMap(
                server => setAuthentication(server, "dani", testPrivileges, cookieJar)
            )
            .flatMap(
                server => testRequest({
                        url: getURL(server, authenticationBackdoorPath),
                        json: true,
                        jar: cookieJar
                    })
                    .map(
                        result => {
                            expect(result.body).toEqual(testPrivileges);
                            server.close();
                        }
                    )
                    .catch(error => {
                        server.close();
                        return Observable.throw(error);
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
        });
    });
});
