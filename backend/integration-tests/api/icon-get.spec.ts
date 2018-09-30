import { manageTestResourcesBeforeAndAfter, Session, uxAuth } from "./api-test-utils";
import { getTestIconData, addTestData, getTestDataDescriptor, Icon } from "./icon-api-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { IconDTO } from "../../src/iconsHandlers";
import { describeIcon, describeAllIcons, getFilePath } from "./api-client";

const allIconsPath = "/icons";

describe(allIconsPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("GET should return the description of all icons in the repository", done => {
        const testData = getTestIconData();

        const session: Session = agent();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => describeAllIcons(session.requestBuilder()))
            .map(actualReply => expect(new Set(actualReply.toArray())).toEqual(new Set(getTestDataDescriptor())))
            .subscribe(boilerplateSubscribe(fail, done));
    });

});

const singleIconPath = allIconsPath + "/:name";
describe(singleIconPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it ("GET should describe the icon", done => {
        const testData = getTestIconData();

        const icon1: Icon = testData.get(0);
        const expectedReply: IconDTO = {
            name: icon1.name,
            modifiedBy: icon1.modifiedBy,
            paths: [
                { format: "belge", size: "large", path: getFilePath(icon1.name, {format: "belge", size: "large"}) },
                { format: "french", size: "great", path: getFilePath(icon1.name, {format: "french", size: "great"}) },
                { format: "french", size: "large", path: getFilePath(icon1.name, {format: "french", size: "large"}) }
            ]
        };

        const session: Session = agent();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => describeIcon(session.requestBuilder(), icon1.name))
            .map(actualReply => expect(actualReply).toEqual(expectedReply))
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("GET should return 404 for non-existent icon", done => {
        const session: Session = agent();
        describeIcon(
            session
            .responseOK(resp => resp.status === 404)
            .auth(uxAuth).requestBuilder(), "/icons/somenonexistentname")
            .subscribe(boilerplateSubscribe(fail, done));
    });

});
