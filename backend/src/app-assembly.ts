import { createConnectionProperties } from "./db/db";
import gitRepositoryProvider from "./git";
import { type IconService, createIconService } from "./icons-service";
import iconRepositoryProvider from "./db/icon";
import { type ConfigurationData } from "./configuration";

export const createDefaultIconService = async (configuration: ConfigurationData): Promise<IconService> => {
	const iconRepository = iconRepositoryProvider(createConnectionProperties(configuration));

	return await createIconService(
		{
			resetData: configuration.icon_data_create_new
		},
		iconRepository,
		await gitRepositoryProvider(configuration.icon_data_location_git)
	);
};
