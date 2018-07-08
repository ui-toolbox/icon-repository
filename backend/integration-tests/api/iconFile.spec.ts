import { createTestGitRepo, deleteTestGitRepo, getTestRepoDir } from "../git/git-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { createTestPool, terminateTestPool, createTestSchema } from "../db/db-test-utils";
import {
    IHTTPStatusTestParams,
    testHTTPStatus,
    createUploadFormData,
    startServerWithBackdoors,
    setAuthentication,
    testRequest,
    getURL,
    iconEndpointPath,
    iconFileEndpointPath} from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { Pool } from "pg";
import * as request from "request";
import { Observable } from "rxjs";

describe(iconFileEndpointPath, () => {
    let pool: Pool;

    beforeEach(done => {
        createTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });

    afterEach(done => {
        delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
        deleteTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });

    beforeAll(done => createTestPool(p => pool = p, fail, done));
    afterAll(done => terminateTestPool(pool, done));
    beforeEach(done => createTestSchema(pool, fail, done));

    it ("POST should fail with 403 without either of CREATE_ICON or ADD_ICON_FILE privilege", done => {
        const params: IHTTPStatusTestParams = {
            serverOptions: {icon_data_location_git: getTestRepoDir()},
            requestOptions: {
                url: iconFileEndpointPath,
                method: "POST"
            },
            authentication: {
                username: "zazie",
                privileges: []
            },
            expectedStatusCode: 403,
            fail,
            done
        };
        testHTTPStatus(params);
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        const params: IHTTPStatusTestParams = {
            serverOptions: {icon_data_location_git: getTestRepoDir()},
            requestOptions: {
                url: iconFileEndpointPath,
                method: "POST"
            },
            authentication: {
                username: "zazie",
                privileges
            },
            expectedStatusCode: 201,
            fail,
            done
        };
        testHTTPStatus(params);
    });

    it ("POST should complete with ADD_ICON_FILE privilege", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FILE
        ];
        const params: IHTTPStatusTestParams = {
            serverOptions: {icon_data_location_git: getTestRepoDir()},
            requestOptions: {
                url: iconFileEndpointPath,
                method: "POST"
            },
            authentication: {
                username: "zazie",
                privileges
            },
            expectedStatusCode: 201,
            fail,
            done
        };
        testHTTPStatus(params);
    });

    it ("GET should return the requested icon file as specified by format and size", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const jar = request.jar();
        const formData = createUploadFormData("cartouche");

        startServerWithBackdoors({icon_data_location_git: getTestRepoDir()})
        .flatMap(server =>
            setAuthentication(server, "zazie", privileges, jar)
            .flatMap(() =>
                testRequest({
                    url: getURL(server, iconEndpointPath),
                    method: "POST",
                    formData,
                    json: true,
                    jar
                })
                .flatMap(result => {
                    if (result.response.statusCode !== 201) {
                        throw Error("Could not create the icon: " + result.response.statusCode);
                    }
                    return testRequest({
                        url: getURL(
                            server,
                            `/icon/${result.body.iconId}/format/${formData.fileFormat}/size/${formData.iconSize}`
                        ),
                        method: "GET",
                        jar
                    })
                    .map(getResult => {
                        const actualContent = Buffer.from(getResult.body, "binary");
                        expect(getResult.response.statusCode).toEqual(200);
                        expect(Buffer.compare(actualContent, formData.iconFile.value)).toEqual(0);
                        server.close();
                    })
                    .catch(error => {
                        server.close();
                        return Observable.throw(error);
                    });
                })
            )
        )
        .subscribe(boilerplateSubscribe(fail, done));

    });
});
