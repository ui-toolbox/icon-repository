import "jasmine";
import { Mock } from "ts-mocks";
import { Request, Response } from "express";
import * as http from "http";
import * as fs from "fs";
import * as Rx from "rxjs";

import * as server from "./server";

import iconServiceProvider from "./iconsService";
import iconsHandlersProvider from "./iconsHandlers";
import { getDefaultConfiguration } from "./configuration";

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
