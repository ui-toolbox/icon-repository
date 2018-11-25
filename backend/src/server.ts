import * as express from "express";
import * as bodyParser from "body-parser";
import * as helmet from "helmet";
import * as multer from "multer";

import { IconHanlders } from "./iconsHandlers";

import { ConfigurationData } from "./configuration";
import securityManagerProvider from "./security/securityManager";
import appInfoHandlerProvider from "./appInfoHandler";
import { Observable, Observer } from "rxjs";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export interface Server {
    readonly address: () => { address: string, port: number };
    readonly shutdown: () => void;
}

const serverProvider: (
    appConfig: ConfigurationData,
    iconHandlers: (iconPathRoot: string) => IconHanlders
) => Observable<Server>
= (appConfig, iconHandlersProvider) => {

    const app = express();
    app.use(helmet());
    app.set("trust proxy", true);
    app.use(bodyParser.json());

    const securityManager = securityManagerProvider(appConfig);
    securityManager.setupSessionManagement(app);

    const router: express.Router = express.Router();
    app.use(appConfig.server_url_context, router);

    securityManager.setupRoutes(router);

    app.use(appConfig.server_url_context, express.static(appConfig.path_to_static_files));

    const iconHandlers = iconHandlersProvider("/icon");

    router.get("/icon", iconHandlers.describeAllIcons);
    router.post("/icon", upload.any(), iconHandlers.createIcon);
    router.get("/icon/:name", iconHandlers.describeIcon);
    router.post("/icon/:name", upload.any(), iconHandlers.ingestIconfile);
    router.patch("/icon/:name", iconHandlers.updateIcon);
    router.delete("/icon/:name", iconHandlers.deleteIcon);
    router.get("/icon/:name/format/:format/size/:size", iconHandlers.getIconfile);
    router.delete("/icon/:name/format/:format/size/:size", iconHandlers.deleteIconfile);
    router.post("/icon/:name/tag", iconHandlers.addTag);
    router.get("/app-info", appInfoHandlerProvider(
        appConfig.app_description,
        appConfig.package_root_dir));

    return Observable.create((observer: Observer<Server>) => {
        const httpServer = app.listen(appConfig.server_port, appConfig.server_hostname, () => {
            observer.next({
                address: () => httpServer.address(),
                shutdown: () => {
                    iconHandlers.release();
                    httpServer.close();
                }
            });
            observer.complete();
        });
    });

};

export default serverProvider;
