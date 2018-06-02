import * as Rx from "rxjs";
import { startServer, testRequest, getURL } from "./api-test-utils";

const iconsFormatPath = "/icons/formats";

describe(iconsFormatPath, () => {
    it("should return the correct default", done => {
        startServer({})
        .flatMap(server => testRequest({
                            url: getURL(server, iconsFormatPath)
                        })
                        .map(result => {
                            expect(JSON.parse(result.response.body)).toEqual([
                                "svg",
                                "1x",
                                "2x",
                                "3x"
                            ]);
                            return server;
                        })
                        .catch(error => {
                            fail(error);
                            return Rx.Observable.of(server);
                        })
        )
        .subscribe(
            server => {
                server.close();
                done();
            },
            error => {
                fail(error);
                done();
            }
        );
    });
});
