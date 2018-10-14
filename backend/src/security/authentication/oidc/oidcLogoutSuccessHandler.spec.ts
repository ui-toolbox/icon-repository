import oidcLogoutSuccessHandler from "./oidcLogoutSuccessHandler";

import config, { ConfigurationDataProvider } from "../../../configuration";

import { Request, Response } from "express";
import { Observable } from "rxjs";
import { Mock } from "ts-mocks";

const getConfigProviderWithLogoutURLAndContextPathSet: (logoutURLValue: string, contextPath: string)
        => Observable<ConfigurationDataProvider>
= (logoutURLValue, contextPath) =>
    config
    .map(configData => () => Object.assign(configData(), {
            server_url_context: contextPath,
            oidc_ip_logout_url: logoutURLValue
        }));

describe("oidcLogoutSuccessHandler", () => {
    const someLogoutURL = "some-logout-url";
    const someProtocol = "https";
    const someHostname = "some-hostname";
    const someContextPath = "some-ctxpath";

    let req: Request;

    beforeEach(() => {
        req = new Mock<Request>({protocol: someProtocol, hostname: someHostname, headers: {}}).Object;
    });

    it("should redirect to the logoutURL (if any is specified) with the correct query params", done => {
        const res = new Mock<Response>({redirect: () => new Mock<Response>().Object}).Object;

        getConfigProviderWithLogoutURLAndContextPathSet(someLogoutURL, someContextPath)
        .subscribe(
            configProvider => {
                oidcLogoutSuccessHandler(
                    configProvider().oidc_ip_logout_url,
                    configProvider().server_url_context
                )(req, res);
                expect(res.redirect).toHaveBeenCalledWith(
                    307,
                    `${someLogoutURL}?service=${someProtocol}://${someHostname}/${someContextPath}`
                );
                done();
            }
        );
    });

    it("should simply end the request with success status, if no logoutURL is specified", done => {
        const res = new Mock<Response>({end: () => new Mock<Response>().Object}).Object;

        getConfigProviderWithLogoutURLAndContextPathSet(void 0, void 0)
        .subscribe(
            configProvider => {
                oidcLogoutSuccessHandler(
                    configProvider().oidc_ip_logout_url,
                    configProvider().server_url_context
                )(req, res);
                expect(res.end).toHaveBeenCalledWith(200);
                done();
            }
        );
    });
});
