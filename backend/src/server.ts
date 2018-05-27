import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import * as http from "http";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as helmet from "helmet";
import * as Rx from "rxjs";

import iconServiceProvider from "./iconsService";
import iconsHandlersProvider from "./iconsHandlers";

import { ConfigurationDataProvider } from "./configuration";
import logger from "./logger";
import securityManagerProvider from "./security/securityManager";
import brandingHandlerProvider from "./brandingHandler";

const serverProvider: (appConfig: ConfigurationDataProvider) => Rx.Observable<http.Server>
= appConfig => {

    const app = express();
    app.use(helmet());
    app.set("trust proxy", true);
    app.use(bodyParser.json());

    const securityManager = securityManagerProvider(appConfig);

    securityManager.setupSessionManagement(app);

    const router: express.Router = express.Router();

    securityManager.setupRoutes(router);

    app.use(appConfig().server_url_context, router);

    app.use(appConfig().server_url_context, express.static(appConfig().path_to_static_files));

    const iconService = iconServiceProvider(appConfig().icon_data_allowed_formats, appConfig().icon_data_location_git);
    const iconsHandlers = iconsHandlersProvider(iconService);
    router.get("/icons/formats", iconsHandlers.getIconFormats);
    router.get("/icons", iconsHandlers.getAllIcons);
    router.get("/icon/:path", iconsHandlers.getIcon);
    router.post("/icon", iconsHandlers.createIcon);
    router.post("/icon/:id/format/:format", iconsHandlers.addFormat);
    router.get("/branding", brandingHandlerProvider(appConfig().app_description));

    return Rx.Observable.create((observer: Rx.Observer<http.Server>) => {
        const server = app.listen(appConfig().server_port, appConfig().server_hostname, () => {
            observer.next(server);
            observer.complete();
        });
    });

};

export default serverProvider;
