import { Set } from "immutable";
import {
    createPrivEndPointToREMap,
    requiredPrivilegesGetterProvider
 } from "./priv-enforcement";

describe("requiredPrivilegesGetter", () => {
    it("should return the privileges configured for the given url and method", () => {
        const expectedPrivs1 = [ "asdf" ];
        const expectedPrivs2 = [
            "zazie format",
            "bobo format"
        ];
        const someEndPointPrivDesc = Object.freeze({
            "^/icon$": {
                GET: expectedPrivs1
            },
            "^/icon/[^/]+/format/[^/]+$": {
                POST: expectedPrivs2
            }
        });
        const someEndPointREMap = createPrivEndPointToREMap(someEndPointPrivDesc);

        const requiredPrivilegesGetter = requiredPrivilegesGetterProvider(someEndPointPrivDesc, someEndPointREMap);

        expect(requiredPrivilegesGetter("/icon", "GET")).toEqual(Set(expectedPrivs1));
        expect(requiredPrivilegesGetter("/icon/asdfqwerqasdf/format/3x", "POST")).toEqual(Set(expectedPrivs2));
    });
});
