import _ from "lodash";
import { type Permission, permissionsByGroup } from "./authorization/permissions/groups-permissions.js";

export interface SessionData {
	codeVerifier: string
	authentication?: AuthenticatedUser
	lastDenied?: string
};

export const aggregatePrivileges = async (roles: string[]): Promise<Permission[]> => {
	return roles.reduce<Permission[]>(
		(acc, role) => {
			if (!_.isNil(permissionsByGroup[role])) {
				acc.push(...permissionsByGroup[role]);
			}
			return acc;
		},
		[]
	);
};

export const createAuthenticatedUser = async (username: string, roles: string[]): Promise<AuthenticatedUser> => {
	const permissions: Permission[] = await aggregatePrivileges(roles);
	return new AuthenticatedUser(username, permissions);
};

export class AuthenticatedUser {
	public readonly username: string;
	public readonly permissions: Permission[];

	constructor(userName: string, permissions: Permission[]) {
		if (_.isEmpty(userName)) {
			throw new Error(`Invalid username/login: ${userName}`);
		}
		this.username = userName;
		this.permissions = permissions ?? [];
	}
}

export const storeAuthentication = (session: SessionData, authentication: AuthenticatedUser): void => {
	session.authentication = authentication;
};

export const getAuthentication: (session: SessionData) => AuthenticatedUser | undefined = session => session.authentication;
