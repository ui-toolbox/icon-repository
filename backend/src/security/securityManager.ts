import { Observable } from "rxjs";
import * as util from "util";
import * as express from "express";

import * as session from "express-session";
// @ts-ignore
import sessionMemoryStoreFactory = require("session-memory-store");

import { ConfigurationData } from "./../configuration";

import oidcLoginHandlerProvider from "./authentication/oidc/oidcLoginRouteHandler";
import oidcLogoutSuccessHandlerProvider from "./authentication/oidc/oidcLogoutSuccessHandler";
import basicAuthentHandlerProvider from "./authentication/basic/basicAuthentHandlerProvider";
import builtinAuthenticationSource from "./authentication/builtin-source";
import {
    privilegeResourcesProvider,
    allPrivilegesForUserGetterProvider
} from "./authorization/privileges/priv-config";
import { hasRequiredPrivileges } from "./authorization/privileges/priv-enforcement";
import loggerFactory, { getDefaultLogLevel } from "./../utils/logger";
import randomstring from "./../utils/randomstring";

import backdoors from "./backdoors";
import { getAuthentication, Authentication, storeAuthentication, GetAllPrivilegesForUser } from "./common";
import { map } from "rxjs/operators";

const ONE_DAY_AS_SECS = 60 * 60 * 24;

const createAuthenticationInterceptor = (serverContext: string, basicAuthentHandler: express.Handler = void 0) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    const ctxLogger = loggerFactory("authenticationInterceptor");
    const loginPage = serverContext + "/login";

    if (getDefaultLogLevel() === "silly") {
        (Object.keys(req.headers)).forEach(key => {
            ctxLogger.silly(key + ": " + req.headers[key]);
        });
    }

    ctxLogger.debug("request URL: %s, method: %s", req.url, req.method);
    if (!req.url.endsWith("login") && !getAuthentication(req.session)) {
        req.session.lastDenied = req.url;
        if (basicAuthentHandler) {
            basicAuthentHandler(req, res, next);
        } else {
            ctxLogger.debug(req.url + ": Unauthenticated user is about to be redirected to login page: " + loginPage);
            res.redirect(loginPage);
        }
    } else {
        ctxLogger.debug(req.url + ": letting pass:", getAuthentication(req.session));
        next();
    }
};

const privilegeCheckInterceptor = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    const ctxLogger = loggerFactory("privilegeCheckInterceptor");
    if (hasRequiredPrivileges(req)) {
        ctxLogger.silly(req.url + ": letting pass:", getAuthentication(req.session));
        next();
    } else {
        const auth: Authentication = getAuthentication(req.session);
        ctxLogger.debug("Missing privilege(s): %o", getAuthentication(req.session));
        res.status(403).end();
    }
};

type AttachUserPrivileges = (currentSession: Express.Session) => Observable<void>;

const attachUserPrivilegesProvider: (getAllPrivilegesForUser: GetAllPrivilegesForUser) => AttachUserPrivileges
= getAllPrivilegesForUser => currentSession => {
    const ctxLogger = loggerFactory("remember-user-privileges");
    if (!currentSession || !getAuthentication(currentSession)) {
        ctxLogger.error(
            "Illegal state: no session or authentication information associated with the request",
            currentSession
        );
        throw new Error("Illegal state: no username associated with the request");
    }

    return getAllPrivilegesForUser(getAuthentication(currentSession).username)
    .pipe(
        map(privileges => {
            storeAuthentication(currentSession, getAuthentication(currentSession).setPrivileges(privileges));
            ctxLogger.info("Authentication after setting privileges %o", getAuthentication(currentSession));
        })
    );
};

const loginSuccessHandlerProvider: (attachUserPrivileges: AttachUserPrivileges, serverContextPath: string) => (
    req: express.Request,
    res: express.Response
) => void
= (attachUserPrivileges, serverContextPath) => (req, res) => {
    const ctxLogger = loggerFactory("loginSuccessHandlerProvider");

    attachUserPrivileges(req.session)
    .subscribe(() => {
            ctxLogger.info(`Redirecting to ${serverContextPath}`);
            res.redirect(serverContextPath);
        },
        err => {
            ctxLogger.error("Error while setting privileges: %o", err);
            res.status(500).send("Error during login").end();
        }
    );
};

const userInfoHandler = (req: express.Request, res: express.Response) => {
    loggerFactory("user-info-handler").debug("returning: %o", getAuthentication(req.session));
    const auth: Authentication = getAuthentication(req.session);
    res.send({
        username: auth.username,
        privileges: auth.privileges
    });
};

type LogoutSuccessHandler = (req: express.Request, res: express.Response) => void;

const createLogoutHandler = (logoutSuccessHandler?: LogoutSuccessHandler) => {
    const ctxLogger = loggerFactory("securityManager#createLogoutHandler");
    return (req: express.Request, res: express.Response) => {
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

export default (configuration: ConfigurationData) => {
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
                path: configuration.server_url_context,
                expires: void 0
            },
            resave: false,
            saveUninitialized: false
        }));
    };

    const setupRoutes: (router: express.Router) => void = router => {
        const ctxLogger = loggerFactory("security-manager#setup-routes");
        const authType = configuration.authentication_type;
        ctxLogger.debug(`Authentication type: ${authType}`);
        ctxLogger.debug(`users_by_roles: ${configuration.users_by_roles}`);
        const getAllPrivilegesForUser: GetAllPrivilegesForUser = allPrivilegesForUserGetterProvider(
            privilegeResourcesProvider(configuration.users_by_roles)
        );

        const attachUserPrivileges: AttachUserPrivileges = attachUserPrivilegesProvider(getAllPrivilegesForUser);

        let loginHandler: express.Handler;
        const loginSuccessHandler: express.Handler = loginSuccessHandlerProvider(
            attachUserPrivileges, configuration.server_url_context
        );
        let logoutSuccessHandler: LogoutSuccessHandler;
        let basicAuthentHandler: express.Handler;

        if (authType === "oidc") {
            loginHandler = oidcLoginHandlerProvider(configuration);
            logoutSuccessHandler = oidcLogoutSuccessHandlerProvider(
                configuration.oidc_ip_logout_url,
                configuration.server_url_context
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
                configuration.server_url_context,
                basicAuthentHandler
            )
        );
        router.use(privilegeCheckInterceptor);
        router.post("/logout", createLogoutHandler(logoutSuccessHandler));
        router.get("/user", userInfoHandler);

        if (configuration.enable_backdoors) {
            router.use("/backdoor", backdoors);
        }
    };

    return {
        setupSessionManagement,
        setupRoutes
    };
};
