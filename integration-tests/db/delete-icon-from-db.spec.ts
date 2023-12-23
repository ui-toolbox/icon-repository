import { randomBytes } from "crypto";
import { type Pool } from "pg";

import { manageTestResourcesBeforeAndAfter } from "./db-test-utils";
import { type Iconfile } from "../../src/icon";
import { query } from "../../src/db/db";
import { createIcon, deleteIcon } from "../../src/db/icon";

describe("deleteIconFromDB", () => {
	const getPool: () => Pool = manageTestResourcesBeforeAndAfter();

	it("should delete all entries associated with the icon", async () => {
		const user = "zazie";
		const iconfileInfo: Iconfile = {
			name: "metro-icon",
			format: "french",
			size: "great",
			content: randomBytes(4096)
		};

		await createIcon(getPool())(iconfileInfo, user);
		await deleteIcon(getPool())(iconfileInfo.name, user);
		let result = await query(getPool(), "select count(*) as row_count from icon", []);
		expect(result.rows[0].row_count).toEqual("0");
		result = await query(getPool(), "select count(*) as row_count from icon_file", []);
		expect(result.rows[0].row_count).toEqual("0");
	});
});
