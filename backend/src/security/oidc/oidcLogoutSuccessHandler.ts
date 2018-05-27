import * as url from "url";
import { Request, Response } from "express";
import { ConfigurationDataProvider } from "../../configuration";
import logger from "../../utils/logger";

const log = logger.createChild("oidcLogout");

const getForwardedPort: (req: Request) => number = req => {
    const fwPortHeader = req.headers["X-Forwarded-Port"];
    if (fwPortHeader) {
        return parseInt(fwPortHeader as string, 10);
    }
};

export default (logoutURL: string, serverContextPath: string) => (req: Request, res: Response) => {
    if (logoutURL) {
        const fqdn = {
            protocol: req.protocol,
            hostname: req.hostname,
            port: getForwardedPort(req)
        };
        const serviceURL = new url.URL(url.format(fqdn));
        serviceURL.pathname = serverContextPath;
        const redirectBackAfterLogin = url.format(serviceURL);
        log.debug("Request redirect back to ", redirectBackAfterLogin);
        res.redirect(logoutURL + "?service=" + redirectBackAfterLogin);
    } else {
        res.end(200);
    }
};
