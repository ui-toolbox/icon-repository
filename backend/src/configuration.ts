import { format as strformat } from "util";
import * as fs from "fs";
import * as path from "path";
import * as Process from "process";

import loggerFactory from "./utils/logger";
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

export const readConfiguration = async <T> (filePath: string, proto: T, defaults: any): Promise<T> => {
    const configFileExists = await fileExists(filePath);
    if (configFileExists) {
        ctxLogger.info(strformat("Updating configuration from %s...", configFilePath));
        const fileContent = await readTextFile(filePath);
        try {
            const json = JSON.parse(fileContent)
            const conf = Object.assign(clone(defaults), json);
            return updateConfigurationDataWithEnvVarValues(proto, conf);
        } catch (err) {
            if (err instanceof SyntaxError) {
                ;
            } else {
                throw err;
            }
        }
    } else {
        ctxLogger.info(strformat("Configuration file doesn't exist: %s...", configFilePath));
    }
};

const updateState = async (): Promise<ConfigurationData> => {
    const config = await readConfiguration(configFilePath, configurationDataProto, defaultSettings);
    return Object.freeze(config);
}

let watcher: fs.FSWatcher = null;

const watchConfigFile = (filePathToWatch: string) => {
    if (watcher != null) {
        watcher.close();
    }
    watcher = fs.watch(filePathToWatch, (event, filename) => {
        switch (event) {
            case "rename": // Editing with vim results in this event
                fileExists(filePathToWatch)
                .pipe(
                    tap(exists => {
                        ctxLogger.info(`Ooops! Configuration file was renamed: ${filePathToWatch}?`);
                    }),
                    filter(exists => exists),
                    tap(b => updateState())
                )
                .subscribe(
                    () => watchConfigFile(filePathToWatch),
                    err => ctxLogger.info(strformat("Configuration error: %o", err)),
                    void 0
                );
                break;
            case "change":
                updateState();
                break;
        }
    });
};

if (process.env.IGNORE_CONFIG_FILE_CHANGE !== "true") {
    Rx.forkJoin(Rx.of(configFilePath), fileExists(configFilePath))
    .pipe(
        filter(value => value[1]),
        tap(value => watchConfigFile(value[0]))
    )
    .subscribe();
} else {
    ctxLogger.info("Ignoring changes in configuration file");
}

export default updateState();
