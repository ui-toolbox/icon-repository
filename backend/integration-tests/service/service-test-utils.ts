import configurationProvider, { type ConfigurationData } from "../../src/configuration";

export const defaultTestServerconfig = Object.freeze({
	authentication_type: "basic",
	icon_data_create_new: "always"
});

export type CreateTestConfiguration = (customConfig: ConfigurationData) => Promise<ConfigurationData>;
export const createTestConfiguration: CreateTestConfiguration = async customConfig => {
	const configuration = await configurationProvider;
	return Object.freeze({
		...configuration,
		...defaultTestServerconfig,
		...customConfig,
		server_port: 0
	});
};
