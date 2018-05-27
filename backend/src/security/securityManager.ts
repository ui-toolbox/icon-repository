import { Observable } from "rxjs";
import { Set } from "immutable";
import * as util from "util";
import * as express from "express";

import * as cookieParser from "cookie-parser";
import * as session from "express-session";
// @ts-ignore
import sessionMemoryStoreFactory = require("session-memory-store");

import { ConfigurationDataProvider } from "./../configuration";

import oidcLoginHandlerProvider from "./authentication/oidc/oidcLoginRouteHandler";
import oidcLogoutSuccessHandlerProvider from "./authentication/oidc/oidcLogoutSuccessHandler";
import basicAuthentHandlerProvider from "./authentication/basic/basicAuthentHandlerProvider";
import builtinAuthenticationSource from "./authentication/builtin-source";
import {
    privilegeResourcesProvider,
    allPrivilegesForUserGetterProvider
} from "./authorization/privileges/priv-config";
import { hasRequiredPrivileges } from "./authorization/privileges/priv-enforcement";
import logger from "./../utils/logger";
import randomstring from "./../utils/randomstring";

import backdoors from "./backdoors";
import { getAuthentication, Authentication, storeAuthentication, GetAllPrivilegesForUser } from "./common";

const ONE_DAY_AS_SECS = 60 * 60 * 24;

const createAuthenticationInterceptor = (serverContext: string, basicAuthentHandler: express.Handler = void 0) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    const ctxLogger = logger.createChild("authenticationInterceptor");
    const loginPage = serverContext + "/login";

    if (ctxLogger.isLevelEnabled("silly")) {
        (Object.keys(req.headers)).forEach(key => {
            logger.silly(key + ": " + req.headers[key]);
        });
    }

    ctxLogger.verbose("request URL: %s, method: %s", req.url, req.method);
    if (!req.url.endsWith("login") && !getAuthentication(req.session)) {
        req.session.lastDenied = req.url;
        if (basicAuthentHandler) {
            basicAuthentHandler(req, res, next);
        } else {
            ctxLogger.verbose(req.url + ": Unauthenticated user is about to be redirected to login page: " + loginPage);
            res.redirect(loginPage);
        }
    } else {
        ctxLogger.verbose(req.url + ": letting pass:", getAuthentication(req.session));
        next();
    }
};

const privilegeCheckInterceptor = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    const ctxLogger = logger.createChild("privilegeCheckInterceptor");
    if (hasRequiredPrivileges(req)) {
        ctxLogger.silly(req.url + ": letting pass:", getAuthentication(req.session));
        next();
    } else {
        const auth: Authentication = getAuthentication(req.session);
        ctxLogger.debug("Missing privilege(s): possessed %o", auth
                            ? auth.privileges
                            : []);
        res.status(403).end();
    }
};

type AttachUserPrivileges = (currentSession: Express.Session) => Observable<void>;

const attachUserPrivilegesProvider: (getAllPrivilegesForUser: GetAllPrivilegesForUser) => AttachUserPrivileges
= getAllPrivilegesForUser => currentSession => {
    const ctxLogger = logger.createChild("remember-user-privileges");
    if (!currentSession || !getAuthentication(currentSession)) {
        ctxLogger.error(
            "Illegal state: no session or authentication information associated with the request",
            currentSession
        );
        throw new Error("Illegal state: no username associated with the request");
    }

    return getAllPrivilegesForUser(getAuthentication(currentSession).username)
    .map(privileges => {
        storeAuthentication(currentSession, getAuthentication(currentSession).setPrivileges(privileges));
        ctxLogger.info("Authentication after setting privileges %o", getAuthentication(currentSession));
    });
};

const loginSuccessHandlerProvider: (attachUserPrivileges: AttachUserPrivileges, serverContextPath: string) => (
    req: express.Request,
    res: express.Response
) => void
= (attachUserPrivileges, serverContextPath) => (req, res) => {
    const ctxLogger = logger.createChild("loginSuccessHandlerProvider");

    attachUserPrivileges(req.session)
    .subscribe(() => {
            ctxLogger.info(`Redirecting to ${serverContextPath}`);
            res.redirect(serverContextPath);
        },
        err => {
            ctxLogger.error("Error while setting privileges: %o", err);
            res.end(500, "Error during login");
        }
    );
};

