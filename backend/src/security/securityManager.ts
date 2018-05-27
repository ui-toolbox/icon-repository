import { Set } from "immutable";
import * as util from "util";
import * as express from "express";

import * as cookieParser from "cookie-parser";
import * as session from "express-session";
// @ts-ignore
import sessionMemoryStoreFactory = require("session-memory-store");

import { ConfigurationDataProvider } from "./../configuration";

import oidcLoginHandlerProvider from "./oidc/oidcLoginRouteHandler";
import oidcLogoutSuccessHandlerProvider from "./oidc/oidcLogoutSuccessHandler";
import {
    privilegeResourcesProvider,
    allPrivilegesForUserGetterProvider
} from "./privileges/priv-config";
import { hasRequiredPrivileges } from "./privileges/priv-enforcement";
import logger from "./../logger";
import { LogoutSuccessHandler, randomstring } from "./../util";

import backdoors from "./backdoors";

const ONE_DAY_AS_SECS = 60 * 60 * 24;

const createAuthenticationInterceptor = (serverContext: string) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    const ctxLogger = logger.createChild("authenticationInterceptor");
    if (ctxLogger.isLevelEnabled("silly")) {
        (Object.keys(req.headers)).forEach(key => {
            logger.silly(key + ": " + req.headers[key]);
        });
    }
    ctxLogger.info("request URL: %s, method: %s", req.url, req.method);
    if (!req.url.endsWith("login") && !req.session.authentication) {
        const loginPage = serverContext + "/login";
        ctxLogger.verbose(req.url + ": Unauthenticated user is about to be redirected to login page: " + loginPage);
        res.redirect(loginPage);
    } else {
        ctxLogger.silly(req.url + ": letting pass:", req.session.authentication);
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
        ctxLogger.silly(req.url + ": letting pass:", req.session.authentication);
        next();
    } else {
        ctxLogger.debug("Missing privilege(s): possessed %o", req.session.authentication
                            ? req.session.authentication.privileges
                            : []);
        res.status(403).end();
    }
};

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
                        res.end(200);
                    }
                }
            });
        } else {
            res.status(200).end();
        }
    };
};

const loginSuccessHandlerProvider: (appConfig: ConfigurationDataProvider) => (
    req: express.Request,
    res: express.Response
) => void
= appConfig => (req, res) => {
    const ctxLogger = logger.createChild("loginSuccessHandlerProvider");
    if (!req.session || !req.session.authentication || !req.session.authentication.username) {
        ctxLogger.error(
            "Illegal state: no session, authentication information or username associated with the request",
            req.session
        );
        res.end(401);
        return;
    }

    allPrivilegesForUserGetterProvider(privilegeResourcesProvider(appConfig().users_by_roles))(
        req.session.authentication.username
    )
    .subscribe(
        privileges => {
            Object.assign(req.session.authentication, { privileges: privileges.toArray() });
            ctxLogger.info("Authentication after setting privileges %o", req.session.authentication);
            const serverContextPath: string = appConfig().server_url_context;
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
    logger.createChild("userInfoHandler").debug(req.session.authentication.username);
    res.send({username: req.session.authentication.username});
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
        if ( appConfigProvider().authentication_type === "oidc") {
            router.get(
                "/login",
                oidcLoginHandlerProvider(appConfigProvider),
                loginSuccessHandlerProvider(appConfigProvider)
            );
            router.use(createAuthenticationInterceptor(appConfigProvider().server_url_context));
            router.post("/logout", createLogoutHandler(oidcLogoutSuccessHandlerProvider(
                appConfigProvider().oidc_ip_logout_url, appConfigProvider().server_url_context
            )));
            router.get("/user", userInfoHandler);
        } else {
            router.get("/user", (req, res) => res.send({}));
        }

        router.use(privilegeCheckInterceptor);

        if (appConfigProvider().enable_backdoors) {
            router.use("/backdoor", backdoors);
        }
    };

    return {
        setupSessionManagement,
        setupRoutes
    };
};
