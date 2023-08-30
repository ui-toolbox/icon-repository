import * as winston from "winston";
import { isNil } from "lodash";
import { format } from "util";

export type LoggerFactory = (label: string) => winston.Logger;
export type LogLevel = "error" | "warning" | "info" | "debug" | "trace" | "silly";

// Keep track of the loggers by label, so they can be reconfigured, if necessary
type Loggers = Record<string, winston.Logger>;
const loggers: Loggers = {};

export const getDefaultLogLevel = (): string => process.env.ICONREPO_DEFAULT_LOG_LEVEL ?? "info";

console.log(">>>>>>>>>>> default log-level", getDefaultLogLevel());

export const createLogger = (label: string): winston.Logger => {
	const cached = loggers[label];

	if (!isNil(cached)) {
		return cached;
	} else {
		const level = getDefaultLogLevel();
		console.log(format("creating logger '%s' with level '%s'", label, level));

		const logger = winston.createLogger({
			level,
			format: winston.format.combine(
				winston.format.splat(),
				winston.format.timestamp(),
				winston.format.label({ label }),
				winston.format.printf(info => `${info.timestamp} ${info.level}: ${label}: ${info.message}`)
			),
			transports: [new winston.transports.Console()]
		});
		loggers[label] = logger;
		return logger;
	}
};
