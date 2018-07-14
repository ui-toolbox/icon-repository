import { randomBytes } from "crypto";
import { manageTestResourcesBeforeAfter, Session, uxAuth } from "./api-test-utils";
import { setAuth, createIcon, deleteIcon } from "./api-client";
import { boilerplateSubscribe } from "../testUtils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";

describe("DEL icon", () => {

    const agent = manageTestResourcesBeforeAfter();

    it("should fail with 403 without proper privilege", done => {
        const session: Session = agent();
        const iconName = "cartouche";
        createIcon(
            session
                .auth(uxAuth)
                .requestBuilder(),
            iconName, "french", "big", randomBytes(4096))
        .flatMap(() => setAuth(session.requestBuilder(), []))
        .flatMap(() => deleteIcon(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 403)
                .requestBuilder(),
            iconName))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should fail with 403 with only REMOVE_ICON_FILE privilege", done => {
        const session: Session = agent();
        const iconName = "cartouche";
        createIcon(
            session
                .auth(uxAuth)
                .requestBuilder(),
            iconName, "french", "big", randomBytes(4096))
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON_FILE ]))
        .flatMap(() => deleteIcon(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 403)
                .requestBuilder(),
            iconName))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it("should should succeed with REMOVE_ICON privilege", done => {
        const session: Session = agent();
        const iconName = "cartouche";
        createIcon(
            session
                .auth(uxAuth)
                .requestBuilder(),
            iconName, "french", "big", randomBytes(4096))
        .flatMap(() => setAuth(session.requestBuilder(), [ privilegeDictionary.REMOVE_ICON ]))
        .flatMap(() => deleteIcon(
            session
                .auth(uxAuth)
                .responseOK(resp => resp.status === 200)
                .requestBuilder(),
            iconName))
        .subscribe(boilerplateSubscribe(fail, done));
    });

});
