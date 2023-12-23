import { randomBytes } from "crypto";

import {
	getCheckIconfile,
	assertIconCount,
	manageTestResourcesBeforeAndAfter
} from "./db-test-utils";
import { type Iconfile } from "../../src/icon";
import { GIT_COMMIT_FAIL_INTRUSIVE_TEST } from "../../src/git";
import { createIcon, getIconfile } from "../../src/db/icon";

describe("addIconToDB", () => {
	const getPool = manageTestResourcesBeforeAndAfter();

	it("should be capable to add a first icon", async () => {
		const user = "zazie";
		const iconfileInfo: Iconfile = {
			name: "metro-icon",
			format: "french",
			size: "great",
			content: randomBytes(4096)
		};
		await createIcon(getPool())(iconfileInfo, user);
		await getCheckIconfile(getIconfile(getPool()), iconfileInfo);
	});

	it("should be capable to add a second icon", async () => {
		const user = "zazie";
		const iconfileInfo1: Iconfile = {
			name: "metro-icon",
			format: "french",
			size: "great",
			content: randomBytes(4096)
		};
		const iconfileInfo2: Iconfile = {
			name: "animal-icon",
			format: "french",
			size: "huge",
			content: randomBytes(4096)
		};
		await createIcon(getPool())(iconfileInfo1, user);
		await createIcon(getPool())(iconfileInfo2, user);
		const getIconfileFromDB = getIconfile(getPool());
		await getCheckIconfile(getIconfileFromDB, iconfileInfo1);
		await getCheckIconfile(getIconfileFromDB, iconfileInfo2);
		await assertIconCount(getPool(), 2);
	});

	it("should rollback to last consistent state, in case an error occurs in sideEffect", async () => {
		const user = "zazie";
		const iconfileInfo1: Iconfile = {
			name: "metro-icon",
			format: "french",
			size: "great",
			content: randomBytes(4096)
		};
		const iconfileInfo2: Iconfile = {
			name: "animal-icon",
			format: "french",
			size: "huge",
			content: randomBytes(4096)
		};
		const sideEffectErrorMessage = "Error in creating side effect";
		await createIcon(getPool())(iconfileInfo1, user);
		process.env[GIT_COMMIT_FAIL_INTRUSIVE_TEST] = "true";
		try {
			await	createIcon(getPool())(iconfileInfo2, user, () => { throw Error(sideEffectErrorMessage); });
			fail("Expected an error to make exection skip this part");
		} catch (error) {
			expect(error.message).toEqual(sideEffectErrorMessage);
			const getIconfileFromDB = getIconfile(getPool());
			await getCheckIconfile(getIconfileFromDB, iconfileInfo1);
			await assertIconCount(getPool(), 1);
		}
	});
});
