import * as http from "http";

import loggerFactory, { setDefaultLogLevel } from "./utils/logger";
import configurationProvider from "./configuration";
import iconDAFsProvider, { createConnectionProperties } from "./db/db";
import gitAFsProvider from "./git";
import serverProvider from "./server";

import iconServiceProvider from "./iconsService";
import iconHandlersProvider from "./iconsHandlers";
import { Logger } from "winston";
import { flatMap, map } from "rxjs/operators";

let logger: Logger;

const logServerStart = (server: http.Server) => {
    const host = server.address().address;
    const port = server.address().port;

    logger.log("info", "The CXN Icon Repository server is listening at http://%s:%s", host, port);
};

configurationProvider
.pipe(
    flatMap(configuration => {
        setDefaultLogLevel(configuration.logger_level);
        logger = loggerFactory("app");

        return iconServiceProvider(
            {
                resetData: configuration.icon_data_create_new
            },
            iconDAFsProvider(createConnectionProperties(configuration)),
            gitAFsProvider(configuration.icon_data_location_git)
        )
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
    error => logger.error(error),
    undefined
);
