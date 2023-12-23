import * as crypto from "crypto";

import gitRepositoryProvider, {
	type GitRepository,
	GIT_COMMIT_FAIL_INTRUSIVE_TEST
} from "../../src/git";
import { type Iconfile } from "../../src/icon";
import {
	createTestGitRepo,
	deleteTestGitRepo,
	getCurrentCommit,
	assertGitCleanStatus,
	getTestRepoDir,
	assertFileInRepo
} from "./git-test-utils";

describe("git access functions", () => {
	let gitRepository: GitRepository;

	beforeAll(async () => {
		gitRepository = await gitRepositoryProvider(getTestRepoDir());
	});

	beforeEach(async () => {
		await createTestGitRepo();
	});

	afterEach(async () => {
		delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
		await deleteTestGitRepo();
	});

	describe("should include addIconfile which", () => {
		it("should add an icon file", async () => {
			const iconInfo: Iconfile = {
				name: "pizza",
				format: "thin-crust",
				size: "32cm",
				content: crypto.randomBytes(1024)
			};
			const user = "zazie";
			await gitRepository.addIconfile(iconInfo, user);
			const sha1 = await getCurrentCommit();
			expect(sha1.length).toEqual("8e9b80b5155dea01e5175bc819bbe364dbc07a66".length);
			await assertGitCleanStatus();
			await assertFileInRepo(iconInfo);
		});

		it("should throw an error, but preserve the last consistent git repo state, " +
                "in case adding an icon file failse", async () => {
			const iconInfo: Iconfile = {
				name: "pizza",
				format: "thin-crust",
				size: "32cm",
				content: crypto.randomBytes(1024)
			};
			const iconInfo1: Iconfile = {
				name: "pizza1",
				format: "thin-crust1",
				size: "32cm1",
				content: crypto.randomBytes(1024)
			};
			const user = "zazie";
			await gitRepository.addIconfile(iconInfo, user);
			process.env[GIT_COMMIT_FAIL_INTRUSIVE_TEST] = "true";
			const lastGoodSha1 = await getCurrentCommit();
			try {
				await gitRepository.addIconfile(iconInfo1, user);
				fail("Expected an error to make exection skip this part");
			} catch (error) {
				const currentSha1 = await getCurrentCommit();
				expect(currentSha1).toEqual(lastGoodSha1);
				await assertGitCleanStatus();
			}
		});
	});
});
