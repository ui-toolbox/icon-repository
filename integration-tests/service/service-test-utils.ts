import { type ConfigurationData } from "../../src/configuration";
import { createTestConfiguration } from "../db/db-test-utils";

export const defaultTestServerconfig = Object.freeze({
	authentication_type: "basic",
	icon_data_create_new: "always"
});

export const createTestServerConfiguration = async (customConfig: ConfigurationData): Promise<ConfigurationData> => {
	const baseConfiguration = createTestConfiguration();
	return Object.freeze({
		...baseConfiguration,
		...defaultTestServerconfig,
		...customConfig,
		server_port: 0
	});
};
