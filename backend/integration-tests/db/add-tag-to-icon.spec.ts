import { manageTestResourcesBeforeAndAfter, testData, assertIconDescriptorMatchesIconfile } from "./db-test-utils";
import { createIcon, describeIcon, describeAllIcons } from "../../src/db/icon";
import { getExistingTags, addTag } from "../../src/db/tag";
import { query } from "../../src/db/db";

describe("addTagToIcon", () => {
	const getPool = manageTestResourcesBeforeAndAfter();

	it("should create non-existing tag and associate it with the icon", async () => {
		const iconfile = testData.iconfiles[0];

		const tag = "used-in-marvinjs";

		await createIcon(getPool())(iconfile, "ux");
		let existingTags = await getExistingTags(getPool())();
		expect(existingTags.includes(tag)).toBeFalsy();
		let iconDesc = await describeIcon(getPool())(iconfile.name);
		expect(iconDesc.tags.includes(tag)).toBeFalsy();
		await addTag(getPool())(iconfile.name, tag);
		existingTags = await getExistingTags(getPool())();
		expect(existingTags.includes(tag)).toBeTruthy();
		iconDesc = await describeIcon(getPool())(iconfile.name);
		expect(iconDesc.tags.includes(tag)).toBeTruthy();
	});

	it("should reuse an existing tag to assicate it with the icon", async () => {
		const creIcon = createIcon(getPool());

		const iconfile1 = testData.iconfiles[0];
		const iconfile2 = testData.iconfiles[1];
		const modifiedBy = testData.modifiedBy;
		const tag = testData.tag1;

		await creIcon(iconfile1, modifiedBy);
		await addTag(getPool())(iconfile1.name, tag);
		const tagIdResult1 = await query(getPool(), "select id from tag", []);
		await creIcon(iconfile2, modifiedBy);
		await addTag(getPool())(iconfile2.name, tag);
		const tagIdResult2 = await query(getPool(), "select id from tag", []);
		const tagIdAfterAddingTheTagFirst = tagIdResult1.rows[0].id;
		const tagIdAfterAddingTheSameTagTwice = tagIdResult2.rows[0].id;
		expect(tagIdAfterAddingTheSameTagTwice).toEqual(tagIdAfterAddingTheTagFirst);
		const existingTags = await getExistingTags(getPool())();
		expect(existingTags.includes(tag)).toBeTruthy();
		const iconDescList = await describeAllIcons(getPool())();
		expect(iconDescList.length).toEqual(2);
		assertIconDescriptorMatchesIconfile(iconDescList[0], iconfile1, [tag]);
		assertIconDescriptorMatchesIconfile(iconDescList[1], iconfile2, [tag]);
	});
});
