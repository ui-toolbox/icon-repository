import * as crypto from "crypto";

import gitAccessFunctionsProvider, {
    createGitCommandExecutor,
    GitAccessFunctions,
    GIT_COMMIT_FAIL_INTRUSIVE_TEST
} from "../../src/git";
import { CreateIconInfo } from "../../src/icon";
import { boilerplateSubscribe } from "../testUtils";
import { setEnvVar } from "../../src/configuration.spec";
import {
    createTestGitRepo,
    deleteTestGitRepo,
    getCurrentCommit,
    assertGitStatus,
    getTestRepoDir,
    assertAddedFile} from "./git-test-utils";

describe("git access functions", () => {

    let gitAFs: GitAccessFunctions;

    beforeAll(() => {
        gitAFs = gitAccessFunctionsProvider(getTestRepoDir());
    });

    beforeEach(done => {
        createTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });

    afterEach(done => {
        delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
        deleteTestGitRepo()
        .subscribe(boilerplateSubscribe(fail, done));
    });

    describe("should include addIconFile which", () => {
        it("should add an icon file", done => {
            const iconInfo: CreateIconInfo = {
                iconName: "pizza",
                format: "thin-crust",
                size: "32cm",
                content: crypto.randomBytes(1024)
            };
            const user = "zazie";
            gitAFs.addIconFile(iconInfo, user)
            .flatMap(() => getCurrentCommit())
            .map(sha1 => expect(sha1.length).toEqual("8e9b80b5155dea01e5175bc819bbe364dbc07a66".length))
            .flatMap(() => assertGitStatus())
            .flatMap(() => assertAddedFile(iconInfo, user))
            .subscribe(boilerplateSubscribe(fail, done));
        });

        it("should throw an error, but preserve the last consistent git repo state, " +
                "in case adding an icon file failse", done => {
            const statusMessageTail = "nothing to commit, working tree clean";
            const iconInfo: CreateIconInfo = {
                iconName: "pizza",
                format: "thin-crust",
                size: "32cm",
                content: crypto.randomBytes(1024)
            };
            const iconInfo1: CreateIconInfo = {
                iconName: "pizza1",
                format: "thin-crust1",
                size: "32cm1",
                content: crypto.randomBytes(1024)
            };
            const user = "zazie";
            gitAFs.addIconFile(iconInfo, user)
            .do(() => setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true"))
            .flatMap(() => getCurrentCommit())
            .flatMap(lastGoodSha1 => gitAFs.addIconFile(iconInfo1, user)
                .map(() => fail("Expected an error to make exection skip this part"))
                .catch(error => getCurrentCommit())
                .map(currentSha1 => expect(currentSha1).toEqual(lastGoodSha1)))
            .flatMap(() => assertGitStatus())
            .subscribe(boilerplateSubscribe(fail, done));
        });
    });
});
