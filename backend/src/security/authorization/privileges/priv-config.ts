import { Set, Map } from "immutable";
import * as Rx from "rxjs";
import { GetAllPrivilegesForUser } from "../../common";
import logger from "../../../utils/logger";

export const privilegeDictionary = Object.freeze({
    CREATE_ICON: "CREATE_ICON",
    UPDATE_ICON: "UPDATE_ICON",
    ADD_ICON_FILE: "ADD_ICON_FILE",
    UPDATE_ICON_FILE: "UPDATE_ICON_FILE",
    REMOVE_ICON_FILE: "REMOVE_ICON_FILE",
    REMOVE_ICON: "REMOVE_ICON"
});

const privilegesByRoles: Map<string, Set<string>> = Map({
    ICON_EDITOR: Set([
        privilegeDictionary.CREATE_ICON,
        privilegeDictionary.UPDATE_ICON,
        privilegeDictionary.ADD_ICON_FILE,
        privilegeDictionary.UPDATE_ICON_FILE,
        privilegeDictionary.REMOVE_ICON_FILE,
        privilegeDictionary.REMOVE_ICON
    ])
});

export type PrivilegesForUserGetter = (userName: string) => Rx.Observable<Set<string>>;
export type RolesForUserGetter = (userName: string) => Rx.Observable<Set<string>>;
export type PrivilegesForRoleGetter = (role: string) => Rx.Observable<Set<string>>;
export interface IPrivilegeResources {
    readonly privilegesForUserGetter: PrivilegesForUserGetter;
    readonly rolesForUserGetter: RolesForUserGetter;
    readonly privilegesForRoleGetter: PrivilegesForRoleGetter;
}
type AllPrivilegesForUserGetterProvider = (resources: IPrivilegeResources) => GetAllPrivilegesForUser;

export const privilegesForUserGetterProvider: () => PrivilegesForUserGetter
= () => userName => Rx.Observable.of(Set());

export const rolesForUserGetterProvider: (usersByRoles: {[key: string]: string[]}) => RolesForUserGetter
= usersByRoles => userName => Rx.Observable.of(Set(
    Object.keys(usersByRoles)
        .filter(role => {
            const ctxLogger = logger.createChild("rolesForUserGetter");
            ctxLogger.debug("role: %s, userByRole: %o, userName: %s, hasRole: %o",
                            role, usersByRoles[role], userName, usersByRoles[role].indexOf(userName));
            return usersByRoles[role].indexOf(userName) > -1;
        }
)));

export const privilegesForRoleGetterProvider: () => PrivilegesForRoleGetter
= () => role => Rx.Observable.of(privilegesByRoles.get(role));

export type PrivilegeResourcesProvider = (usersByRoles: {[key: string]: string[]}) => IPrivilegeResources;

export const privilegeResourcesProvider: PrivilegeResourcesProvider = usersByRoles => ({
    privilegesForUserGetter: privilegesForUserGetterProvider(),
    rolesForUserGetter: rolesForUserGetterProvider(usersByRoles),
    privilegesForRoleGetter: privilegesForRoleGetterProvider()
});

const getPrivilegesForRoles: (
    roles: Set<string>,
    privilegesForRoleGetter: PrivilegesForRoleGetter
) => Rx.Observable<Array<Set<string>>>
= (roles, privilegesForRoleGetter) => roles.size
    ? Rx.Observable.forkJoin(
        roles.map(role => privilegesForRoleGetter(role)).toArray()
    )
    : Rx.Observable.of([]);

export const allPrivilegesForUserGetterProvider: AllPrivilegesForUserGetterProvider = resources => userName =>
    Rx.Observable.forkJoin(
        resources.privilegesForUserGetter(userName),
        resources.rolesForUserGetter(userName)
            .flatMap(roles => getPrivilegesForRoles(roles, resources.privilegesForRoleGetter))
    )
    .map(privsForUserAndRoles => privsForUserAndRoles[0].concat(Set(privsForUserAndRoles[1]).flatten()).toSet());
