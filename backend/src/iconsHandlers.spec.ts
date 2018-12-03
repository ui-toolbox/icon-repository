import "jasmine";

import { IconDTO, createIconDTO } from "./iconsHandlers";
import { Set } from "immutable";
import { IconfileDescriptor, IconDescriptor } from "./icon";

describe("getAllIcons", () => {
    it("should return the list of icons with proper paths", () => {
        // TODO: Implement the verification of the actual requirement,
        //       not just a part of it. Then stop exporting "createPaths"
        //       in the tested module
        const iconPathRoot: string = "/icon";

        const name: string = "cartouche";
        const modifiedBy: string = "zazie";
        const iconfiles: Set<IconfileDescriptor> = Set([
            {format: "french", size: "great"},
            {format: "french", size: "huge"},
            {format: "english", size: "OK"},
            {format: "english", size: "nice"}
        ]);
        const iconDesc: IconDescriptor = new IconDescriptor(name, modifiedBy, iconfiles, Set());

        const expectedDTO: IconDTO = {
            name,
            modifiedBy,
            paths: [
                { format: "french", size: "great", path: iconPathRoot + "/cartouche/format/french/size/great" },
                { format: "french", size: "huge", path: iconPathRoot + "/cartouche/format/french/size/huge" },
                { format: "english", size: "OK", path: iconPathRoot + "/cartouche/format/english/size/OK" },
                { format: "english", size: "nice", path: iconPathRoot + "/cartouche/format/english/size/nice" }
            ],
            tags: []
        };

        expect(JSON.parse(JSON.stringify(createIconDTO(iconPathRoot, iconDesc)))).toEqual(expectedDTO);
    });
});
