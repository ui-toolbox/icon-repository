import {
	iconEndpointPath,
	manageTestResourcesBeforeAndAfter,
	getCheckIconfile,
	defaultAuth
} from "./api-test-utils";
import { Permission } from "../../src/security/authorization/permissions/groups-permissions";

import {
	getCurrentCommit as getCurrentGitCommit,
	assertGitCleanStatus
} from "../git/git-test-utils";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { setAuth, createIcon, describeAllIcons, getFilePath } from "./api-client";
import { type IconDTO } from "../../src/icons-handlers";
import {
	testIconInputData,
	addTestData,
	getPreIngestedTestIconDataDescription,
	getDemoIconfileContent
} from "./icon-api-test-utils";
import { type Iconfile, type IconfileDescriptor } from "../../src/icon";

describe(iconEndpointPath, () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("POST should fail with 403 without CREATE_ICON privilege", async () => {
		const iconName: string = "dock";
		const format = "png";
		const sizeInDP = "36dp";

		const session = createSession();
		await session.loginWithAllPrivileges();
		await setAuth(session.request(), []);
		const content = await getDemoIconfileContent(iconName, { format, size: sizeInDP });
		await createIcon(
			session.request({ responseValidator: resp => resp.status === 403 }),
			iconName, content);
	});

	it("POST should complete with CREATE_ICON privilege", async () => {
		const iconName = "dock";
		const format = "png";
		const sizeInDP = "36dp";
		const size = "54px";

		const expectedIconInfo: IconDTO = {
			name: iconName,
			modifiedBy: defaultAuth.user,
			paths: [{
				path: getFilePath(iconName, { format, size }),
				format,
				size
			}],
			tags: []
		};

		const permissions = [
			Permission.CREATE_ICON
		];
		const session = createSession();
		await session.loginWithAllPrivileges();
		await setAuth(session.request(), permissions);
		const content = await getDemoIconfileContent(iconName, { format, size: sizeInDP });
		const actualIconInfo = await createIcon(session.request(), iconName, content);
		expect(actualIconInfo).toEqual(expectedIconInfo);
		const iconInfoList = await describeAllIcons(session.request());
		expect(iconInfoList.length).toEqual(1);
		expect({ ...iconInfoList[0] }).toEqual({ ...expectedIconInfo });
	});

	it("POST should be capable of creating multiple icons in a row", async () => {
		const sampleIconName1 = testIconInputData[0].name;
		const sampleIconfileDesc1: IconfileDescriptor = testIconInputData[0].files[0];
		const sampleIconName2 = testIconInputData[1].name;
		const sampleIconfileDesc2: IconfileDescriptor = testIconInputData[1].files[1];

		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		let content = await getDemoIconfileContent(sampleIconName1, sampleIconfileDesc1);
		await getCheckIconfile(session, {
			name: sampleIconName1,
			...sampleIconfileDesc1,
			content
		});
		content = await getDemoIconfileContent(sampleIconName2, sampleIconfileDesc2);
		await getCheckIconfile(session, {
			name: sampleIconName2,
			...sampleIconfileDesc2,
			content
		});
		await assertGitCleanStatus();
		const iconDTOList = await describeAllIcons(session.request());
		expect(new Set(iconDTOList)).toEqual(new Set(getPreIngestedTestIconDataDescription()));
	});

	it("POST should rollback to last consistent state, in case an error occurs", async () => {
		const iconfileToFind1: Iconfile = {
			name: testIconInputData[0].name,
			...testIconInputData[0].files[0]
		};
		const iconfileToFind2: Iconfile = {
			name: testIconInputData[0].name,
			...testIconInputData[0].files[1]
		};

		const session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), [testIconInputData[0]]);
		const gitSha1 = await getCurrentGitCommit();
		process.env[GIT_COMMIT_FAIL_INTRUSIVE_TEST] = "true";
		await addTestData(
			session
				.request({ responseValidator: resp => resp.status === 500 }),
			[testIconInputData[1]]
		);
		const gitSha2 = await getCurrentGitCommit();
		expect(gitSha1).toEqual(gitSha2);
		await getCheckIconfile(session, iconfileToFind1);
		await getCheckIconfile(session, iconfileToFind2);
		await assertGitCleanStatus();
		const iconInfoList = await describeAllIcons(session.request());
		expect(iconInfoList.length).toEqual(1);
		expect(iconInfoList[0]).toEqual(getPreIngestedTestIconDataDescription()[0]);
	});
});
