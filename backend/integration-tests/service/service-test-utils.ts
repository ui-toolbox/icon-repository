import configurationProvider, { type ConfigurationData } from "../../src/configuration";

export const defaultTestServerconfig = Object.freeze({
	authentication_type: "basic",
	icon_data_create_new: true
});

export const createTestConfiguration = async (customConfig: ConfigurationData): Promise<ConfigurationData> => {
	const configuration = await configurationProvider;
	return Object.freeze({
		...configuration,
		...defaultTestServerconfig,
		...customConfig,
		server_port: 0
	});
};
