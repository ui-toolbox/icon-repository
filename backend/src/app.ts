import loggerFactory, { setDefaultLogLevel } from "./utils/logger";
import configurationProvider from "./configuration";
import serverProvider, { Server } from "./server";

import iconHandlersProvider from "./iconsHandlers";
import { Logger } from "winston";
import { flatMap, map } from "rxjs/operators";
import { FatalError } from "./general-errors";
import { createDefaultIconService } from "./app-assembly";

let logger: Logger;

const logServerStart = (server: Server) => {
    const host = server.address().address;
    const port = server.address().port;

    logger.log("info", "The CXN Icon Repository server is listening at http://%s:%s", host, port);
};

configurationProvider
.pipe(
    flatMap(configuration => {
        setDefaultLogLevel(configuration.logger_level);
        logger = loggerFactory("app");
        return createDefaultIconService(configuration)
        .pipe(
            flatMap(iconService => {
                const iconHandlers = iconHandlersProvider(iconService);
                return serverProvider(configuration, iconHandlers)
                .pipe(
                    map(logServerStart)
                );
            })
        );
    })
)
.subscribe(
    undefined,
    error => {
        if (error instanceof FatalError) {
            logger.error("Exiting on fatal error: %O", error);
            process.exit(-1);
        } else {
            logger.error(error);
        }
    },
    undefined
);
