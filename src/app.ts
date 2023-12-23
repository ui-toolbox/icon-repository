import updateConfiguration from "./configuration";
import { type Server, createServer } from "./server";

import iconHandlersProvider from "./icons-handlers";
import { type Logger } from "winston";
import { FatalError } from "./general-errors";
import { createDefaultIconService } from "./app-assembly";
import { isNil } from "lodash";
import { createLogger } from "./utils/logger";

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
