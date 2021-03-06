import * as express from "express";
import { Set } from "immutable";

import { privilegeDictionary } from "./priv-config";
import { getAuthentication } from "../../common";

interface IEndPointPrivilegeDescriptor {
    readonly [endPointREString: string]: {
        readonly [requestMethod: string]: string[]
    };
}

interface IEndPoint2REMap {
    readonly [endPointREStringKey: string]: RegExp;
}

type RequiredPrivilegesGetter = (url: string, requestMethod: string) => Set<string>;

const privilegesForEndPoints: IEndPointPrivilegeDescriptor = Object.freeze({
    "^/icon$": {
        POST: [
            privilegeDictionary.CREATE_ICON
        ]
    },
    // "/icon/:name
    "^/icon/[^/]+$": {
        POST: [
            privilegeDictionary.UPDATE_ICON,
            privilegeDictionary.ADD_ICONFILE
        ],
        PATCH: [
            privilegeDictionary.UPDATE_ICON
        ],
        PUT: [
            privilegeDictionary.UPDATE_ICON
        ],
        DELETE: [
            privilegeDictionary.REMOVE_ICON
        ]
    },
    // "/icon/:name/format/:format/size/:size"
    "^/icon/[^/]+/format/[^/]+/size/[^/]+$": {
        DELETE: [
            privilegeDictionary.REMOVE_ICON,
            privilegeDictionary.REMOVE_ICONFILE
        ]
    },
    // "/icon/:name/tag"
    "^/icon/[^/]+/tag$": {
        POST: [
            privilegeDictionary.ADD_TAG
        ]
    },
    // "/icon/:name/tag/:tag"
    "^/icon/[^/]+/tag/[^/]+$": {
        DELETE: [
            privilegeDictionary.REMOVE_TAG
        ]
    }
});

export const createPrivEndPointToREMap: (endPointPrivDesc: IEndPointPrivilegeDescriptor) => IEndPoint2REMap
= endPointPrivDesc => Object.keys(endPointPrivDesc).reduce(
    (acc, key) => Object.assign(acc, { [key]: new RegExp(key) }),
    {}
);

const privEndPoint2RE: {[key: string]: RegExp} = createPrivEndPointToREMap(privilegesForEndPoints);

export const requiredPrivilegesGetterProvider: (
    epPrivDesc: IEndPointPrivilegeDescriptor,
    ep2REMap: IEndPoint2REMap
) => RequiredPrivilegesGetter
= (epPrivDesc, ep2REMap) => (url, requestMethod) =>
    Set(Object.keys(epPrivDesc))
        .filter(route => ep2REMap[route].test(url))
        .flatMap(
            route => Set(Object.keys(epPrivDesc[route]))
                        .filter(privMethod => requestMethod === privMethod)
                        .flatMap(privMethod => Set(epPrivDesc[route][privMethod]))
        ).toSet();

const createDefaultRequiredPrivilegesGetter
    = () => requiredPrivilegesGetterProvider(privilegesForEndPoints, privEndPoint2RE);

const getRequiredPrivileges = createDefaultRequiredPrivilegesGetter();

const hasPrivilege: (endPointPrivileges: Set<string>, userPrivileges: Set<string>) => boolean
= (endPointPrivileges, userPrivileges) => endPointPrivileges.size === 0 ||
                                          endPointPrivileges.intersect(userPrivileges).size > 0;

export const hasRequiredPrivileges = (req: express.Request) => {
    const requiredPrivileges: Set<string> = getRequiredPrivileges(req.url, req.method);
    return requiredPrivileges.size === 0 ||
            getAuthentication(req.session) &&
                hasPrivilege(requiredPrivileges, getAuthentication(req.session).privileges);
};
