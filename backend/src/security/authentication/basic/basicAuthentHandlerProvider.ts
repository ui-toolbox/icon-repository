import { Request, Response, NextFunction, Handler } from "express";
import { of } from "rxjs";
import { flatMap, map } from "rxjs/operators";
import { AuthenticationDataSource } from "../common";
import loggerFactory from "../../../utils/logger";
import { storeAuthentication, Authentication, GetAllPrivilegesForUser } from "../../common";

const getAuthorizationHeader: (req: Request) => string
= req => (req.headers.authorization as string) || "";

const getCredentials: (req: Request) => {username: string, password: string}
= req => {
    const b64auth = getAuthorizationHeader(req).split(" ")[1] || "";
    const strauth = new Buffer(b64auth, "base64").toString();
    const splitIndex = strauth.indexOf(":");
    const login = strauth.substring(0, splitIndex);
    const password = strauth.substring(splitIndex + 1);
    return {
        username: login,
        password
    };
};

export type BasicAuthenticationHandlerProvider = (
    authenticationDatasource: AuthenticationDataSource,
    getAllPrivilegesForUser: GetAllPrivilegesForUser) => Handler;

const basicAuthenticationHandlerProvider: BasicAuthenticationHandlerProvider
= (authenticationDatasource, getAllPrivilegesForUser) => (req: Request, res: Response, next: NextFunction) => {
    const ctxLogger = loggerFactory("basic-authentication-handler");
    const currentCreds = getCredentials(req);
    authenticationDatasource(currentCreds)
    .pipe(
        flatMap(matchFound => matchFound
            ? getAllPrivilegesForUser(currentCreds.username)
                .pipe(
                    map(privileges => storeAuthentication(
                        req.session,
                        new Authentication(currentCreds.username, privileges)
                    )),
                    map(() => next())
                )
            : of(res.set("WWW-Authenticate", "Basic").status(401).end()))
    )
    .subscribe(
        () => void 0,
        error => {
            const errmsg = `Error during authentication: ${error}`;
            ctxLogger.error(errmsg);
            res.status(500).send(errmsg).end();
        },
        () => void 0
    );
};

export default basicAuthenticationHandlerProvider;
