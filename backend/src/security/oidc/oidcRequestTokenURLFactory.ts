import { URL, URLSearchParams } from "url";
import randomstring from "../../utils/randomstring";

export default (userAuthorizationURL: string, clientID: string, redirectURL: string) => {
    const state = randomstring();

    const authrznUrl: URL =  new URL(userAuthorizationURL);
    authrznUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: clientID,
        redirect_uri: redirectURL,
        state
    }).toString();
    return authrznUrl;
};
