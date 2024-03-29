import express from "express";
import helmet from "helmet";
import multer from "multer";

import { type IconHanlders } from "./icons-handlers";

import { defaultSettings, type ConfigurationData } from "./configuration";
import { setupSecurity } from "./security/security-manager";
import getAppInfoHandlerProvider, { getClientConfigHandlerProvider } from "./app-info-handler";
import { type AddressInfo } from "net";
import { createLogger } from "./utils/logger";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export interface Server {
	readonly address: () => { address: string, port: number }
	readonly shutdown: () => Promise<void>
}

export const createServer = async (
	appConfig: ConfigurationData,
	iconHandlersProvider: (iconPathRoot: string) => IconHanlders
): Promise<Server> => {
	const logger = createLogger("server");
	const app = express();
	app.use(helmet());
	app.set("trust proxy", true);
	app.use(express.json());

	const securityManager = setupSecurity(appConfig);
	securityManager.setupSessionManagement(app);

	const router: express.Router = express.Router();
	app.use(router);

	router.get("/app-info", getAppInfoHandlerProvider(
		appConfig.app_description ?? "Icon repository",
		appConfig.package_root_dir ?? defaultSettings.package_root_dir
	));

	await securityManager.setupRoutes(router);

	const iconHandlers = iconHandlersProvider("/icon");

	router.get("/icon/:name/format/:format/size/:size", iconHandlers.getIconfile);
	router.delete("/icon/:name/format/:format/size/:size", iconHandlers.deleteIconfile);
	router.get("/tag", iconHandlers.getTags);
	router.post("/icon/:name/tag", iconHandlers.addTag);
	router.delete("/icon/:name/tag/:tag", iconHandlers.removeTag);
	router.get("/icon", iconHandlers.describeAllIcons);
	router.post("/icon", upload.single("iconfile"), iconHandlers.createIcon);
	router.get("/icon/:name", iconHandlers.describeIcon);
	router.post("/icon/:name", upload.single("iconfile"), iconHandlers.ingestIconfile);
	router.patch("/icon/:name", iconHandlers.updateIcon);
	router.delete("/icon/:name", iconHandlers.deleteIcon);
	router.get("/config", getClientConfigHandlerProvider(appConfig.oidc_ip_logout_url));

	return await new Promise(resolve => {
		const httpServer = app.listen(
			appConfig.server_port ?? defaultSettings.server_port,
			appConfig.server_host ?? defaultSettings.server_host,
			() => {
				const addressInfo = httpServer.address() as AddressInfo;
				logger.error("server is listenening at %o", addressInfo);
				resolve({
					address: () => addressInfo,
					shutdown: async () => {
						await new Promise<void>((resolve, reject) => {
							iconHandlers.release().then()
								.catch(error => {
									logger.error("#shutdown: failed to release iconHanders: %o", error);
								})
								.finally(() => {
									httpServer.close(error => {
										reject(error);
									});
									resolve();
								});
						});
					}
				});
			}
		);
	});
};
