import { manageTestResourcesBeforeAndAfter, type Session } from "./api-test-utils";
import { testIconInputData, addTestData, getPreIngestedTestIconDataDescription } from "./icon-api-test-utils";
import { describeIcon, describeAllIcons } from "./api-client";

const allIconsPath = "/icon";

describe(allIconsPath, () => {
	const createSession = manageTestResourcesBeforeAndAfter();
	let session: Session;

	it("GET should return the description of all icons in the repository", async () => {
		session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		const actualReply = await describeAllIcons(session.request());
		expect(new Set(actualReply)).toEqual(new Set(getPreIngestedTestIconDataDescription()));
	});
});

const singleIconPath = allIconsPath + "/:name";
describe(singleIconPath, () => {
	const createSession = manageTestResourcesBeforeAndAfter();
	let session: Session;

	it("GET should describe the icon", async () => {
		session = createSession();
		await session.loginWithAllPrivileges();
		await addTestData(session.request(), testIconInputData);
		const actualReply = await describeIcon(session.request(), getPreIngestedTestIconDataDescription()[0].name);
		expect(actualReply).toEqual(getPreIngestedTestIconDataDescription()[0]);
	});

	it("GET should return 404 for non-existent icon", async () => {
		session = createSession();
		await session.loginWithAllPrivileges();
		await describeIcon(
			session.request({ responseValidator: resp => resp.status === 404 }), "/icon/somenonexistentname");
	});
});
