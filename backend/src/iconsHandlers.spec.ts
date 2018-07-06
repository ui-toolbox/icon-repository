import "jasmine";

import { IconDTO } from "./iconsHandlers";
import { Set } from "immutable";
import { IconFileDescriptor, IconDescriptor } from "./icon";

describe("getAllIcons", () => {
    it("should return the list of icons with proper paths", () => {
        // TODO: Implement the verification of the actual requirement,
        //       not just a part of it. Then stop exporting "createPaths"
        //       in the tested module
        const iconPathRoot: string = "/icon";

        const iconName: string = "cartouche";
        const iconFiles: Set<IconFileDescriptor> = Set([
            {format: "french", size: "great"},
            {format: "french", size: "huge"},
            {format: "english", size: "OK"},
            {format: "english", size: "nice"}
        ]);
        const iconDesc: IconDescriptor = new IconDescriptor(iconName, iconFiles);

        const expectedDTO: IconDTO = {
            iconName,
            iconFiles: {
                french: {
                    great: iconPathRoot + "/formats/french/sizes/great",
                    huge: iconPathRoot + "/formats/french/sizes/huge"
                },
                english: {
                    OK: iconPathRoot + "/formats/english/sizes/OK",
                    nice: iconPathRoot + "/formats/english/sizes/nice"
                }
            }
        };

        expect(JSON.parse(JSON.stringify(new IconDTO(iconPathRoot, iconDesc)))).toEqual(expectedDTO);
    });
});
