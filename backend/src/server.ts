import * as http from "http";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as helmet from "helmet";
import * as multer from "multer";
import * as Rx from "rxjs";

import { IconHanlders } from "./iconsHandlers";

import { ConfigurationDataProvider } from "./configuration";
import securityManagerProvider from "./security/securityManager";
import brandingHandlerProvider from "./brandingHandler";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const serverProvider: (appConfig: ConfigurationDataProvider, iconHandlers: IconHanlders) => Rx.Observable<http.Server>
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
    router.get("/icons", iconHandlers.describeAllIcons("/icons"));
    router.post("/icons", upload.any(), iconHandlers.createIcon);
    router.get("/icons/:name", iconHandlers.describeIcon("/icons"));
    router.put("/icons/:name", iconHandlers.updateIcon);
    router.delete("/icons/:name", iconHandlers.deleteIcon);
    router.get("/icons/:name/formats/:format/sizes/:size", iconHandlers.getIconFile);
    router.post("/icons/:name/formats/:format/sizes/:size", upload.any(), iconHandlers.addIconFile);
    router.put("/icons/:name/formats/:format/sizes/:size", upload.any(), iconHandlers.updateIconFile);
    router.delete("/icons/:name/formats/:format/sizes/:size", iconHandlers.deleteIconFile);
    router.get("/branding", brandingHandlerProvider(appConfig().app_description));

    return Rx.Observable.create((observer: Rx.Observer<http.Server>) => {
        const server = app.listen(appConfig().server_port, appConfig().server_hostname, () => {
            observer.next(server);
            observer.complete();
        });
    });

};

export default serverProvider;
