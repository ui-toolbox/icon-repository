import { format as strformat } from "node:util";
import * as path from "node:path";

import { createLogger } from "./utils/logger";
import clone from "./utils/clone";
import { isNil } from "lodash";
import { access, readFile } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";

const fileExists = async (filePath: string): Promise<boolean> => {
	try {
		await access(filePath);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") {
			return false;
		}
		throw error;
	}
};

if (isNil(process.env.HOME) || process.env.HOME === "") {
	throw new Error("process.env.HOME isn't defined");
}

const ICONREPO_HOME = path.resolve(process.env.HOME, ".ui-toolbox/iconrepo");

const configurationDataProto = {
	server_hostname: "",
	server_port: 0,
	server_url_context: "",
	app_description: "",
	path_to_static_files: "",
	icon_data_location_git: "",
	icon_data_create_new: false,
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
	conn_host: "",
	conn_port: "",
	conn_user: "",
	conn_password: "",
	conn_database: "",
	enable_backdoors: false,
	package_root_dir: ""
};

export type ConfigurationData = Readonly<
	typeof configurationDataProto &
{ users_by_roles: Record<string, string[]> }
>;

const defaultSettings = Object.freeze({
	server_hostname: "localhost",
	server_port: 8090,
	server_url_context: "/",
	authentication_type: "oidc",
	app_description: "Collection of custom icons designed at Wombat Inc.",
	path_to_static_files: path.join(__dirname, "..", "..", "..", "client", "dist"),
	icon_data_location_git: path.resolve(ICONREPO_HOME, "git-repo"),
	conn_host: "localhost",
	conn_port: "5432",
	conn_user: "iconrepo",
	conn_password: "iconrepo",
	conn_database: "iconrepo",
	icon_data_create_new: false,
	enable_backdoors: false,
	package_root_dir: path.resolve(path.dirname(__filename))
});

const getEnvVarValue = (proto: any, configPropName: string): string | Record<string, any> => {
	const envVarValue = process.env[configPropName.toUpperCase()];
	return isNil(envVarValue)
		? ""
		: typeof (proto)[configPropName] === "object"
			? JSON.parse(envVarValue)
			: envVarValue;
};

export const updateConfigurationDataWithEnvVarValues = <T extends Record<string, any>> (proto: T, conf: T): T =>
	Object.keys(proto).reduce(
		(acc: any, key: string) => !isNil(process.env[key.toUpperCase()])
			? Object.assign(acc, { [key]: getEnvVarValue(proto, key) })
			: acc,
		conf
	);

export const getDefaultConfiguration: () => ConfigurationData = () => Object.assign(
	updateConfigurationDataWithEnvVarValues(configurationDataProto as ConfigurationData, clone(defaultSettings) as ConfigurationData)
);

const logger = createLogger("appConfig");

export const DEFAULT_CONFIG_FILE_PATH = path.join(ICONREPO_HOME, "config.json");

const getConfigFilePathByProfile: (configProfile: string) => string = configProfile => {
	return path.resolve(__dirname, "..", "configurations", `${configProfile}.json`);
};

export const getConfigFilePath: () => string = () => {
	let result = null;
	if (!isNil(process.env.ICONREPO_CONFIG_FILE)) {
		result = process.env.ICONREPO_CONFIG_FILE;
	} else if (!isNil(process.env.ICON_REPO_CONFIG_PROFILE)) {
		result = getConfigFilePathByProfile(process.env.ICON_REPO_CONFIG_PROFILE);
	} else {
		result = DEFAULT_CONFIG_FILE_PATH;
	}
	logger.info("Configuration file: " + result);
	return result;
};

const configFilePath: string = getConfigFilePath();

const ignoreJSONSyntaxError = async (error: any): Promise<any> => {
	if (error instanceof SyntaxError) {
		logger.error("Skipping syntax error...");
		return {};
	} else {
		throw error;
	}
};

export const readConfiguration = async (filePath: string, proto: ConfigurationData, defaults: any): Promise<ConfigurationData | null> => {
	const exists = await fileExists(filePath);
	if (exists) {
		logger.info(strformat("Updating configuration from %s...", configFilePath));
		const fileContent = await readFile(filePath, "utf-8");
		let contentAsJSON;
		try {
			contentAsJSON = JSON.parse(fileContent);
		} catch (error) {
			await ignoreJSONSyntaxError(error);
		}
		const conf = Object.assign(clone(defaults), contentAsJSON);
		return updateConfigurationDataWithEnvVarValues(proto, conf);
	} else {
		logger.info(strformat("Configuration file doesn't exist: %s...", configFilePath));
		return null;
	}
};

const updateState = async (): Promise<ConfigurationData | null> => {
	const conf = await readConfiguration(configFilePath, configurationDataProto as ConfigurationData, defaultSettings);
	return conf === null ? null : Object.freeze(conf);
};

let watcher: FSWatcher | null = null;

const watchHandler = (filePathToWatch: string) => async (event: "rename" | "change"): Promise<void> => {
	switch (event) {
		case "rename": // Editing with vim results in this event
			logger.info(`Ooops! Configuration file was renamed: ${filePathToWatch}?`);
			try {
				const exists = await fileExists(filePathToWatch);
				if (exists) {
					await updateState();
					watchConfigFile(filePathToWatch);
				}
			} catch (error) {
				logger.info(strformat("Configuration error: %o", error));
			}
			break;
		case "change":
			await updateState();
			break;
	}
};

const watchConfigFile = (filePathToWatch: string): void => {
	if (watcher !== null) {
		watcher.close();
	}
	watcher = watch(filePathToWatch, watchHandler);
};

if (process.env.IGNORE_CONFIG_FILE_CHANGE !== "true") {
	fileExists(configFilePath)
		.then(
			exists => {
				if (exists) {
					watchConfigFile(configFilePath);
				}
			}
		)
		.catch(error => {
			logger.error("failed to watch config file %s: %o", configFilePath, error);
		});
} else {
	logger.info("Ignoring changes in configuration file");
}

export default updateState();
