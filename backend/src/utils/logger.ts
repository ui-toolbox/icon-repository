import * as winston from "winston";
import { Map } from "immutable";

export type LoggerFactory = (label: string) => winston.Logger;

let defaultLogLevel = "info";

// Keep track of the loggers by label, so they can be reconfigured, if necessary
let loggers: Map<string, winston.Logger> = Map();

const loggerFactory = (label: string) => {

    const cached = loggers.get(label);

    if (cached) {
        return cached;
    } else {
        const logger = winston.createLogger({
            level: defaultLogLevel,
            format: winston.format.combine(
                winston.format.splat(),
                winston.format.timestamp(),
                winston.format.label({label}),
                winston.format.printf(info => `${info.timestamp} ${info.level}: ${label}: ${info.message}`)
            ),
            transports: [ new winston.transports.Console() ]
        });
        loggers = loggers.set(label, logger);
        return logger;
    }
};

export const setDefaultLogLevel = (logLevel: string) => {
    defaultLogLevel = logLevel;
};

export const getDefaultLogLevel = () => defaultLogLevel;

export default loggerFactory;
