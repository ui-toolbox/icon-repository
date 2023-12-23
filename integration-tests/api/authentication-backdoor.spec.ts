import { startTestServer, getBaseUrl, manageTestResourcesBeforeAndAfter, shutdownDownServer, Session } from "./api-test-utils";
import { authenticationBackdoorPath, setAuth } from "./api-client";

describe("backdoor to permissions", () => {
	it("mustn't be available by default", async () => {
		await startTestServer({});
		try {
			const session = new Session(getBaseUrl(), undefined);
			await session.loginWithAllPrivileges();
			await session.request()
				.put("/backdoor/authentication")
				.ok(resp => resp.status === 404)
				.send();
		} finally {
			await shutdownDownServer();
		}
	});

	it("should be available when enabled", async () => {
		await startTestServer({ enable_backdoors: true });
		try {
			const session = new Session(getBaseUrl(), undefined);
			await session.loginWithAllPrivileges();
			await session.request()
				.put("/backdoor/authentication")
				.ok(resp => resp.status === 200)
				.send();
		} finally {
			await shutdownDownServer();
		}
	});
});

describe(authenticationBackdoorPath, () => {
	const createSession = manageTestResourcesBeforeAndAfter();

	it("should allow to set permissions on the current session", async () => {
		const testPrivileges = ["asdf"];

		const session = createSession();
		await session.loginWithAllPrivileges();
		await setAuth(session.request(), testPrivileges);
		const result = await session.request()
			.get("/backdoor/authentication")
			.send();
		expect(result.body).toEqual(testPrivileges);
	});
});
