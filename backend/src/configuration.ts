import { format as strformat } from "util";
import * as fs from "fs";
import * as path from "path";
import * as Process from "process";

import loggerFactory from "./utils/logger";
import * as Rx from "rxjs";
import { fileExists, readTextFile } from "./utils/rx";
import clone from "./utils/clone";

const ICON_REPO_HOME = path.resolve(Process.env.HOME, ".ui-toolbox/icon-repo");

const configurationDataProto = Object.freeze({
    server_hostname: "",
    server_port: 0,
    server_url_context: "",
    app_description: "",
    path_to_static_files: "",
    icon_data_location_git: "",
    icon_data_create_new: "",
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
    conn_host: "",
    conn_port: "",
    conn_user: "",
    conn_password: "",
    conn_database: "",
    enable_backdoors: false,
    logger_level: "",
    package_root_dir: ""
});

export type ConfigurationData = typeof configurationDataProto;

const defaultSettings = Object.freeze({
    server_hostname: "localhost",
    server_port: 8090,
    server_url_context: "/",
    authentication_type: "oidc",
    app_description: "Collection of custom icons designed at Wombat Inc.",
    path_to_static_files: path.join(__dirname, "..", "..", "..", "client", "dist"),
    icon_data_location_git: path.resolve(ICON_REPO_HOME, "git-repo"),
    conn_host: "localhost",
    conn_port: "5432",
    conn_user: "iconrepo",
    conn_password: "iconrepo",
    conn_database: "iconrepo",
    icon_data_create_new: "never",
    enable_backdoors: false,
    package_root_dir: path.resolve(path.dirname(__filename))
});

let configurationData: ConfigurationData;

const getEnvVarValue = (proto: any, configPropName: string) => {
    const envVarValue = process.env[configPropName.toUpperCase()];
    return typeof (proto as any)[configPropName] === "object"
        ? JSON.parse(envVarValue)
        : envVarValue;
};

export const updateConfigurationDataWithEnvVarValues = <T> (proto: T, conf: T) =>
    Object.keys(proto).reduce(
        (acc: any, key: string) => process.env[key.toUpperCase()]
            ? Object.assign(acc, {[key]: getEnvVarValue(proto, key)})
            : acc,
        conf
    );

export const getDefaultConfiguration: () => ConfigurationData = () => Object.assign(
    clone(configurationDataProto),
    clone(defaultSettings)
);

const ctxLogger = loggerFactory("appConfig");

export const DEFAULT_CONFIG_FILE_PATH = path.join(ICON_REPO_HOME, "config.json");

const getConfigFilePathByProfile: (configProfile: string) => string = configProfile => {
    return path.resolve(__dirname, "..", "configurations", `${configProfile}.json`);
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

export const readConfiguration: <T> (filePath: string, proto: T, defaults: any) => Rx.Observable<T>
= (filePath, proto, defaults) => {
    return fileExists(filePath)
        .flatMap(exists => {
            if (exists) {
                ctxLogger.info(strformat("Updating configuration from %s...", configFilePath));
                return readTextFile(filePath)
                    .map(fileContent => JSON.parse(fileContent))
                    .catch(error => ignoreJSONSyntaxError(error));
            } else {
                ctxLogger.info(strformat("Configuration file doesn't exist: %s...", configFilePath));
                return Rx.Observable.of({});
            }
        })
        .map(json => Object.assign(clone(defaults), json))
        .do(conf => updateConfigurationDataWithEnvVarValues(proto, conf));
};

const updateState: () => Rx.Observable<ConfigurationData> = () => {
    return readConfiguration(configFilePath, configurationDataProto, defaultSettings)
        .do(conf => {
            configurationData = conf;
        })
        .map(() => Object.freeze(configurationData));
};

const watchConfigFile = (filePathToWatch: string) => {
    if (watcher != null) {
        watcher.close();
    }
    watcher = fs.watch(filePathToWatch, (event, filename) => {
        switch (event) {
            case "rename": // Editing with vim results in this event
                fileExists(filePathToWatch)
                .do(exists => {
                    ctxLogger.info(`Ooops! Configuration file was renamed: ${filePathToWatch}?`);
                })
                .filter(exists => exists)
                .do(b => updateState())
                .toPromise()
                    .then(
                        () => watchConfigFile(filePathToWatch),
                        err => ctxLogger.info(strformat("Configuration error: %o", err))
                    );
                break;
            case "change":
                updateState();
                break;
        }
    });
};

Rx.Observable
.forkJoin(Rx.Observable.of(configFilePath), fileExists(configFilePath))
.filter(value => value[1])
    .do(value => watchConfigFile(value[0]))
    .subscribe();

let watcher: fs.FSWatcher = null;

export default updateState();
