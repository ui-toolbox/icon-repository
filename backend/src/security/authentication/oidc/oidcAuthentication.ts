import * as qs from "qs";
import * as _ from "lodash";

// @ts-ignore
import jose = require("jsrsasign");

import loggerFactory from "../../../utils/logger";
import * as errorHandling from "../../../utils/error-handling";
import doFetch from "../../../utils/fetch";
import { fromBase64 } from "../../../utils/encodings";
import { Authentication } from "../../common";
import { Logger } from "winston";
import { Observable, of, forkJoin } from "rxjs";
import { map } from "rxjs/operators";

export interface IAuthorizationToken {
    readonly scope: string;
    readonly access_token: string;
    readonly refresh_token: string;
    readonly id_token: string;
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
        return Buffer.from(clientID + ":" + clientSecret).toString("base64");
    };

    const requestAuthorizationToken: (code: string) => Observable<IAuthorizationToken> = code => {
        const formData: string = qs.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectURL
        });

        const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + encodedClientCredentials()
        };

        return doFetch<IAuthorizationToken>(accessTokenURL, "POST", headers, formData);
    };

    const getIdProviderPublicKey: () => Observable<string> = () => {
        if (jwtPublicKeyPEM) {
            return of(jwtPublicKeyPEM);
        } else {
            return requestPublicKeyFromIDProvider()
                .pipe(
                    map(publicKey => {
                        loggerFactory("pk from IP")
                            .verbose("Extracting JWS public key from ", publicKey);
                        return jose.KEYUTIL.getKey(publicKey);
                    })
                );
        }
    };

    const requestPublicKeyFromIDProvider: () => Observable<string> = () => {
        return doFetch(jwtPublicKeyURL, "GET", {}, void 0, true);
    };

    const parseVerifyAuthorizationToken: (token: IAuthorizationToken, publicKey: any) => Authentication
    = (token, publicKey) => {
        const ctxLogger = loggerFactory("oidcAuthentication#parseAuthorizationToken");
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

            const payload = JSON.parse(fromBase64(tokenParts[1]));
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
                            return new Authentication(payload.sub, null);
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

    const tokenVerificationFailed = (ctxtLogger: Logger, message: string, ...args: any[]) => {
        ctxtLogger.error(message, args);
        errorHandling.throwErrorWOStackTrace("Authentication failed");
    };

    const authenticateByCode: (reqState: string, resState: string, code: string) => Observable<Authentication>
    = (reqState, resState, code) => {
        const ctxLogger = loggerFactory("oidcAuthentication#authenticateByCode");
        if (typeof resState === "undefined") {
            tokenVerificationFailed(ctxLogger, "OIDC authorization state shouldn't be undefined");
        }
        if (resState === reqState) {
            ctxLogger.verbose("State value matches: expected %s got %s", reqState, resState);
        } else {
            tokenVerificationFailed(ctxLogger, "State DOES NOT MATCH: expected %s got %s", reqState, resState);
        }

        return forkJoin(
            requestAuthorizationToken(code),
            getIdProviderPublicKey()
        ).pipe(map(result => parseVerifyAuthorizationToken(result[0], result[1])));
    };

    return authenticateByCode;
};
