import * as http from "http";

import logger from "./utils/logger";
import configuration from "./configuration";
import iconDAFsProvider, { createConnectionProperties } from "./db/db";
import gitAFsProvider from "./git";
import serverProvider from "./server";

import iconServiceProvider from "./iconsService";
import iconHandlersProvider from "./iconsHandlers";

const logServerStart = (server: http.Server) => {
    const host = server.address().address;
    const port = server.address().port;

    logger.log("info", "The CXN Icon Repository server is listening at http://%s:%s", host, port);
};

configuration.subscribe(
    configProvider => {
        const iconService = iconServiceProvider(
            {
                allowedFormats: configProvider().icon_data_allowed_formats,
                allowedSizes: configProvider().icon_data_allowed_sizes
            },
            iconDAFsProvider(createConnectionProperties(configProvider())),
            gitAFsProvider(configProvider().icon_data_location_git)
        );
        const iconHandlers = iconHandlersProvider(iconService);
        serverProvider(configProvider, iconHandlers).subscribe(logServerStart);
    },
    error => logger.error(error)
);
