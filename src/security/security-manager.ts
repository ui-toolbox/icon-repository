import type * as express from "express";

import session from "express-session";

import { type ConfigurationData } from "./../configuration.js";

import { hasRequiredPrivileges } from "./authorization/permissions/permission-enforcement.js";
import { createLogger } from "./../utils/logger.js";

import backdoors, { builtInCredentialMatcher, builtInGetUserPrivileges } from "./backdoors.js";
import _ from "lodash";
import { type AuthenticatedUser, getAuthentication } from "./authenticated-user.js";
import { type OidcHandler, createOidcHandler } from "./authentication/oidc.js";
import { setupAuthnRoutes } from "./authentication/oidc-express.js";
import { basicAuthenticationHandler } from "./authentication/basic-authn-handler.js";

declare module "express-session" {
	export interface Session {
		codeVerifier: string;
		authentication?: AuthenticatedUser;
		lastDenied?: string;
	}
}

const userInfoHandler = (req: express.Request, res: express.Response): void => {
	createLogger("user-info-handler").debug("returning: %o", getAuthentication(req.session));
	const auth: AuthenticatedUser | undefined = getAuthentication(req.session);
	if (_.isNil(auth)) {
		res.sendStatus(401);
		return;
	}
	res.send({
		username: auth.username,
		permissions: auth.permissions
	});
};

export const setupSecurity = (configuration: ConfigurationData): {
	setupSessionManagement: (app: express.Express) => void;
	setupRoutes: (router: express.Router) => Promise<void>;
} => {
	const setupSessionManagement = (app: express.Express): void => {
		app.use(session({
			secret: "my-secret", // TODO: a secret string used to sign the session ID cookie
			resave: false, // don't save session if unmodified
			saveUninitialized: false // don't create session until something stored,
		}));
	};

	const setupRoutes = async (router: express.Router): Promise<void> => {
		const logger = createLogger("security-manager#setup-routes");
		const authType = configuration.authentication_type;
		logger.info("Authentication type: %s", authType);

		if (authType === "oidc") {
			if (
				_.isNil(configuration.oidc_client_id) ||
				_.isNil(configuration.oidc_client_secret) ||
				_.isNil(configuration.oidc_token_issuer) ||
				_.isNil(configuration.oidc_client_redirect_back_url) ||
				_.isNil(configuration.oidc_ip_logout_url)) {
				throw new Error("Incomplete OIDC configuration");
			}
			const oidcHandler: OidcHandler = await createOidcHandler({
				clientId: configuration.oidc_client_id,
				clientSecret: configuration.oidc_client_secret,
				metaDataUrl: configuration.oidc_token_issuer,
				callbackUrl: configuration.oidc_client_redirect_back_url
			});
			await setupAuthnRoutes(router, oidcHandler, "/login", configuration.oidc_ip_logout_url);
		} else if (authType === "basic") {
			logger.debug("users_by_roles: %o", configuration.users_by_roles);
			const handler = basicAuthenticationHandler(
				builtInCredentialMatcher,
				builtInGetUserPrivileges(configuration)
			);
			router.get("/login", handler, (_, res): void => { res.redirect("/"); });
		} else {
			throw new Error(`Unexpected authentication type: ${authType}`);
		}

		router.use((req, res, next) => {
			const logger = createLogger(`securityManger://authentication-check (${req.url})`);
			const foo = async (): Promise<void> => {
				const authentication = req.session.authentication;
				logger.debug("checking authentication: %o, %o", req.url, authentication);
				if (_.isNil(authentication)) {
					res.redirect("/login");
					return;
				}
				hasRequiredPrivileges(req)
					.then(
						has => {
							if (has) {
								next();
								return;
							}
							logger.debug("not enough permissions");
							res.sendStatus(403);
						}
					).catch(error => {
						logger.error("error while evaluating authentication information: %o", error);
						res.sendStatus(401);
					});
			};
			foo()
				.then(
					() => undefined,
					error => {
						logger.error("error while evaluating authentication information: %o", error);
						res.sendStatus(401);
					}
				);
		});

		router.get("/user", userInfoHandler);

		if (!_.isNil(configuration.enable_backdoors) && configuration.enable_backdoors) {
			router.use("/backdoor", backdoors);
		}

		logger.debug("routes are setup");
	};

	return {
		setupSessionManagement,
		setupRoutes
	};
};
