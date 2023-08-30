import { type Handler } from "express";
import * as path from "path";
import { createLogger } from "./utils/logger";
import { readFile } from "fs/promises";

interface VersionInfo {
	version: string
	commit: string
}

interface AppInfo {
	versionInfo: VersionInfo
	appDescription: string
}

const getAppInfoHandlerProvider = (appDescription: string, packageRootDir: string): Handler => async (_, res) => {
	const logCtx = createLogger("app-info");
	try {
		const versionJSON = await readFile(path.resolve(packageRootDir, "version.json"), "utf8");
		const versionInfo: VersionInfo = JSON.parse(versionJSON);
		const appInfo: AppInfo = {
			versionInfo,
			appDescription
		};
		res.send(appInfo);
	} catch (error) {
		logCtx.error(error);
		res.status(500).send({ error: "Failed to retreive " }).end();
	}
};

export const getClientConfigHandlerProvider = (idpLogoutUrl = null): Handler => async (_, res) => {
	const clientConfig = {
		idpLogoutUrl
	};

	res.send(clientConfig);
};

export default getAppInfoHandlerProvider;
