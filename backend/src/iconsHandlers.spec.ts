import "jasmine";
import { Mock } from "ts-mocks";
import { Request, Response } from "express";
import * as Rx from "rxjs";

import iconServiceProvider from "./iconsService";
import iconsHandlersProvider, { IconDTO } from "./iconsHandlers";
import { getDefaultConfiguration } from "./configuration";
import { Set } from "immutable";
import { IconFileDescriptor, IconDescriptor } from "./icon";

describe("icon endpoint", () => {
    it("should return 404 status when icon not found on :path", done => {
        const iconService = iconServiceProvider({
            allowedFormats: getDefaultConfiguration().icon_data_allowed_formats,
            allowedSizes: getDefaultConfiguration().icon_data_allowed_sizes
        }, null, null);
        spyOn(iconService, "getIcon").and.returnValue(Rx.Observable.throw({code: "ENOENT"}));
        const req = new Mock<Request>({params: {path: "somepath"}}).Object;
        const res = new Mock<Response>({ status: () => new Mock<Response>({ send: () => void 0}).Object }).Object;
        iconsHandlersProvider(iconService).getIcon(req, res)
        .then(() => {
            expect(res.status).toHaveBeenCalledWith(404);
            done();
        });
    });
});

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
