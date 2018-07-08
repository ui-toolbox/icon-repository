import * as Rx from "rxjs";
import { startServer, testRequest, getURL } from "./api-test-utils";
import { boilerplateSubscribe } from "../testUtils";

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