const userInfoHandler = (req: express.Request, res: express.Response) => {
    logger.createChild("user-info-handler").debug("returning: %o", getAuthentication(req.session));
    const auth: Authentication = getAuthentication(req.session);
    res.send({
        username: auth.username,
        privileges: auth.privileges
    });
};

type LogoutSuccessHandler = (req: express.Request, res: express.Response) => void;

const createLogoutHandler = (logoutSuccessHandler?: LogoutSuccessHandler) => {
    const ctxLogger = logger.createChild("securityManager#createLogoutHandler");
    return (req: express.Request,
            res: express.Response) => {
        ctxLogger.debug("handler called");
        if (req.session) {
            req.session.destroy(err => {
                if (err) {
                    ctxLogger.error("Error while logging out: %o", err);
                    res.status(500).send(util.format("Logout failed %O", err));
                } else {
                    ctxLogger.verbose("User successfully logged out");
                    if (logoutSuccessHandler) {
                        logoutSuccessHandler(req, res);
                    } else {
                        res.status(200).end();
                    }
                }
            });
        } else {
            res.status(200).end();
        }
    };
};

export default (appConfigProvider: ConfigurationDataProvider) => {
    const setupSessionManagement = (app: express.Express) => {
        // @ts-ignore
        const sessionStore: MemoryStore = new sessionMemoryStoreFactory(session)({
            expires: ONE_DAY_AS_SECS / 2,
            checkperiod: 10 * 60
        });

        // @ts-ignore
        app.use(session({
            name: "JS-SESSION",
            secret: randomstring(8),
            store: sessionStore,
            cookie: {
                // secure: true,
                httpOnly: true,
                // domain: "example.com",
                path: appConfigProvider().server_url_context,
                expires: void 0
            }
        }));
    };

    const setupRoutes: (router: express.Router) => void = router => {
        const ctxLogger = logger.createChild("security-manager#setup-routes");
        const authType = appConfigProvider().authentication_type;

        ctxLogger.debug(`Authentication type: ${authType}`);

        const getAllPrivilegesForUser: GetAllPrivilegesForUser = allPrivilegesForUserGetterProvider(
            privilegeResourcesProvider(appConfigProvider().users_by_roles)
        );

        const attachUserPrivileges: AttachUserPrivileges = attachUserPrivilegesProvider(getAllPrivilegesForUser);

        let loginHandler: express.Handler;
        const loginSuccessHandler: express.Handler = loginSuccessHandlerProvider(
            attachUserPrivileges, appConfigProvider().server_url_context
        );
        let logoutSuccessHandler: LogoutSuccessHandler;
        let basicAuthentHandler: express.Handler;

        if (authType === "oidc") {
            loginHandler = oidcLoginHandlerProvider(appConfigProvider);
            logoutSuccessHandler = oidcLogoutSuccessHandlerProvider(
                appConfigProvider().oidc_ip_logout_url,
                appConfigProvider().server_url_context
            );
        } else if (authType === "basic") {
            ctxLogger.warn("Authentication type is: %s", authType);
            basicAuthentHandler = basicAuthentHandlerProvider(builtinAuthenticationSource, getAllPrivilegesForUser);
            loginHandler = basicAuthentHandler;
        } else {
            throw new Error(`Unexpected authentication type: ${authType}`);
        }

        router.get(
            "/login",
            loginHandler,
            loginSuccessHandler
        );
        router.use(
            createAuthenticationInterceptor(
                appConfigProvider().server_url_context,
                basicAuthentHandler
            )
        );
        router.use(privilegeCheckInterceptor);
        router.post("/logout", createLogoutHandler(logoutSuccessHandler));
        router.get("/user", userInfoHandler);

        if (appConfigProvider().enable_backdoors) {
            router.use("/backdoor", backdoors);
        }
    };

    return {
        setupSessionManagement,
        setupRoutes
    };
};
