import * as util from "util";
import * as winston from "winston";

const tsFormat = () => new Date().toISOString();
const baseLogger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            timestamp: tsFormat,
            colorize: false
        })
    ]
});

const createChild: (context: string) => ContextAbleLogger = context => {
    return new ContextAbleLogger(context);
};

type CreateChildContext = (context: string) => winston.LoggerInstance;

const contextPrefix = (context: string) => context ? context + ": " : "";

export class ContextAbleLogger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    public log(level: string, msg: string, ...meta: any[]) {
        (this as any)[level](util.format(meta));
    }

    public error(msg: string, ...meta: any[]) {
        baseLogger.error(util.format(contextPrefix(this.context) + msg, ...meta));
    }

    public warn(msg: string, ...meta: any[]) {
        baseLogger.warn(util.format(contextPrefix(this.context) + msg, ...meta));
    }

    public info(msg: string, ...meta: any[]) {
        baseLogger.info(util.format(contextPrefix(this.context) + msg, ...meta));
    }

    public debug(msg: string, ...meta: any[]) {
        baseLogger.debug(util.format(contextPrefix(this.context) + msg, ...meta));
    }

    public verbose(msg: string, ...meta: any[]) {
        baseLogger.verbose(util.format(contextPrefix(this.context) + msg, ...meta));
    }

    public silly(msg: string, ...meta: any[]) {
        baseLogger.silly(util.format(contextPrefix(this.context) + msg, ...meta));
    }

    public isLevelEnabled(level: string) {
        // @ts-ignore
        return baseLogger.levels[level] >= baseLogger.level;
    }

    public setLevel(level: string) {
        baseLogger.level = level;
    }

    public createChild(context: string): ContextAbleLogger {
        return createChild(context);
    }
}

export default createChild("");
