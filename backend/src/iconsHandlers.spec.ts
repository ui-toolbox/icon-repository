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

        const name: string = "cartouche";
        const modifiedBy: string = "zazie";
        const iconFiles: Set<IconFileDescriptor> = Set([
            {format: "french", size: "great"},
            {format: "french", size: "huge"},
            {format: "english", size: "OK"},
            {format: "english", size: "nice"}
        ]);
        const iconDesc: IconDescriptor = new IconDescriptor(name, modifiedBy, iconFiles);

        const expectedDTO: IconDTO = {
            name,
            modifiedBy,
            paths: [
                { format: "french", size: "great", path: iconPathRoot + "/cartouche/formats/french/sizes/great" },
                { format: "french", size: "huge", path: iconPathRoot + "/cartouche/formats/french/sizes/huge" },
                { format: "english", size: "OK", path: iconPathRoot + "/cartouche/formats/english/sizes/OK" },
                { format: "english", size: "nice", path: iconPathRoot + "/cartouche/formats/english/sizes/nice" }
            ]
        };

        expect(JSON.parse(JSON.stringify(new IconDTO(iconPathRoot, iconDesc)))).toEqual(expectedDTO);
    });
});
