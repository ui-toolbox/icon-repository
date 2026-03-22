import updateConfiguration from "./configuration.js";
import { type Server, createServer } from "./server.js";

import iconHandlersProvider from "./icons-handlers.js";
import { type Logger } from "winston";
import { FatalError } from "./general-errors.js";
import { createDefaultIconService } from "./app-assembly.js";
import { isNil } from "lodash";
import { createLogger } from "./utils/logger.js";

let logger: Logger;

const logServerStart = (server: Server): void => {
	const host = server.address().address;
	const port = server.address().port;

	logger.log("info", "The CXN Icon Repository server is listening at http://%s:%s", host, port);
};

updateConfiguration
	.then(
		configuration => {
			if (isNil(configuration)) {
				throw Error("Configuration must not be null");
			}
			logger = createLogger("app");
			createDefaultIconService(configuration)
				.then(
					async iconService => {
						const iconHandlers = iconHandlersProvider(iconService);
						return await createServer(configuration, iconHandlers);
					}
				)
				.then(
					logServerStart
				)
				.catch(error => {
					throw error;
				});
		}
	).catch(error => {
		if (error instanceof FatalError) {
			logger.error("Exiting on fatal error: %O", error);
			process.exit(-1);
		} else {
			logger.error(error);
		}
	});
