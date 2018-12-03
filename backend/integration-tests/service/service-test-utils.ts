import { map, last } from "rxjs/operators";
import configurationProvider, { ConfigurationData } from "../../src/configuration";
import { Observable } from "rxjs";

export const defaultTestServerconfig = Object.freeze({
    authentication_type: "basic",
    icon_data_create_new: "always"
});

export type CreateTestConfiguration = (customConfig: any) => Observable<ConfigurationData>;
export const createTestConfiguration: CreateTestConfiguration
= customConfig => configurationProvider
.pipe(
    last(),
    map(configuration => Object.freeze({
        ...configuration,
        ...defaultTestServerconfig,
        ...customConfig,
        server_port: 0
    }))
);
