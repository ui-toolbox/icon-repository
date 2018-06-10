import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import * as http from "http";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as helmet from "helmet";
import * as multer from "multer";
import * as Rx from "rxjs";

import { IIconHanlders } from "./iconsHandlers";

import { ConfigurationDataProvider } from "./configuration";
import logger from "./utils/logger";
import securityManagerProvider from "./security/securityManager";
import iconHandlersProvider from "./iconsHandlers";
import brandingHandlerProvider from "./brandingHandler";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const serverProvider: (appConfig: ConfigurationDataProvider, iconHandlers: IIconHanlders) => Rx.Observable<http.Server>
= (appConfig, iconHandlers) => {

    const app = express();
    app.use(helmet());
    app.set("trust proxy", true);
    app.use(bodyParser.json());

    const securityManager = securityManagerProvider(appConfig);
    securityManager.setupSessionManagement(app);

    const router: express.Router = express.Router();
    app.use(appConfig().server_url_context, router);

    securityManager.setupRoutes(router);

    app.use(appConfig().server_url_context, express.static(appConfig().path_to_static_files));

    router.get("/icons/config", iconHandlers.getIconRepoConfig);
    router.get("/icons", iconHandlers.icons);
    router.get("/icon/:path", iconHandlers.getIcon);
    router.post("/icon", upload.any(), iconHandlers.createIcon);
    router.post("/icon/:id/format/:format/size/:size", upload.any(), iconHandlers.addIconFile);
    router.get("/icon/:id/format/:format/size/:size", iconHandlers.getIconFile);
    router.get("/branding", brandingHandlerProvider(appConfig().app_description));

    return Rx.Observable.create((observer: Rx.Observer<http.Server>) => {
        const server = app.listen(appConfig().server_port, appConfig().server_hostname, () => {
            observer.next(server);
            observer.complete();
        });
    });

};

export default serverProvider;
