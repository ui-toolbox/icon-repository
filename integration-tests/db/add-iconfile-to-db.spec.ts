import { randomBytes } from "crypto";
import { manageTestResourcesBeforeAndAfter } from "./db-test-utils";
import { type Pool } from "pg";

import { type IconfileDescriptor, type Iconfile, IconfileAlreadyExists } from "../../src/icon";
import { createIcon, addIconfileToIcon } from "../../src/db/icon";

describe("addIconfileToDB", () => {
	const getPool: () => Pool = manageTestResourcesBeforeAndAfter();

	it("should throw IconfileAlreadyExists on duplicate iconfile", async () => {
		const user = "zazie";
		const iconfileDesc: IconfileDescriptor = {
			format: "french",
			size: "great"
		};
		const iconfileInfo: Iconfile = {
			name: "metro-icon",
			...iconfileDesc,
			content: randomBytes(4096)
		};

		await createIcon(getPool())(iconfileInfo, user);
		try {
			await addIconfileToIcon(getPool())(
				{
					name: iconfileInfo.name,
					...iconfileDesc,
					content: randomBytes(234)
				},
				user
			);
		} catch (error) {
			expect(error instanceof IconfileAlreadyExists).toBeTruthy();
		}
	});
});
