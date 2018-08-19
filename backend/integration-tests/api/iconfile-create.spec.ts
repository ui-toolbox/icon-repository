import { randomBytes } from "crypto";
import { boilerplateSubscribe } from "../testUtils";
import {
    iconFileEndpointPath,
    manageTestResourcesBeforeAndAfter,
    getCheckIconFile
} from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { getTestIconData, addTestData } from "./icon-api-test-utils";
import { addIconFile, setAuth } from "./api-client";
import { IconFileDescriptor, IconFile, IconFileData } from "../../src/icon";

describe(iconFileEndpointPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it ("POST should fail with 403 without either of CREATE_ICON or ADD_ICON_FILE privilege", done => {

        const session = agent();
        setAuth(session.requestBuilder(), [])
        .flatMap(() => addIconFile(
                session.responseOK(resp => resp.status === 403).requestBuilder(),
                {name: "somename", format: "some format", size: "some size", content: randomBytes(4096)}
            ))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should fail on insufficient data", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FILE
        ];

        const testData = getTestIconData();

        const session = agent();
        addTestData(session.requestBuilder(), testData)
        .flatMap(() => setAuth(session.requestBuilder(), privileges))
        .flatMap(() =>
            addIconFile(
                session.responseOK(resp => resp.status === 400).requestBuilder(),
                { name: testData.get(0).name, ...testData.get(0).files.get(0), format: ":format" }
            ))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        const testData = getTestIconData();
        const newIconFileDesc: IconFileDescriptor = { format: "anotherFormat", size: "anotherSize" };
        const newIconFileData: IconFileData = { ...newIconFileDesc, content: randomBytes(4096) };
        const newIconFile: IconFile = { name: testData.get(0).name, ...newIconFileData };

        const session = agent();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), privileges))
            .flatMap(() => addIconFile(session.requestBuilder(), newIconFile))
            .flatMap(() => getCheckIconFile(session, newIconFile))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with ADD_ICON_FILE privilege", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FILE
        ];
        const testData = getTestIconData();
        const newIconFileDesc: IconFileDescriptor = { format: "anotherFormat", size: "anotherSize" };
        const newIconFileData: IconFileData = { ...newIconFileDesc, content: randomBytes(4096) };
        const newIconFile: IconFile = { name: testData.get(0).name, ...newIconFileData };

        const session = agent();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => setAuth(session.requestBuilder(), privileges))
            .flatMap(() => addIconFile(session.requestBuilder(), newIconFile))
            .flatMap(() => getCheckIconFile(session, newIconFile))
            .subscribe(boilerplateSubscribe(fail, done));
    });

});
