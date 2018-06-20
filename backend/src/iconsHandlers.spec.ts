import "jasmine";
import { Mock } from "ts-mocks";
import { Request, Response } from "express";
import * as Rx from "rxjs";

import iconServiceProvider from "./iconsService";
import iconsHandlersProvider, { createPaths } from "./iconsHandlers";
import { getDefaultConfiguration } from "./configuration";
import { Set } from "immutable";
import { IconFileDescriptor } from "./icon";

describe("icon endpoint", () => {
    it("should return 404 status when icon not found on :path", done => {
        const iconService = iconServiceProvider(getDefaultConfiguration, null, null);
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

describe("/icons/getAllIcons", () => {
    fit("should return the list of icons with proper paths", () => {
        // TODO: Implement the verification of the actual requirement,
        //       not just a part of it. Then stop exporting "createPaths"
        //       in the tested module
        const iconFiles: Set<IconFileDescriptor> = Set([
            {format: "french", size: "great"},
            {format: "french", size: "huge"},
            {format: "english", size: "OK"},
            {format: "english", size: "nice"}
        ]);

        const expectedDTO = {
            french: {
                great: "/format/french/size/great",
                huge: "/format/french/size/huge"
            },
            english: {
                OK: "/format/english/size/OK",
                nice: "/format/english/size/nice"
            }
        };

        expect(createPaths(iconFiles)).toEqual(expectedDTO);
    });
});
