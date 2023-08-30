import * as express from "express";
import { AuthenticatedUser, aggregatePrivileges, getAuthentication } from "./authenticated-user";
import _ from "lodash";
import { type GetUserPrivileges, type Credentials, type FindMatchingCredentials } from "./authentication/basic-authn-handler";
import { type ConfigurationData } from "../configuration";
import { createLogger } from "../utils/logger";

const logger = createLogger("backdoors");

const router: express.Router = express.Router();

const getPrivileges: express.RequestHandler = (req, res) => {
	const authn = getAuthentication(req.session);
	const permissions: string[] = _.isNil(authn)
		? []
		: authn.permissions;
	res.send(permissions).status(200).end();
};

const setAuthentication: express.RequestHandler = (req, res) => {
	logger.debug("#setAuthentication: called with: %o", req.body);
	if (!_.isNil(req.body.permissions)) {
		req.session.authentication = new AuthenticatedUser(req.body.username, req.body.permissions);
	}
	res.status(200).end();
};

router.get("/authentication", getPrivileges);
router.put("/authentication", setAuthentication);

const builtInCredentials: Credentials[] = [
	{
		username: "ux",
		password: "ux"
	},
	{
		username: "dev",
		password: "dev"
	}
];

const builtInUserRoles: Record<string, string[]> = {
	ux: ["ICON_EDITOR"],
	dev: []
};

export const builtInCredentialMatcher: FindMatchingCredentials =
	async currentCredentials => !_.isNil(builtInCredentials.find(creds => _.isEqual(creds, currentCredentials)));
export const builtInGetUserPrivileges = (configuration: ConfigurationData): GetUserPrivileges => async (username: string) => {
	return await aggregatePrivileges(builtInUserRoles[username]);
};
export default router;
