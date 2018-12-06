import { createConnectionProperties } from "./db/db";
import gitRepositoryProvider from "./git";
import iconServiceProvider, { IconService } from "./iconsService";
import { Observable } from "rxjs";
import iconRepositoryProvider from "./db/icon";
import { ConfigurationData } from "./configuration";

export const createDefaultIconService: (configuration: ConfigurationData) => Observable<IconService>
= configuration => iconServiceProvider(
    {
        resetData: configuration.icon_data_create_new
    },
    iconRepositoryProvider(createConnectionProperties(configuration)),
    gitRepositoryProvider(configuration.icon_data_location_git)
);
