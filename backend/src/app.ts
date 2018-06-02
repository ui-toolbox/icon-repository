import * as http from "http";

import logger from "./logger";
import configuration from "./configuration";
import serverProvider from "./server";

const logServerStart = (server: http.Server) => {
    const host = server.address().address;
    const port = server.address().port;

    logger.log("info", "The CXN Icon Repository server is listening at http://%s:%s", host, port);
};

configuration.subscribe(
    configProvider => serverProvider(configProvider).subscribe(logServerStart),
    error => logger.error(error)
);
