import { manageTestResourcesBeforeAndAfter, type Session } from "./api-test-utils";
import { setAuth, deleteIcon, describeAllIcons } from "./api-client";
import { Permission } from "../../src/security/authorization/permissions/groups-permissions";
import { addTestData, testIconInputData, getPreIngestedTestIconDataDescription } from "./icon-api-test-utils";
import { type IconfileDescriptor } from "../../src/icon";
import { assertFileNotInRepo } from "../git/git-test-utils";
import clone from "../../src/utils/clone";

describe("DEL /icon", () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("should fail with 403 without proper privilege", async () => {
		const session = createSession();

		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), []);
		await deleteIcon(
			session.request({ responseValidator: resp => resp.status === 403 }),
			testIconInputData[0].name);
	});

	it("should fail with 403 with only REMOVE_ICONFILE privilege", async () => {
		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), [Permission.REMOVE_ICONFILE]);
		await deleteIcon(
			session.request({ responseValidator: resp => resp.status === 403 }),
			testIconInputData[0].name);
	});

	it("should succeed with REMOVE_ICON privilege", async () => {
		const iconToDelete = testIconInputData[0];
		const expectedAllIconsDescriptor = clone(getPreIngestedTestIconDataDescription());
		expectedAllIconsDescriptor.splice(0, 1);

		const getIconfileDescToDelete = (iconfileIndex: number): IconfileDescriptor => ({
			format: iconToDelete.files[iconfileIndex].format,
			size: iconToDelete.files[iconfileIndex].size
		});

		const session: Session = createSession();
		await session.loginWithAllPrivileges();

		await addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), [Permission.REMOVE_ICON]);
		await deleteIcon(
			session.request({ responseValidator: resp => resp.status === 204 }),
			iconToDelete.name
		);
		const iconsDesc = await describeAllIcons(session.request());
		expect(iconsDesc).toEqual(expectedAllIconsDescriptor);
		await assertFileNotInRepo(iconToDelete.name, getIconfileDescToDelete(0));
		await assertFileNotInRepo(iconToDelete.name, getIconfileDescToDelete(1));
		await assertFileNotInRepo(iconToDelete.name, getIconfileDescToDelete(2));
	});
});
