import {
	iconEndpointPath,
	manageTestResourcesBeforeAndAfter
} from "./api-test-utils";
import { Permission } from "../../src/security/authorization/permissions/groups-permissions";

import { setAuth, describeAllIcons, updateIcon, ingestIconfile, describeIcon } from "./api-client";
import {
	testIconInputData,
	addTestData,
	ingestedTestIconData,
	getPreIngestedTestIconDataDescription,
	moreTestIconInputData
} from "./icon-api-test-utils";
import { type IconAttributes } from "../../src/icon";
import { assertGitCleanStatus, assertFileInRepo, assertFileNotInRepo } from "../git/git-test-utils";
import clone from "../../src/utils/clone";
import { createIconfilePath, type IconDTO } from "../../src/icons-handlers";

describe(`PATCH ${iconEndpointPath}`, () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("should fail with 403 without UPDATE_ICON privilege", async () => {
		const oldIconName = "cartouche";
		const newIcon: IconAttributes = {
			name: "some icon name"
		};

		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), []);
		await updateIcon(
			session.request({ responseValidator: resp => resp.status === 403 }),
			oldIconName,
			newIcon
		);
	});

	it("should complete with UPDATE_ICON privilege", async () => {
		const testAllIconDescriptor = getPreIngestedTestIconDataDescription();

		const oldIconName = testIconInputData[0].name;
		const newIconAttributes: IconAttributes = Object.freeze({
			name: "some new icon name"
		});

		const changedIconDTO: IconDTO = {
			name: newIconAttributes.name,
			modifiedBy: testAllIconDescriptor[1].modifiedBy,
			paths: [
				{ format: "png", size: "36px", path: `/icon/${newIconAttributes.name}/format/png/size/36px` },
				{ format: "svg", size: "18px", path: `/icon/${newIconAttributes.name}/format/svg/size/18px` },
				{ format: "svg", size: "24px", path: `/icon/${newIconAttributes.name}/format/svg/size/24px` }
			],
			tags: []
		};
		// Expected order is lexicographic by icon name: "cast..." first, "some icon name" second
		const expectedIconDescriptors = [
			testAllIconDescriptor[1],
			changedIconDTO
		];

		const oldIngestedIconfiles = ingestedTestIconData[0].files;

		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await updateIcon(
			session.request({ responseValidator: resp => resp.status === 204 }),
			oldIconName,
			newIconAttributes
		);
		const iconInfoList = await describeAllIcons(session.request());
		expect(iconInfoList).toEqual(expectedIconDescriptors);
		// Assert GIT status:
		await assertGitCleanStatus();
		await assertFileNotInRepo(oldIconName, testIconInputData[0].files[0]);
		await assertFileNotInRepo(oldIconName, testIconInputData[0].files[1]);
		await assertFileNotInRepo(oldIconName, testIconInputData[0].files[2]);
		await assertFileInRepo({ name: newIconAttributes.name, ...oldIngestedIconfiles[0] });
		await assertFileInRepo({ name: newIconAttributes.name, ...oldIngestedIconfiles[1] });
		await assertFileInRepo({ name: newIconAttributes.name, ...oldIngestedIconfiles[2] });
	});
});

describe(`POST ${iconEndpointPath}`, () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("should not allow adding icon-files without proper privilege", async () => {
		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), []);
		await ingestIconfile(
			session.request({ responseValidator: resp => resp.status === 403 }),
			testIconInputData[0].name,
			moreTestIconInputData[0].files[0].content
		);
	});

	it("should allow adding icon-files with UPDATE_ICON and ADD_ICONFILE privilege", async () => {
		const session = createSession();
		await session.loginWithAllPrivileges();
		await	addTestData(session.request(), testIconInputData);
		await setAuth(session.request(), [Permission.UPDATE_ICON, Permission.ADD_ICONFILE]);
		await ingestIconfile(
			session.request({ responseValidator: resp => resp.status === 200 }),
			testIconInputData[0].name,
			moreTestIconInputData[0].files[1].content
		);
	});

	it("should allow adding icon-files with new format-size combinations", async () => {
		const nameOfIconToUpdate = testIconInputData[0].name;
		const iconfileToAdd = moreTestIconInputData[0].files[1];

		const expectedIconDescription = clone(getPreIngestedTestIconDataDescription()[0]);
		const addedIconfileDescription = {
			format: iconfileToAdd.format,
			size: iconfileToAdd.size,
			path: createIconfilePath("/icon", nameOfIconToUpdate, iconfileToAdd)
		};
		expectedIconDescription.paths.push(addedIconfileDescription);

		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		const iconfileInfo = await ingestIconfile(
			session.request({ responseValidator: resp => resp.status === 200 }),
			nameOfIconToUpdate,
			iconfileToAdd.content
		);
		expect(iconfileInfo).toEqual({ iconName: nameOfIconToUpdate, ...addedIconfileDescription });
		const iconDescription = await describeIcon(session.request(), nameOfIconToUpdate);
		expect(iconDescription.name).toEqual(expectedIconDescription.name);
		expect(iconDescription.paths).toEqual(expectedIconDescription.paths);
	});

	it("should not allow adding icon-files with already existing format-size combinations", async () => {
		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		await ingestIconfile(
			session.request({ responseValidator: resp => resp.status === 409 }),
			testIconInputData[0].name,
			moreTestIconInputData[0].files[0].content
		);
	});
});
