import { manageTestResourcesBeforeAndAfter } from "./api-test-utils";

const iconRepoConfigPath = "/icons/config";

describe(iconRepoConfigPath, () => {
    const agent = manageTestResourcesBeforeAndAfter();

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
