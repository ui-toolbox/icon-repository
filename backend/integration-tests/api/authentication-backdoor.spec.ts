import * as superagent from "superagent";
import { startServer, getBaseUrl, uxAuth, manageTestResourcesBeforeAfter } from "./api-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { authenticationBackdoorPath, setAuth } from "./api-client";
import { Observable } from "rxjs";

describe("backdoor to privileges", () => {
    it("mustn't be available by default", done => {
        startServer({})
        .flatMap(server =>
            superagent
                .post(`${getBaseUrl()}/backdoor/authentication`)
                .auth("ux", "ux")
                .ok(resp => resp.status === 404)
                .then(
                    () => {
                        server.close();
                        done();
                    },
                    error => {
                        server.close();
                        fail(error);
                        done();
                    }
                )
                .catch(error => {
                    server.close();
                    fail(error);
                    done();
                })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should be available when enabled", done => {
        startServer({enable_backdoors: true})
        .flatMap(server =>
            superagent
                .get(`${getBaseUrl()}/backdoor/authentication`)
                .auth("ux", "ux")
                .ok(resp => resp.status === 200)
                .then(
                    () => {
                        server.close();
                        done();
                    },
                    error => {
                        server.close();
                        fail(error);
                        done();
                    }
                )
                .catch(error => {
                    server.close();
                    fail(error);
                    done();
                })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});

describe(authenticationBackdoorPath, () => {
    const agent = manageTestResourcesBeforeAfter();

    it("should allow to set privileges on the current session", done => {
        const testPrivileges = [ "asdf" ];

        const session = agent();
        setAuth(session.requestBuilder(), testPrivileges)
        .flatMap(() =>
            session.requestBuilder()
            .get("/backdoor/authentication")
            .then(
                result => {
                    expect(result.body).toEqual(testPrivileges);
                    done();
                },
                error => {
                    fail(error);
                    done();
                }
            )
            .catch(error => {
                fail(error);
                done();
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
