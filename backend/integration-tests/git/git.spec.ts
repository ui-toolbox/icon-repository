import * as crypto from "crypto";
import { flatMap, map, tap, catchError } from "rxjs/operators";

import gitRepositoryProvider, {
    GitRepository,
    GIT_COMMIT_FAIL_INTRUSIVE_TEST
} from "../../src/git";
import { Iconfile } from "../../src/icon";
import { boilerplateSubscribe } from "../testUtils";
import { setEnvVar } from "../../src/configuration.spec";
import {
    createTestGitRepo,
    deleteTestGitRepo,
    getCurrentCommit,
    assertGitCleanStatus,
    getTestRepoDir,
    assertFileInRepo} from "./git-test-utils";

describe("git access functions", () => {

    let gitRepository: GitRepository;

    beforeAll(() => {
        gitRepository = gitRepositoryProvider(getTestRepoDir());
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

    describe("should include addIconfile which", () => {
        it("should add an icon file", done => {
            const iconInfo: Iconfile = {
                name: "pizza",
                format: "thin-crust",
                size: "32cm",
                content: crypto.randomBytes(1024)
            };
            const user = "zazie";
            gitRepository.addIconfile(iconInfo, user)
            .pipe(
                flatMap(() => getCurrentCommit()),
                map(sha1 => expect(sha1.length).toEqual("8e9b80b5155dea01e5175bc819bbe364dbc07a66".length)),
                flatMap(() => assertGitCleanStatus()),
                flatMap(() => assertFileInRepo(iconInfo))
            )
            .subscribe(boilerplateSubscribe(fail, done));
        });

        it("should throw an error, but preserve the last consistent git repo state, " +
                "in case adding an icon file failse", done => {
            const iconInfo: Iconfile = {
                name: "pizza",
                format: "thin-crust",
                size: "32cm",
                content: crypto.randomBytes(1024)
            };
            const iconInfo1: Iconfile = {
                name: "pizza1",
                format: "thin-crust1",
                size: "32cm1",
                content: crypto.randomBytes(1024)
            };
            const user = "zazie";
            gitRepository.addIconfile(iconInfo, user)
            .pipe(
                tap(() => setEnvVar(GIT_COMMIT_FAIL_INTRUSIVE_TEST, "true")),
                flatMap(() => getCurrentCommit()),
                flatMap(lastGoodSha1 => gitRepository.addIconfile(iconInfo1, user)
                    .pipe(
                        map(() => fail("Expected an error to make exection skip this part")),
                        catchError(error => getCurrentCommit()),
                        map(currentSha1 => expect(currentSha1).toEqual(lastGoodSha1))
                    )),
                flatMap(() => assertGitCleanStatus())
            )
            .subscribe(boilerplateSubscribe(fail, done));
        });
    });
});
