import { Set } from "immutable";
import { of } from "rxjs";

import {
    PrivilegesForUserGetter,
    RolesForUserGetter,
    PrivilegesForRoleGetter,
    rolesForUserGetterProvider,
    allPrivilegesForUserGetterProvider } from "./priv-config";
import { GetAllPrivilegesForUser } from "../../common";

describe("rolesForUserGetterProvider", () => {
    it("should return a function yielding the privileges granted to the given user", done => {
        const testUser = "zazie";
        const usersByRole = {
            reader: [
                testUser,
                "bibie"
            ],
            writer: [
                "bobo",
                "bibie"
            ],
            eraser: [
                "bobo",
                testUser
            ]
        };

        const expectedRoles = [
            "reader",
            "eraser"
        ];

        rolesForUserGetterProvider(usersByRole)(testUser)
        .subscribe(
            roles => {
                expect(roles.toArray()).toEqual(expectedRoles);
                done();
            },
            error => {
                fail(error);
                done();
            }
        );
    });
});

describe("allPrivilegesForUserGetterProvider", () => {
    it("should return a function which yields all privileges for any given user", done => {
        const directPrivsOfUser = [
            "direct1",
            "direct2"
        ];
        const rolesOfUser = [
            "zazie", "metro"
        ];
        const privsByRoles: {[key: string]: string[]} = {
            zazie: [
                "zaziepriv1",
                "zaziepriv2"
            ],
            metro: [
                "metropriv1",
                "metropriv2",
                "metropriv3"
            ]
        };
        const expectedPrivs: string[] = [
            "direct1",
            "direct2",
            "zaziepriv1",
            "zaziepriv2",
            "metropriv1",
            "metropriv2",
            "metropriv3"
        ];
        const privilegesForUserGetter: PrivilegesForUserGetter = userName => of(Set(directPrivsOfUser));
        const rolesForUserGetter: RolesForUserGetter = userName => of(Set(rolesOfUser));
        const privilegesForRoleGetter: PrivilegesForRoleGetter = role => of(Set(privsByRoles[role]));
        const getAllPrivilegesForUser: GetAllPrivilegesForUser = allPrivilegesForUserGetterProvider({
            privilegesForUserGetter,
            rolesForUserGetter,
            privilegesForRoleGetter

        });
        getAllPrivilegesForUser("any user")
        .subscribe(
            privs => {
                expect(privs.toArray()).toEqual(expectedPrivs);
                done();
            },
            error => {
                fail(error);
                done();
            }
        );
    });

    it("should return a function which yields all privileges, even if only directly assigned to user", done => {
        const directPrivsOfUser = [
            "direct1",
            "direct2"
        ];
        const rolesOfUser: string[] = [];
        const privsByRoles: {[key: string]: string[]} = {};
        const expectedPrivs: string[] = [
            "direct1",
            "direct2"
        ];
        const privilegesForUserGetter: PrivilegesForUserGetter = userName => of(Set(directPrivsOfUser));
        const rolesForUserGetter: RolesForUserGetter = userName => of(Set(rolesOfUser));
        const privilegesForRoleGetter: PrivilegesForRoleGetter = role => of(Set(privsByRoles[role]));
        const allPrivilegesForUserGetter: GetAllPrivilegesForUser = allPrivilegesForUserGetterProvider({
            privilegesForUserGetter,
            rolesForUserGetter,
            privilegesForRoleGetter
        });

        allPrivilegesForUserGetter("any user")
        .subscribe(
            privs => {
                expect(privs.toArray()).toEqual(expectedPrivs);
                done();
            },
            error => {
                fail(error);
                done();
            }
        );
    });
});
