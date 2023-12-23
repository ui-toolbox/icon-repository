import { createConnectionProperties } from "./db/db";
import gitRepositoryProvider from "./git";
import { type IconService, createIconService } from "./icons-service";
import iconRepositoryProvider from "./db/icon";
import { defaultSettings, type ConfigurationData } from "./configuration";

export const createDefaultIconService = async (configuration: ConfigurationData): Promise<IconService> => {
	const iconRepository = iconRepositoryProvider(createConnectionProperties(configuration));

	return await createIconService(
		iconRepository,
		await gitRepositoryProvider(configuration.icon_data_location_git ?? defaultSettings.icon_data_location_git)
	);
};
