import * as fs from "fs";
import * as path from "path";
import * as Process from "process";

import logger from "./logger";
import * as Rx from "rxjs";
import * as appUtil from "./util";

interface IServerConfiguration {
    hostname: string;
    port: number;
    context?: string;
}

const configurationDataProto = Object.freeze({
    server_hostname: "",
    server_port: 0,
    server_url_context: "",
    app_description: "",
    path_to_static_files: "",
    icon_data_location_git: "",
    icon_data_allowed_formats: "",
    authentication_type: "",
    oidc_client_id: "",
    oidc_client_secret: "",
    oidc_access_token_url: "",
    oidc_user_authorization_url: "",
    oidc_client_redirect_back_url: "",
    oidc_token_issuer: "",
    oidc_ip_jwt_public_key_url: "",
    oidc_ip_jwt_public_key_pem_base64: "",
    oidc_ip_logout_url: "",
    users_by_roles: {none: [""]},
    enable_backdoors: false,
    logger_level: ""
});

type IConfigurationData = typeof configurationDataProto;

const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

const defaultSettings = {
    server_hostname: "localhost",
    server_port: 8090,
    server_url_context: "/",
    app_description: "Collection of custom icons designed at Wombat Inc.",
    path_to_static_files: path.join(__dirname, "..", "..", "..", "client", "dist"),
    icon_data_allowed_formats: "svg, 1x, 2x, 3x",
    enable_backdoors: false
};

export const getDefaultConfiguration = () => Object.assign(
    clone(configurationDataProto),
    clone(defaultSettings)
);

const ctxLogger = logger.createChild("appConfig");

export const DEFAULT_CONFIG_FILE_PATH = path.resolve(Process.env.HOME, ".ui-toolbox/icon-repo/config.json");

const getConfigFilePathByProfile: (configProfile: string) => string = configProfile => {
    return path.join(__dirname, "configurations", `${configProfile}.json`);
};

export const getConfigFilePath: () => string = () => {
    let result = null;
    if (process.env.ICON_REPO_CONFIG_FILE) {
        result = process.env.ICON_REPO_CONFIG_FILE;
    } else if (process.env.ICON_REPO_CONFIG_PROFILE) {
        result = getConfigFilePathByProfile(process.env.ICON_REPO_CONFIG_PROFILE);
    } else {
        result = DEFAULT_CONFIG_FILE_PATH;
    }
    ctxLogger.info("Configuration file: " + result);
    return result;
};

const configFilePath: string = getConfigFilePath();

const ignoreJSONSyntaxError: (error: any) => Rx.Observable<any> = error => {
    if (error instanceof SyntaxError) {
        ctxLogger.error("Skipping syntax error...");
        return Rx.Observable.of({});
    } else {
        throw error;
    }
};

export const updateConfigurationDataWithEnvVarValues = <T> (proto: T, conf: T) =>
    Object.keys(proto).reduce(
        (acc: any, key: string) => process.env[key.toUpperCase()]
            ? Object.assign(acc, {[key]: process.env[key.toUpperCase()]})
            : acc,
        conf
    );

export const readConfiguration: <T> (filePath: string, proto: T, defaults: any) => Rx.Observable<T>
= (filePath, proto, defaults) => {
    return appUtil.fileExists(filePath)
        .flatMap(exists => exists
            ? appUtil.readTextFile(filePath)
                .map(fileContent => JSON.parse(fileContent))
                .catch(error => ignoreJSONSyntaxError(error))
            : Rx.Observable.of({}))
        .map(json => Object.assign(clone(defaults), json))
        .do(conf => updateConfigurationDataWithEnvVarValues(proto, conf));
};

let configurationData: IConfigurationData;

export type ConfigurationDataProvider = () => IConfigurationData;

const updateState: () => Rx.Observable<ConfigurationDataProvider> = () => {
    return readConfiguration(configFilePath, configurationDataProto, defaultSettings)
        .do(conf => {
            logger.info(" Updating configuration from %s...", configFilePath);
            if (conf.logger_level) {
                logger.setLevel(conf.logger_level);
            }
            configurationData = conf;
        })
        .map(conf => () => configurationData);
};

const watchConfigFile = (filePathToWatch: string) => {
    if (watcher != null) {
        watcher.close();
    }
    watcher = fs.watch(filePathToWatch, (event, filename) => {
        switch (event) {
            case "rename": // Editing with vim results in this event
                appUtil.fileExists(filePathToWatch)
                .do(exists => {
                    logger.warn(
                        "Ooops! Configuration file was renamed?",
                        filePathToWatch
                    );
                })
                .filter(exists => exists)
                .do(b => updateState())
                .toPromise()
                    .then(
                        r => watchConfigFile(filePathToWatch),
                        err => ctxLogger.error("Configuration error", err)
                    );
                break;
            case "change":
                updateState();
                break;
        }
    });
};

Rx.Observable
    .forkJoin(Rx.Observable.of(configFilePath), appUtil.fileExists(configFilePath))
    .filter(value => value[1])
        .do(value => watchConfigFile(value[0]))
        .subscribe();

let watcher: fs.FSWatcher = null;

export default updateState();
