import {
	getRequiredPrivilegesProvider,
	createPrivEndPointToRegExpMap,
	type RequiredPrivilegesByEndPoints
} from "./permission-enforcement";
import { Permission } from "./groups-permissions";

describe("getRequiredPrivilegesProvider", () => {
	it("should return the permissions configured for the given url and method", async () => {
		const expectedPrivs1: Permission[] = [Permission.ADD_ICONFILE];
		const expectedPrivs2: Permission[] = [
			Permission.UPDATE_ICON,
			Permission.REMOVE_ICON
		];
		const someEndPointPrivDesc: RequiredPrivilegesByEndPoints = Object.freeze({
			"^/icon$": {
				GET: expectedPrivs1
			},
			"^/icon/[^/]+/format/[^/]+$": {
				POST: expectedPrivs2
			}
		});
		const somePrivEndPointToRegExpMap = createPrivEndPointToRegExpMap(someEndPointPrivDesc);

		const requiredPrivilegesGetter = getRequiredPrivilegesProvider(someEndPointPrivDesc, somePrivEndPointToRegExpMap);

		expect(await requiredPrivilegesGetter("/icon", "GET")).toEqual(expectedPrivs1);
		expect(await requiredPrivilegesGetter("/icon/asdfqwerqasdf/format/3x", "POST")).toEqual(expectedPrivs2);
	});
});
