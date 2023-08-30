import type express from "express";
import { createLogger } from "../../utils/logger";
import _ from "lodash";
import { type OidcHandler } from "./oidc.js";
import { createAuthenticatedUser, storeAuthentication } from "../authenticated-user.js";
import { type Session } from "express-session";
import type winston from "winston";

const getLogger = (loggerName: string): winston.Logger => createLogger(loggerName);

export const setupCallbackRoute = async (router: express.Router, loginUrl: string, oidcHandler: OidcHandler): Promise<void> => {
	router.get("/oidc-callback", (req, res): void => {
		const logger = getLogger("route:///oidc-callback");
		const codeVerifier = req.session?.codeVerifier;
		if (_.isNil(codeVerifier)) {
			logger.error("Missing code-verifier");
			res.redirect(loginUrl);
			return;
		}
		oidcHandler.getTokenSet(req, codeVerifier)
			.then(
				async tokenSet => {
					if (_.isNil(tokenSet.access_token)) {
						throw new Error("no access_token in token-set");
					}
					const userInfo = await oidcHandler.getUserInfo(tokenSet.access_token);
					return await createAuthenticatedUser(userInfo.preferred_username as string, userInfo.groups as string[]);
				}
			)
			.then(
				authnUser => {
					storeAuthentication(req.session as Session, authnUser);
					res.redirect("/");
				}
			)
			.catch(err => {
				logger.debug("Error while processing callback: %o", err);
				res.sendStatus(401);
			});
	});
};

const setupLoginRoute = async (router: express.Router, oidcHandler: OidcHandler): Promise<void> => {
	router.get("/login", (req, res) => {
		const logger = getLogger("route:///login");
		try {
			const auhtRUrl = oidcHandler.getAuthorizationUrl(req);
			res.redirect(auhtRUrl);
		} catch (error) {
			logger.error("failed to process login: %o", error);
			res.sendStatus(401);
		}
	});
};

export const setupAuthnRoutes = async (
	router: express.Router,
	oidcHandler: OidcHandler,
	loginUrl: string,
	logoutUrl: string
): Promise<void> => {
	await setupLoginRoute(router, oidcHandler);
	await setupCallbackRoute(router, loginUrl, oidcHandler);

	router.post("/logout", (req, res) => {
		const logger = getLogger("route:///logout");
		try {
			delete req.session.authentication;
			if (!_.isNil(logoutUrl)) {
				res.setHeader("HX-Redirect", logoutUrl).end();
			}
		} catch (error) {
			logger.error("failed to logout: %o", error);
			res.sendStatus(400);
		}
	});
};
