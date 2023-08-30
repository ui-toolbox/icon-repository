import { manageTestResourcesBeforeAndAfter, type Session } from "./api-test-utils";
import { testIconInputData } from "./icon-api-test-utils";
import { createIcon, setAuth, addTag, describeIcon, type RequestBuilder, getTags, removeTag } from "./api-client";
import { Permission } from "../../src/security/authorization/permissions/groups-permissions";

describe("POST /icon/:name/tag", () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("should fail without permision", async () => {
		const testIcon = testIconInputData[0];
		const tag = "Ahoj";

		const session: Session = createSession();
		await session.loginWithAllPrivileges();
		const rb: RequestBuilder = session.request();

		await createIcon(rb, testIcon.name, testIcon.files[0].content);
		await setAuth(rb, []);
		await addTag(
			session.request({ responseValidator: resp => resp.status === 403 }),
			testIcon.name, tag);
	});

	it("should pass with permission", async () => {
		const testIcon = testIconInputData[0];
		const tag = "Ahoj";

		const session: Session = createSession();
		await session.loginWithAllPrivileges();
		const rb: RequestBuilder = session.request();

		await createIcon(rb, testIcon.name, testIcon.files[0].content);
		let iconDescriptor = await describeIcon(rb, testIcon.name);
		expect(iconDescriptor.tags.length).toEqual(0);
		let tags = await getTags(rb);
		expect(tags.length).toEqual(0);
		await setAuth(rb, [Permission.ADD_TAG]);
		await addTag(
			session.request({ responseValidator: resp => resp.status === 200 }),
			testIcon.name, tag
		);
		iconDescriptor = await describeIcon(rb, testIcon.name);
		expect(iconDescriptor.tags).toEqual([tag]);
		tags = await getTags(rb);
		expect(tags).toEqual([tag]);
	});
});

describe("DEL /icon/:name/tag/:tag", () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("should fail without permision", async () => {
		const testIcon = testIconInputData[0];
		const tag = "Ahoj";

		const session: Session = createSession();
		await session.loginWithAllPrivileges();
		const rb: RequestBuilder = session.request();

		await createIcon(rb, testIcon.name, testIcon.files[0].content);
		await addTag(rb, testIcon.name, tag);
		await setAuth(rb, []);
		await removeTag(
			session.request({ responseValidator: resp => resp.status === 403 }),
			testIcon.name, tag
		);
	});

	it("should pass with permission", async () => {
		const testIcon = testIconInputData[0];
		const tag = "Ahoj";

		const session: Session = createSession();
		await session.loginWithAllPrivileges();
		const rb: RequestBuilder = session.request();

		await createIcon(rb, testIcon.name, testIcon.files[0].content);
		await addTag(rb, testIcon.name, tag);
		await setAuth(rb, [Permission.REMOVE_TAG]);
		const remainingRefCount = await removeTag(
			session.request({ responseValidator: resp => resp.status === 200 }),
			testIcon.name, tag
		);
		expect(remainingRefCount).toEqual(0);
		const iconDescriptor = await describeIcon(rb, testIcon.name);
		expect(iconDescriptor.tags.length).toEqual(0);
		const tags = await getTags(rb);
		expect(tags.length).toEqual(0);
	});
});
