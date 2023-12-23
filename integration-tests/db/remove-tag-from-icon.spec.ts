import { createIcon, describeAllIcons } from "../../src/db/icon";
import {
	testData,
	manageTestResourcesBeforeAndAfter,
	assertIconDescriptorMatchesIconfile
} from "./db-test-utils";
import { addTag, getExistingTags, removeTag } from "../../src/db/tag";

describe("removeTagFromIcon", () => {
	const getPool = manageTestResourcesBeforeAndAfter();

	it("should remove tag from icon and only from icon and forget about tag after no more icon has it", async () => {
		const creIcon = createIcon(getPool());

		const iconfile1 = testData.iconfiles[0];
		const iconfile2 = testData.iconfiles[1];
		const modifiedBy = testData.modifiedBy;
		const tag1 = testData.tag1;
		const tag2 = testData.tag2;

		await creIcon(iconfile1, modifiedBy);
		await creIcon(iconfile2, modifiedBy);
		await addTag(getPool())(iconfile1.name, tag1);
		await addTag(getPool())(iconfile2.name, tag1);
		await addTag(getPool())(iconfile1.name, tag2);
		let iconDescList = await describeAllIcons(getPool())();
		expect(iconDescList.length).toEqual(2);
		assertIconDescriptorMatchesIconfile(iconDescList[0], iconfile1, [tag1, tag2]);
		assertIconDescriptorMatchesIconfile(iconDescList[1], iconfile2, [tag1]);
		let refCount = await removeTag(getPool())(iconfile1.name, tag1);
		expect(refCount).toEqual(1);
		let existingTags = await getExistingTags(getPool())();
		expect(existingTags).toEqual([tag1, tag2]);
		iconDescList = await describeAllIcons(getPool())();
		expect(iconDescList.length).toEqual(2);
		assertIconDescriptorMatchesIconfile(iconDescList[0], iconfile1, [tag2]);
		assertIconDescriptorMatchesIconfile(iconDescList[1], iconfile2, [tag1]);
		refCount = await removeTag(getPool())(iconfile2.name, tag1);
		expect(refCount).toEqual(0);
		existingTags = await getExistingTags(getPool())();
		expect(existingTags).toEqual([tag2]);
		iconDescList = await describeAllIcons(getPool())();
		expect(iconDescList.length).toEqual(2);
		assertIconDescriptorMatchesIconfile(iconDescList[0], iconfile1, [tag2]);
		assertIconDescriptorMatchesIconfile(iconDescList[1], iconfile2, []);
	});
});
