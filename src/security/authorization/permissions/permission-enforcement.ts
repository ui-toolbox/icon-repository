import type * as express from "express";
import { Permission } from "./groups-permissions.js";
import _ from "lodash";
import { getAuthentication } from "../../authenticated-user.js";
import { createLogger } from "../../../utils/logger.js";

const logger = createLogger("priv-enforcement");

type PathSelector = string;
type RoleName = string;
type RequiredPrivileges = Readonly<Record<RoleName, Permission[]>>;

export type RequiredPrivilegesByEndPoints = Readonly<Record<PathSelector, RequiredPrivileges>>;
type EndPoint2RegExpMap = Readonly<Record<string, RegExp>>;

type RequiredPrivilegesGetter = (url: string, requestMethod: string) => Promise<Permission[]>;

const requiredPrivilegesByEndPoints: RequiredPrivilegesByEndPoints = Object.freeze({
	// "/icon/:name
	"^/icon$": {
		POST: [
			Permission.CREATE_ICON
		]
	},
	// "/icon/:name
	"^/icon/[^/]+$": {
		POST: [
			Permission.UPDATE_ICON,
			Permission.ADD_ICONFILE
		],
		PATCH: [
			Permission.UPDATE_ICON
		],
		PUT: [
			Permission.UPDATE_ICON
		],
		DELETE: [
			Permission.REMOVE_ICON
		]
	},
	// "/icon/:name/format/:format/size/:size"
	"^/icon/[^/]+/format/[^/]+/size/[^/]+$": {
		DELETE: [
			Permission.REMOVE_ICON,
			Permission.REMOVE_ICONFILE
		]
	},
	// "/icon/:name/tag"
	"^/icon/[^/]+/tag$": {
		POST: [
			Permission.ADD_TAG
		]
	},
	// "/icon/:name/tag/:tag"
	"^/icon/[^/]+/tag/[^/]+$": {
		DELETE: [
			Permission.REMOVE_TAG
		]
	}
});

export const createPrivEndPointToRegExpMap = (endPointPrivDesc: RequiredPrivilegesByEndPoints): EndPoint2RegExpMap => Object.keys(endPointPrivDesc).reduce(
	(acc, key) => Object.assign(acc, { [key]: new RegExp(key) }),
	{}
);

const endPoint2RegExpMap: EndPoint2RegExpMap = createPrivEndPointToRegExpMap(requiredPrivilegesByEndPoints);

export const getRequiredPrivilegesProvider = (epPrivDesc: RequiredPrivilegesByEndPoints, ep2REMap: EndPoint2RegExpMap): RequiredPrivilegesGetter =>
	async (url, requestMethod) =>
		Object.keys(epPrivDesc)
			.filter(route => ep2REMap[route].test(url))
			.flatMap(
				route => Object.keys(epPrivDesc[route])
					.filter(privMethod => requestMethod === privMethod)
					.flatMap(privMethod => epPrivDesc[route][privMethod])
			);

const getRequiredPrivileges = getRequiredPrivilegesProvider(requiredPrivilegesByEndPoints, endPoint2RegExpMap);

export const hasRequiredPrivileges = async (req: express.Request): Promise<boolean> => {
	const requiredPrivileges: string[] = await getRequiredPrivileges(req.url, req.method);
	if (requiredPrivileges.length === 0) {
		return true;
	}
	const authentication = getAuthentication(req.session);
	// logger.debug("#hasRequiredPrivileges: authentication: %o, requiredPrivileges: %o, authentication.permissions: %o", authentication, requiredPrivileges, authentication?.permissions);
	logger.debug(
		"#hasRequiredPrivileges: requiredPrivileges: %o, _.intersection(requiredPrivileges, authentication.permissions): %o",
		requiredPrivileges, _.intersection(requiredPrivileges, authentication?.permissions)
	);
	return !_.isNil(authentication) &&
    _.intersection(requiredPrivileges, authentication.permissions).length >= requiredPrivileges.length;
};
