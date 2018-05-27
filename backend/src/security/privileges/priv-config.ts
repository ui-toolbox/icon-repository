import { Set } from "immutable";
import * as Rx from "rxjs";

export const privilegeDictionary = Object.freeze({
    CREATE_ICON: "CREATE_ICON",
    ADD_ICON_FORMAT: "ADD_ICON_FORMAT",
    REMOVE_ICON_FORMAT: "REMOVE_ICON_FORMAT",
    REMOVE_ICON: "REMOVE_ICON"
});

const privilegesByRoles: {[key: string]: string[]} = {
    ICON_EDITOR: [
        privilegeDictionary.CREATE_ICON,
        privilegeDictionary.ADD_ICON_FORMAT,
        privilegeDictionary.REMOVE_ICON_FORMAT,
        privilegeDictionary.REMOVE_ICON
    ]
};

const csvSplitter = (list: string) => list.split(/[\s]*,[\s]*/).map(format => format.trim());

export type PrivilegesForUserGetter = (userName: string) => Rx.Observable<Set<string>>;
export type RolesForUserGetter = (userName: string) => Rx.Observable<Set<string>>;
export type PrivilegesForRoleGetter = (role: string) => Rx.Observable<Set<string>>;
export interface IPrivilegeResources {
    privilegesForUserGetter: PrivilegesForUserGetter;
    rolesForUserGetter: RolesForUserGetter;
    privilegesForRoleGetter: PrivilegesForRoleGetter;
}
export type AllPrivilegesForUserGetter = (userName: string) => Rx.Observable<Set<string>>;
type AllPrivilegesForUserGetterProvider = (resources: IPrivilegeResources) => AllPrivilegesForUserGetter;

export const privilegesForUserGetterProvider: () => PrivilegesForUserGetter
= () => userName => Rx.Observable.of(Set());

export const rolesForUserGetterProvider: (usersByRoles: {[key: string]: string[]}) => RolesForUserGetter
= usersByRoles => userName => Rx.Observable.of(Set(
    Object.keys(usersByRoles)
        .filter(role => usersByRoles[role].indexOf(userName) > -1)
));

export const privilegesForRoleGetterProvider: () => PrivilegesForRoleGetter
= () => role => Rx.Observable.of(Set(privilegesByRoles[role]));

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
