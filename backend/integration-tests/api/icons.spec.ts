import {
    manageTestResourcesBeforeAfter,
    Session,
    uxAuth
} from "./api-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { addTestData, getTestIconData, Icon, testDataDescriptor } from "./icon-api-test-utils";
import { describeAllIcons, describeIcon, getFilePath } from "./api-client";
import { IconDTO } from "../../src/iconsHandlers";

const iconRepoConfigPath = "/icons/config";

describe(iconRepoConfigPath, () => {
    const agent = manageTestResourcesBeforeAfter();

    it("should return the correct default", done => {
        const session = agent();
        session.requestBuilder()
            .get(iconRepoConfigPath)
            .ok(resp => resp.status === 200)
            .then(
                result => {
                    expect(result.body).toEqual({
                        allowedFileFormats: [
                            "svg",
                            "png"
                        ],
                        allowedIconSizes: [
                            "18px", "24px", "48px", // for svg
                            "18dp", "24dp", "36dp", "48dp", "144dp" // for png
                        ]
                    });
                    done();
                },
                error => {
                    fail(error);
                    done();
                }
            )
            .catch(error => {
                fail(error);
                done();
            });
    });
});

const allIconsPath = "/icons";

describe(allIconsPath, () => {

    const agent = manageTestResourcesBeforeAfter();

    it("GET should return the description of all icons in the repository", done => {
        const testData = getTestIconData();

        const session: Session = agent();
        addTestData(session.requestBuilder(), testData)
            .flatMap(() => describeAllIcons(session.requestBuilder()))
            .map(actualReply => expect(new Set(actualReply.toArray())).toEqual(new Set(testDataDescriptor)))
            .subscribe(boilerplateSubscribe(fail, done));
    });

});

const singleIconPath = allIconsPath + "/:name";
describe(singleIconPath, () => {

    const agent = manageTestResourcesBeforeAfter();

    it ("GET should describe the icon", done => {
        const testData = getTestIconData();

        const icon1: Icon = testData.get(0);
        const expectedReply: IconDTO = {
            name: icon1.name,
            paths: {
                french: {
                    great: getFilePath(icon1.name, {format: "french", size: "great"}),
                    large: getFilePath(icon1.name, {format: "french", size: "large"})
                },
                belge: {
                    large: getFilePath(icon1.name, {format: "belge", size: "large"})
                }
            }
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
