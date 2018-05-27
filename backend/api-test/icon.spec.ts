
import { of } from "rxjs/Observable/of";
import "../src/security/privileges/priv-config";
import { testHTTPStatus, getURL, setAuthentication, startServerWithBackdoors } from "./api-test-utils";
import { privilegeDictionary } from "../src/security/privileges/priv-config";

const iconEndPoint = "/icon";
describe(iconEndPoint, () => {
    it ("POST should fail with 403 without CREATE_ICON privilege", done => {
        testHTTPStatus(iconEndPoint, "POST", {username: "zazie", privileges: []}, 403, fail, done);
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        testHTTPStatus(iconEndPoint, "POST", {username: "zazie", privileges}, 201, fail, done);
    });
});

const iconFormatsEndPoint = "/icon/:id/format/:format";
describe(iconFormatsEndPoint, () => {
    it ("POST should fail with 403 without either of CREATE_ICON or ADD_ICON_FORMAT privilege", done => {
        testHTTPStatus(iconFormatsEndPoint, "POST", {username: "zazie", privileges: []}, 403, fail, done);
    });

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        testHTTPStatus(iconFormatsEndPoint, "POST", {username: "zazie", privileges}, 201, fail, done);
    });

    it ("POST should complete with ADD_ICON_FORMAT privilege", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FORMAT
        ];
        testHTTPStatus(iconFormatsEndPoint, "POST", {username: "zazie", privileges}, 201, fail, done);
    });
});
