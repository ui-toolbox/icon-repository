import { flatMap, map } from "rxjs/operators";
import { manageTestResourcesBeforeAndAfter, testData, assertIconDescriptorMatchesIconfile } from "./db-test-utils";
import { createIcon, describeIcon, describeAllIcons } from "../../src/db/icon";
import { getExistingTags, addTag } from "../../src/db/tag";
import { boilerplateSubscribe } from "../testUtils";
import { query } from "../../src/db/db";
import { Set } from "immutable";

describe("addTagToIcon", () => {

    const getPool = manageTestResourcesBeforeAndAfter();

    it("should create non-existing tag and associate it with the icon", done => {
        const iconfile = testData.iconfiles[0];

        const tag = "used-in-marvinjs";

        createIcon(getPool())(iconfile, "ux")
        .pipe(
            flatMap(() => getExistingTags(getPool())()),
            map(existingTags => expect(existingTags.contains(tag)).toBeFalsy()),
            flatMap(() => describeIcon(getPool())(iconfile.name)),
            map(iconDesc => expect(iconDesc.tags.contains(tag)).toBeFalsy()),
            flatMap(() => addTag(getPool())(iconfile.name, tag)),
            flatMap(() => getExistingTags(getPool())()),
            map(existingTags => expect(existingTags.contains(tag)).toBeTruthy()),
            flatMap(() => describeIcon(getPool())(iconfile.name)),
            map(iconDesc => expect(iconDesc.tags.contains(tag)).toBeTruthy())
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should reuse an existing tag to assicate it with the icon", done => {
        const creIcon = createIcon(getPool());

        const iconfile1 = testData.iconfiles[0];
        const iconfile2 = testData.iconfiles[1];
        const modifiedBy = testData.modifiedBy;
        const tag = testData.tag1;

        creIcon(iconfile1, modifiedBy)
        .pipe(
            flatMap(() => addTag(getPool())(iconfile1.name, tag)),
            flatMap(() => query(getPool(), "select id from tag", [])),
            flatMap(tagIdResult1 => creIcon(iconfile2, modifiedBy)
                .pipe(
                    flatMap(() => addTag(getPool())(iconfile2.name, tag)),
                    flatMap(() => query(getPool(), "select id from tag", [])),
                    map(tagIdResult2 => {
                        const tagIdAfterAddingTheTagFirst = tagIdResult1.rows[0].id;
                        const tagIdAfterAddingTheSameTagTwice = tagIdResult2.rows[0].id;
                        expect(tagIdAfterAddingTheSameTagTwice).toEqual(tagIdAfterAddingTheTagFirst);
                    })
                )),
            flatMap(() => getExistingTags(getPool())()),
            map(existingTags => expect(existingTags.contains(tag)).toBeTruthy()),
            flatMap(() => describeAllIcons(getPool())()),
            map(iconDescList => {
                expect(iconDescList.size).toEqual(2);
                assertIconDescriptorMatchesIconfile(iconDescList.get(0), iconfile1, Set.of(tag));
                assertIconDescriptorMatchesIconfile(iconDescList.get(1), iconfile2, Set.of(tag));
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
