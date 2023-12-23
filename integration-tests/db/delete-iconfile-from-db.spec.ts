import { randomBytes } from "crypto";
import { type Pool } from "pg";

import { manageTestResourcesBeforeAndAfter } from "./db-test-utils";
import { type Iconfile, type IconfileDescriptor } from "../../src/icon";
import { query } from "../../src/db/db";
import { createIcon, deleteIconfile } from "../../src/db/icon";

describe("deleteIconFromDB", () => {
	const getPool: () => Pool = manageTestResourcesBeforeAndAfter();

	it("should delete all entries associated with the icon", async () => {
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
		await deleteIconfile(getPool())(iconfileInfo.name, iconfileDesc, user);
		let result = await query(getPool(), "select count(*) as row_count from icon", []);
		expect(result.rows[0].row_count).toEqual("0");
		result = await query(getPool(), "select count(*) as row_count from icon_file", []);
		expect(result.rows[0].row_count).toEqual("0");
	});
});
