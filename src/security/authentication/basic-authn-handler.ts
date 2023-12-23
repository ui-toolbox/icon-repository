import { type Request, type Response, type NextFunction } from "express";
import { createLogger } from "../../utils/logger";
import { AuthenticatedUser } from "../authenticated-user";
import { type Permission } from "../authorization/permissions/groups-permissions";

const logger = createLogger("basicAuthentHandlerProvider");

const getAuthorizationHeader: (req: Request) => string = req => req.headers.authorization ?? "";

export interface Credentials {
	readonly username: string
	readonly password: string
}

const getCredentials = (req: Request): Credentials => {
	const b64auth = getAuthorizationHeader(req).split(" ")[1] ?? "";
	logger.debug("authorization header: %s", b64auth);
	const strauth = Buffer.from(b64auth, "base64").toString();
	const splitIndex = strauth.indexOf(":");
	const login = strauth.substring(0, splitIndex);
	const password = strauth.substring(splitIndex + 1);
	return {
		username: login,
		password
	};
};

export type FindMatchingCredentials = (credentials: Credentials) => Promise<boolean>;
export type GetUserPrivileges = (username: string) => Promise<Permission[]>;

export const basicAuthenticationHandler = (hasMatchingCredentials: FindMatchingCredentials, getUserPrivileges: GetUserPrivileges) =>
	(req: Request, res: Response, next: NextFunction) => {
		const logger = createLogger(`basic-authentication-handler (${req.url})`);
		const asyncFunc = async (): Promise<void> => {
			const currentCreds: Credentials = getCredentials(req);
			const matchFound = await hasMatchingCredentials(currentCreds);
			logger.debug("matchFound: %o", matchFound);
			if (matchFound) {
				const permissions = await getUserPrivileges(currentCreds.username);
				req.session.authentication = new AuthenticatedUser(currentCreds.username, permissions);
				next();
			} else {
				res.set("WWW-Authenticate", "Basic").status(401).end();
			}
		};
		asyncFunc()
			.then(
				() => undefined
			).catch(error => {
				const errmsg = `Error during authentication: ${error}`;
				logger.error("Error during authentication: %o", error);
				res.status(500).send(errmsg).end();
			});
	};
