import { flatMap, map } from "rxjs/operators";
import { manageTestResourcesBeforeAndAfter, Session, uxAuth } from "./api-test-utils";
import { testIconInputData } from "./icon-api-test-utils";
import { createIcon, setAuth, addTag, describeIcon, RequestBuilder, getTags, removeTag } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { Set } from "immutable";

describe("POST /icon/:name/tag", () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("should fail without permision", done => {
        const testIcon = testIconInputData.get(0);
        const tag = "Ahoj";

        const session: Session = agent();
        const rb: RequestBuilder = session.requestBuilder();

        createIcon(rb, testIcon.name, testIcon.files.get(0).content)
        .pipe(
            flatMap(() => setAuth(rb, [])),
            flatMap(() => addTag(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 403)
                    .requestBuilder(),
                    testIcon.name, tag))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should pass with permision", done => {
        const testIcon = testIconInputData.get(0);
        const tag = "Ahoj";

        const session: Session = agent();
        const rb: RequestBuilder = session.requestBuilder();

        createIcon(rb, testIcon.name, testIcon.files.get(0).content)
        .pipe(
            flatMap(() => describeIcon(rb, testIcon.name)),
            map(iconDescriptor => expect(iconDescriptor.tags.length).toEqual(0)),
            flatMap(() => getTags(rb)),
            map(tags => expect(tags.size).toEqual(0)),
            flatMap(() => setAuth(rb, [ privilegeDictionary.ADD_TAG ])),
            flatMap(() => addTag(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 200)
                    .requestBuilder(),
                    testIcon.name, tag)),
            flatMap(() => describeIcon(rb, testIcon.name)),
            map(iconDescriptor => expect(iconDescriptor.tags).toEqual([tag])),
            flatMap(() => getTags(rb)),
            map(tags => expect(tags).toEqual(Set.of(tag)))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});

describe("DEL /icon/:name/tag/:tag", () => {

    const agent = manageTestResourcesBeforeAndAfter();

    it("should fail without permision", done => {
        const testIcon = testIconInputData.get(0);
        const tag = "Ahoj";

        const session: Session = agent();
        const rb: RequestBuilder = session.requestBuilder();

        createIcon(rb, testIcon.name, testIcon.files.get(0).content)
        .pipe(
            flatMap(() => addTag(rb, testIcon.name, tag)),
            flatMap(() => setAuth(rb, [])),
            flatMap(() => removeTag(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 403)
                    .requestBuilder(),
                    testIcon.name, tag))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should pass with permision", done => {
        const testIcon = testIconInputData.get(0);
        const tag = "Ahoj";

        const session: Session = agent();
        const rb: RequestBuilder = session.requestBuilder();

        createIcon(rb, testIcon.name, testIcon.files.get(0).content)
        .pipe(
            flatMap(() => addTag(rb, testIcon.name, tag)),
            flatMap(() => setAuth(rb, [ privilegeDictionary.REMOVE_TAG ])),
            flatMap(() => removeTag(
                session
                    .auth(uxAuth)
                    .responseOK(resp => resp.status === 200)
                    .requestBuilder(),
                    testIcon.name, tag)),
            map(remainingRefCount => expect(remainingRefCount).toEqual(0)),
            flatMap(() => describeIcon(rb, testIcon.name)),
            map(iconDescriptor => expect(iconDescriptor.tags.length).toEqual(0)),
            flatMap(() => getTags(rb)),
            map(tags => expect(tags.size).toEqual(0))
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
