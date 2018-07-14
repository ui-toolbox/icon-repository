import * as request from "request";
import {
    startServer,
    testRequest,
    setAuthentication } from "./api-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { authenticationBackdoorPath } from "./api-client";

describe("backdoor to privileges", () => {
    it("mustn't be available by default", done => {
        startServer({})
        .flatMap(server =>
            testRequest({
                path: "/backdoor/authentication",
                method: "POST"
            })
            .map(result => {
                expect(result.response.statusCode).toEqual(404);
            })
            .finally(() => server.close())
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should be available when enabled", done => {
        startServer({enable_backdoors: true})
        .flatMap(server =>
            testRequest({path: "/backdoor/authentication"})
            .map(result => {
                expect(result.response.statusCode).toEqual(200);
            })
            .finally(() => server.close())
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    describe(authenticationBackdoorPath, () => {
        it("should allow to set privileges on the current session", done => {
            const testPrivileges = [ "asdf" ];

            const cookieJar = request.jar();

            startServer({enable_backdoors: true})
            .flatMap(
                server => setAuthentication("dani", testPrivileges, cookieJar)
                .flatMap(
                    () => testRequest({
                            path: authenticationBackdoorPath,
                            json: true,
                            jar: cookieJar
                        })
                        .map(result => expect(result.body).toEqual(testPrivileges))
                        .finally(() => server.close())
                ))
        .subscribe(boilerplateSubscribe(fail, done));
        });
    });
});
