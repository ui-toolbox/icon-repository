import { map, flatMap } from "rxjs/operators";
import { createIcon, describeAllIcons } from "../../src/db/icon";
import { testData,
    manageTestResourcesBeforeAndAfter,
    assertIconDescriptorMatchesIconfile,
    verifyIconToTag } from "./db-test-utils";
import { addTag, getExistingTags, removeTag } from "../../src/db/tag";
import { boilerplateSubscribe } from "../testUtils";
import { Set } from "immutable";

describe("removeTagFromIcon", () => {

    const getPool = manageTestResourcesBeforeAndAfter();

    it("should remove tag from icon and only from icon and forget about tag after no more icon has it", done => {
        const creIcon = createIcon(getPool());

        const iconfile1 = testData.iconfiles[0];
        const iconfile2 = testData.iconfiles[1];
        const modifiedBy = testData.modifiedBy;
        const tag1 = testData.tag1;
        const tag2 = testData.tag2;

        creIcon(iconfile1, modifiedBy)
        .pipe(
            flatMap(tagIdResult1 => creIcon(iconfile2, modifiedBy)
                .pipe(
                    flatMap(() => addTag(getPool())(iconfile1.name, tag1)),
                    flatMap(() => verifyIconToTag(getPool(), Set.of(1))),
                    flatMap(() => addTag(getPool())(iconfile2.name, tag1)),
                    flatMap(() => addTag(getPool())(iconfile1.name, tag2)),
                    flatMap(() => verifyIconToTag(getPool(), Set.of(1, 2)))
                )),
            flatMap(() => describeAllIcons(getPool())()),
            map(iconDescList => {
                expect(iconDescList.size).toEqual(2);
                assertIconDescriptorMatchesIconfile(iconDescList.get(0), iconfile1, Set.of(tag1, tag2));
                assertIconDescriptorMatchesIconfile(iconDescList.get(1), iconfile2, Set.of(tag1));
            }),
            flatMap(() => removeTag(getPool())(iconfile1.name, tag1)),
            map(refCount => expect(refCount).toEqual(1)),
            flatMap(() => getExistingTags(getPool())()),
            map(existingTags => expect(existingTags).toEqual(Set.of(tag1, tag2))),
            flatMap(() => describeAllIcons(getPool())()),
            map(iconDescList => {
                expect(iconDescList.size).toEqual(2);
                assertIconDescriptorMatchesIconfile(iconDescList.get(0), iconfile1, Set.of(tag2));
                assertIconDescriptorMatchesIconfile(iconDescList.get(1), iconfile2, Set.of(tag1));
            }),
            flatMap(() => removeTag(getPool())(iconfile2.name, tag1)),
            map(refCount => expect(refCount).toEqual(0)),
            flatMap(() => getExistingTags(getPool())()),
            map(existingTags => expect(existingTags).toEqual(Set.of(tag2))),
            flatMap(() => verifyIconToTag(getPool(), Set.of(2))),
            flatMap(() => describeAllIcons(getPool())()),
            map(iconDescList => {
                expect(iconDescList.size).toEqual(2);
                assertIconDescriptorMatchesIconfile(iconDescList.get(0), iconfile1, Set.of(tag2));
                assertIconDescriptorMatchesIconfile(iconDescList.get(1), iconfile2, Set.of());
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
