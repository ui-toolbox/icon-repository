import * as util from "util";
import * as express from "express";

import { storeAuthentication, getAuthentication } from "../../common";

import oidcCreateRequestTokenURL from "./oidcRequestTokenURLFactory";
import authenticateByCode from "./oidcAuthentication";
import logger from "../../../utils/logger";
import { ConfigurationDataProvider } from "../../../configuration";
import { fromBase64 } from "../../../utils/encodings";

const ctxLogger = logger.createChild("oidc-login-handler");

export default (
    appConfigProvider: ConfigurationDataProvider
) =>
(req: express.Request, res: express.Response, next: express.NextFunction) => {

    const authorizationURL = appConfigProvider().oidc_user_authorization_url;
    const redirectURL = appConfigProvider().oidc_client_redirect_back_url;
    const clientID = appConfigProvider().oidc_client_id;
    const clientSecret = appConfigProvider().oidc_client_secret;

    if (req.query.error) {
        ctxLogger.error("Request has (returned with) an error", req.query.error);
        res.end(400, req.query.error);
    } else if (req.session && getAuthentication(req.session)) {
        ctxLogger.verbose("Already logged in");
        res.redirect(appConfigProvider().server_url_context);
    } else if (!req.query || !req.query.code) {
        const tokenRequestURL: URL = oidcCreateRequestTokenURL(
            authorizationURL,
            clientID,
            redirectURL
        );
        req.session.oidcTokenRequestState = tokenRequestURL.searchParams.get("state");
        ctxLogger.verbose("About to redirect to " + tokenRequestURL.toString());
        res.redirect(tokenRequestURL.toString());
    } else {
        authenticateByCode(
            clientID,
            clientSecret,
            redirectURL,
            appConfigProvider().oidc_access_token_url,
            appConfigProvider().oidc_ip_jwt_public_key_url,
            fromBase64(appConfigProvider().oidc_ip_jwt_public_key_pem_base64),
            appConfigProvider().oidc_token_issuer)
                    (req.session.oidcTokenRequestState, req.query.state, req.query.code)
        .toPromise()
        .then(
            auth => {
                storeAuthentication(req.session, auth);
                next();
            },
            err => authenticationError(err, res)
        ).catch(err => {
            authenticationError(err, res);
        });
    }
};

const authenticationError = (err: Error, res: express.Response) => {
    ctxLogger.error("Error during authentication: $o", err);
    res.status(500).send("Internal error during authentication");
};
