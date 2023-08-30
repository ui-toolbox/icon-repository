import { manageTestResourcesBeforeAndAfter, type Session } from "./api-test-utils";
import { setAuth, deleteIconfile, describeAllIcons } from "./api-client";
import { Permission } from "../../src/security/authorization/permissions/groups-permissions";
import {
	testIconInputData,
	addTestData,
	getPreIngestedTestIconDataDescription,
	ingestedTestIconData
} from "./icon-api-test-utils";
import { type IconfileDescriptor, type Iconfile } from "../../src/icon";
import { assertFileInRepo, assertFileNotInRepo } from "../git/git-test-utils";

describe("DEL /icon/:name/<file>", () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("should fail with 403 without proper privilege", async () => {
		const nameOfIconToDeleteFrom = "cartouche";
		const descOfIconfileToDelete: IconfileDescriptor = { format: "belge", size: "large" };

		const session: Session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), []);
		await deleteIconfile(
			session.request({ responseValidator: resp => resp.status === 403 }),
			nameOfIconToDeleteFrom,
			descOfIconfileToDelete
		);
	});

	it("should succeed with REMOVE_ICON and REMOVE_ICONFILE privilege", async () => {
		const nameOfIconToDeleteFrom = testIconInputData[0].name;
		const iconfileToDelete = testIconInputData[0].files[0];
		const descOfIconfileToDelete: IconfileDescriptor = {
			format: iconfileToDelete.format,
			size: iconfileToDelete.size
		};

		const session: Session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), [Permission.REMOVE_ICON, Permission.REMOVE_ICONFILE]);
		await deleteIconfile(
			session.request(),
			nameOfIconToDeleteFrom,
			descOfIconfileToDelete
		);
	});

	it("should fail with 404 for icon files associated with non-existent icon", async () => {
		const nameOfIconToDeleteFrom = "cartouche";
		const descOfIconfileToDelete: IconfileDescriptor = { format: "belge", size: "large" };

		const session: Session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await deleteIconfile(
			session.request({ responseValidator: resp => resp.status === 404 }),
			nameOfIconToDeleteFrom,
			descOfIconfileToDelete
		);
	});

	it("should fail with 404 for non-existent icon files", async () => {
		const nameOfIconToDeleteFrom = testIconInputData[0].name;
		const iconfileToDelete = testIconInputData[0].files[0];
		const descOfIconfileToDelete: IconfileDescriptor = {
			format: "cartouche",
			size: iconfileToDelete.size
		};

		const session: Session = createSession();
		await session.loginWithAllPrivileges();

		await addTestData(session.request(), testIconInputData);
		await deleteIconfile(
			session.request({ responseValidator: resp => resp.status === 404 }),
			nameOfIconToDeleteFrom,
			descOfIconfileToDelete
		);
	});

	it("should succeed with REMOVE_ICON and REMOVE_ICONFILE privilege", async () => {
		const iconToDeleteFrom = testIconInputData[0];
		const fileToDelete = iconToDeleteFrom.files[0];
		const descOfIconfileToDelete: IconfileDescriptor = { format: fileToDelete.format, size: fileToDelete.size };
		const expectedAllIconsDescriptor = getPreIngestedTestIconDataDescription();
		expectedAllIconsDescriptor[0].paths.splice(1, 1);

		// Used in asserting git result
		const expectedIconfile: Iconfile = { name: iconToDeleteFrom.name, ...fileToDelete };

		const session: Session = createSession();
		await session.loginWithAllPrivileges();

		await addTestData(session.request(), testIconInputData);
		await assertFileInRepo(expectedIconfile);
		await setAuth(session.request(), [Permission.REMOVE_ICON, Permission.REMOVE_ICONFILE]);
		await deleteIconfile(
			session.request(),
			iconToDeleteFrom.name,
			descOfIconfileToDelete
		);
		const iconsDesc = await describeAllIcons(session.request());
		expect(iconsDesc).toEqual(expectedAllIconsDescriptor);
		await assertFileNotInRepo(iconToDeleteFrom.name, descOfIconfileToDelete);
	});

	it("should remove icon, if it has no other icon file associated with it", async () => {
		const iconToDeleteFrom = ingestedTestIconData[0];
		const expectedAllIconsDescriptor = getPreIngestedTestIconDataDescription();
		expectedAllIconsDescriptor.splice(0, 1);

		const getIconfileDescToDelete = (iconfileIndex: number): IconfileDescriptor => {
			return {
				format: iconToDeleteFrom.files[iconfileIndex].format,
				size: iconToDeleteFrom.files[iconfileIndex].size
			};
		};

		const session: Session = createSession();
		await session.loginWithAllPrivileges();

		await addTestData(session.request(), testIconInputData);
		await deleteIconfile(
			session.request(),
			iconToDeleteFrom.name,
			getIconfileDescToDelete(0)
		);
		await deleteIconfile(
			session.request(),
			iconToDeleteFrom.name,
			getIconfileDescToDelete(1)
		);
		await deleteIconfile(
			session.request(),
			iconToDeleteFrom.name,
			getIconfileDescToDelete(2)
		);
		const iconsDesc = await describeAllIcons(session.request());
		expect(iconsDesc).toEqual(expectedAllIconsDescriptor);
		await assertFileNotInRepo(iconToDeleteFrom.name, getIconfileDescToDelete(0));
		await assertFileNotInRepo(iconToDeleteFrom.name, getIconfileDescToDelete(1));
		await assertFileNotInRepo(iconToDeleteFrom.name, getIconfileDescToDelete(2));
	});
});
