import { manageTestResourcesBeforeAndAfter, Session, uxAuth } from "./api-test-utils";
import { testIconInputData, addTestData, getIngestedTestIconDataDescription } from "./icon-api-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { describeIcon, describeAllIcons, getFilePath } from "./api-client";

import { flatMap, map } from "rxjs/operators";

const allIconsPath = "/icon";

describe(allIconsPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("GET should return the description of all icons in the repository", done => {
        const session: Session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
            .pipe(
                flatMap(() => describeAllIcons(session.requestBuilder())),
                map(actualReply => expect(new Set(actualReply.toArray()))
                                    .toEqual(new Set(getIngestedTestIconDataDescription())))
            )
            .subscribe(boilerplateSubscribe(fail, done));
    });

});

const singleIconPath = allIconsPath + "/:name";
describe(singleIconPath, () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it ("GET should describe the icon", done => {
        const session: Session = agent();
        addTestData(session.requestBuilder(), testIconInputData)
            .pipe(
                flatMap(() => describeIcon(session.requestBuilder(), getIngestedTestIconDataDescription()[0].name)),
                map(actualReply => expect(actualReply).toEqual(getIngestedTestIconDataDescription()[0]))
            )
            .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("GET should return 404 for non-existent icon", done => {
        const session: Session = agent();
        describeIcon(
            session
            .responseOK(resp => resp.status === 404)
            .auth(uxAuth).requestBuilder(), "/icon/somenonexistentname")
            .subscribe(boilerplateSubscribe(fail, done));
    });

});
