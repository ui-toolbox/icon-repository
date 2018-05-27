import * as qs from "qs";
import * as util from "util";
import * as Rx from "rxjs/Rx";
import * as _ from "lodash";

import * as appUtil from "../../util";

// @ts-ignore
import jose = require("jsrsasign");

import logger, { ContextAbleLogger } from "../../logger";

const sformat = util.format;

export class Authentication {
    public readonly userName: string;

    constructor(userName: string) {
        this.userName = userName;
    }
}

export interface IAuthorizationToken {
    scope: string;
    access_token: string;
    refresh_token: string;
    id_token: string;
}

export default (
    clientID: string,
    clientSecret: string,
    redirectURL: string,
    accessTokenURL: string,
    jwtPublicKeyURL: string,
    jwtPublicKeyPEM: string,
    tokenIssuer: string
) => {

    const encodedClientCredentials = () => {
        return new Buffer(clientID + ":" + clientSecret).toString("base64");
    };

    const requestAuthorizationToken: (code: string) => Rx.Observable<IAuthorizationToken> = code => {
        const formData: string = qs.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectURL
        });

        const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + encodedClientCredentials()
        };

        return appUtil.doFetch<IAuthorizationToken>(accessTokenURL, "POST", headers, formData);
    };

    const getIdProviderPublicKey: () => Rx.Observable<string> = () => {
        if (jwtPublicKeyPEM) {
            return Rx.Observable.of(jwtPublicKeyPEM);
        } else {
            return requestPublicKeyFromIDProvider()
                .map(publicKey => {
                    logger.createChild("pk from IP")
                        .verbose("Extracting JWS public key from ", publicKey);
                    return jose.KEYUTIL.getKey(publicKey);
                });
        }
    };

    const requestPublicKeyFromIDProvider: () => Rx.Observable<string> = () => {
        return appUtil.doFetch(jwtPublicKeyURL, "GET", {}, void 0, true);
    };

    const parseVerifyAuthorizationToken: (token: IAuthorizationToken, publicKey: any) => Authentication
    = (token, publicKey) => {
        const ctxLogger = logger.createChild("oidcAuthentication#parseAuthorizationToken");
        let signatureValid: boolean;
        try {
            signatureValid = jose.jws.JWS.verify(token.id_token, publicKey, ["RS256"]);
        } catch (error) {
            tokenVerificationFailed(ctxLogger, error);
        }
        if (!signatureValid) {
            tokenVerificationFailed(ctxLogger, "Public key verification failed on token");
        } else {
            ctxLogger.verbose("Public key verification OK");

            const tokenParts = token.id_token.split(".");
            ctxLogger.debug("Nr. of tokenParts: ", tokenParts.length);

            const payload = JSON.parse(appUtil.fromBase64(tokenParts[1]));
            ctxLogger.debug("Payload: %O", payload);

            if (payload.iss === tokenIssuer) {
                ctxLogger.verbose("Issuer OK");
                if ((Array.isArray(payload.aud) && _.includes(payload.aud, clientID)) || payload.aud === clientID) {
                    ctxLogger.verbose("Audience OK");

                    const now = Math.floor(Date.now() / 1000);

                    if (payload.iat <= now) {
                        ctxLogger.verbose("Issued-at OK");
                        if (payload.exp >= now) {
                            ctxLogger.verbose("Expiration OK");
                            ctxLogger.verbose("Token valid!");

                            return payload.sub;
                        } else {
                            tokenVerificationFailed(ctxLogger, "Invalid payload.exp", payload.exp);
                        }
                    } else {
                        tokenVerificationFailed(ctxLogger, "Invalid payload.iat", payload.iat);
                    }
                } else {
                    tokenVerificationFailed(ctxLogger, "Invalid payload.aud", payload.aud);
                }
            } else {
                tokenVerificationFailed(ctxLogger, "Invalid payload.iss", payload.iss);
            }
        }
        tokenVerificationFailed(ctxLogger, "Something went wrong during token parsing");
    };

    const authenticateByCode: (reqState: string, resState: string, code: string) => Rx.Observable<Authentication>
    = (reqState, resState, code) => {
        const ctxLogger = logger.createChild("oidcAuthentication#authenticateByCode");
        if (typeof resState === "undefined") {
            tokenVerificationFailed(ctxLogger, "OIDC authorization state shouldn't be undefined");
        }
        if (resState === reqState) {
            logger.verbose("State value matches: expected %s got %s", reqState, resState);
        } else {
            tokenVerificationFailed(ctxLogger, "State DOES NOT MATCH: expected %s got %s", reqState, resState);
        }

        return Rx.Observable.forkJoin(
            requestAuthorizationToken(code),
            getIdProviderPublicKey()
        ).map(result => parseVerifyAuthorizationToken(result[0], result[1]));
    };

    const tokenVerificationFailed = (ctxtLogger: ContextAbleLogger, message: string, ...args: any[]) => {
        ctxtLogger.error(message, args);
        appUtil.throwErrorWOStackTrace("Authentication failed");
    };

    return authenticateByCode;
};
