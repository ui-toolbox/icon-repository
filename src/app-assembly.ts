import { createConnectionProperties } from "./db/db.js";
import gitRepositoryProvider from "./git.js";
import { type IconService, createIconService } from "./icons-service.js";
import iconRepositoryProvider from "./db/icon.js";
import { defaultSettings, type ConfigurationData } from "./configuration.js";

export const createDefaultIconService = async (configuration: ConfigurationData): Promise<IconService> => {
	const iconRepository = iconRepositoryProvider(createConnectionProperties(configuration));

	return await createIconService(
		iconRepository,
		await gitRepositoryProvider(configuration.icon_data_location_git ?? defaultSettings.icon_data_location_git)
	);
};
