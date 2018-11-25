import { Set, Map } from "immutable";
import { Observable, of, forkJoin, pipe } from "rxjs";
import { flatMap, map } from "rxjs/operators";
import { GetAllPrivilegesForUser } from "../../common";
import loggerFactory from "../../../utils/logger";

export const privilegeDictionary = Object.freeze({
    CREATE_ICON: "CREATE_ICON",
    UPDATE_ICON: "UPDATE_ICON",
    ADD_ICONFILE: "ADD_ICONFILE",
    REMOVE_ICONFILE: "REMOVE_ICONFILE",
    REMOVE_ICON: "REMOVE_ICON",
    ADD_TAG: "ADD_TAG",
    REMOVE_TAG: "REMOVE_TAG"
});

const privilegesByRoles: Map<string, Set<string>> = Map({
    ICON_EDITOR: Set([
        privilegeDictionary.CREATE_ICON,
        privilegeDictionary.UPDATE_ICON,
        privilegeDictionary.REMOVE_ICONFILE,
        privilegeDictionary.REMOVE_ICON,
        privilegeDictionary.ADD_TAG,
        privilegeDictionary.REMOVE_TAG
    ])
});

export type PrivilegesForUserGetter = (userName: string) => Observable<Set<string>>;
export type RolesForUserGetter = (userName: string) => Observable<Set<string>>;
export type PrivilegesForRoleGetter = (role: string) => Observable<Set<string>>;
export interface IPrivilegeResources {
    readonly privilegesForUserGetter: PrivilegesForUserGetter;
    readonly rolesForUserGetter: RolesForUserGetter;
    readonly privilegesForRoleGetter: PrivilegesForRoleGetter;
}
type AllPrivilegesForUserGetterProvider = (resources: IPrivilegeResources) => GetAllPrivilegesForUser;

export const privilegesForUserGetterProvider: () => PrivilegesForUserGetter
= () => userName => of(Set());

export const rolesForUserGetterProvider: (usersByRoles: {[key: string]: string[]}) => RolesForUserGetter
= usersByRoles => userName => of(Set(
    Object.keys(usersByRoles)
        .filter(role => {
            const ctxLogger = loggerFactory("rolesForUserGetter");
            ctxLogger.debug("role: %s, userByRole: %o, userName: %s, hasRole: %o",
                            role, usersByRoles[role], userName, usersByRoles[role].indexOf(userName));
            return usersByRoles[role].indexOf(userName) > -1;
        }
)));

export const privilegesForRoleGetterProvider: () => PrivilegesForRoleGetter
= () => role => of(privilegesByRoles.get(role));

export type PrivilegeResourcesProvider = (usersByRoles: {[key: string]: string[]}) => IPrivilegeResources;

export const privilegeResourcesProvider: PrivilegeResourcesProvider = usersByRoles => ({
    privilegesForUserGetter: privilegesForUserGetterProvider(),
    rolesForUserGetter: rolesForUserGetterProvider(usersByRoles),
    privilegesForRoleGetter: privilegesForRoleGetterProvider()
});

const getPrivilegesForRoles: (
    roles: Set<string>,
    privilegesForRoleGetter: PrivilegesForRoleGetter
) => Observable<Array<Set<string>>>
= (roles, privilegesForRoleGetter) => roles.size
    ? forkJoin(
        roles.map(role => privilegesForRoleGetter(role)).toArray()
    )
    : of([]);

export const allPrivilegesForUserGetterProvider: AllPrivilegesForUserGetterProvider = resources => userName =>
    forkJoin(
        resources.privilegesForUserGetter(userName),
        resources.rolesForUserGetter(userName)
        .pipe(
            flatMap(roles => getPrivilegesForRoles(roles, resources.privilegesForRoleGetter))
        )
    )
    .pipe(
        map(privsForUserAndRoles => privsForUserAndRoles[0].concat(Set(privsForUserAndRoles[1]).flatten()).toSet())
    );
