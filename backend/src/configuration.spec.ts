import * as path from "path";
import * as fs from "fs";
import * as Rx from "rxjs";

import configuration, {
    DEFAULT_CONFIG_FILE_PATH,
    getConfigFilePath,
    updateConfigurationDataWithEnvVarValues,
    readConfiguration
} from "./configuration";

export const setEnvVar = (envVarName: string, envVarValue: string) => process.env[envVarName] = envVarValue;

const getBuildDirectory = () => path.join(__dirname, "..", "src");

const storeConfigInTempFile = (config: any) => {
    const pathToFile: string = path.join(getBuildDirectory(), `temp-${path.basename(__filename)}-out`);
    if (fs.existsSync(pathToFile)) {
        fs.unlinkSync(pathToFile);
    }
    fs.writeFileSync(pathToFile, typeof config === "string" ? config : JSON.stringify(config), "utf8");
    return pathToFile;
};

describe("getConfigFilePath", () => {

    beforeEach(() => {
        delete process.env.ICON_REPO_CONFIG_FILE;
        delete process.env.ICON_REPO_CONFIG_PROFILE;
    });

    it("should return the default by default", () => {
        expect(getConfigFilePath()).toEqual(DEFAULT_CONFIG_FILE_PATH);
    });

    it("should return what is specified in ICON_REPO_CONFIG_FILE, if any", () => {
        const somePath = "asdf";
        setEnvVar("ICON_REPO_CONFIG_FILE", somePath);
        expect(getConfigFilePath()).toEqual(somePath);
    });

    it("should return the correct profile config, if ICON_REPO_CONFIG_PROFILE", () => {
        const someProfileConfig = "some profile config";
        const expected = path.join(getBuildDirectory(), "configurations", `${someProfileConfig}.json`);
        setEnvVar("ICON_REPO_CONFIG_PROFILE", someProfileConfig);
        expect(getConfigFilePath()).toEqual(expected);
    });

});

describe("updateConfigurationDataWithEnvVarValues", () => {
    it("should overwrite the original values with their environment variable equivalents, " +
            "if they are specified", () => {
        const proto = {
            zazie: "",
            dans: "",
            le: "",
            metro: ""
        };
        const zazieDansLeMetro = {
            zazie: "zazie",
            dans: "dans",
            le: "le",
            metro: "metro"
        };

        setEnvVar("ZAZIE", "zazie envvar");
        setEnvVar("METRO", "envvar metro");

        const expected = {
            zazie: "zazie envvar",
            dans: "dans",
            le: "le",
            metro: "envvar metro"
        };

        expect(updateConfigurationDataWithEnvVarValues(proto, zazieDansLeMetro)).toEqual(expected);
    });
});

describe("readConfiguration", () => {
    it("should yield the default settings, if the specified configuration file doesn't exists", done => {
        const proto = {tavaszi: "", husveti: ""};
        const defaultSettings = {tavaszi: "tekercs"};
        readConfiguration("some non-existent file", proto, defaultSettings)
        .subscribe(
            conf => {
                // @ts-ignore
                expect(conf).toEqual(defaultSettings);
                done();
            }
        );
    });

    it("should yield the settings, stored in the specified configuration file", done => {
        const proto = {tavaszi: "", husveti: "", aprilisi: ""};
        const defaultSettings = {tavaszi: "tekercs"};
        const configToStore =  {tavaszi: "mulatsag", aprilisi: "trefa"};
        setEnvVar("APRILISI", "eso");
        const expectedConfig = {tavaszi: "mulatsag", aprilisi: "eso"};

        const tempFile = storeConfigInTempFile(configToStore);

        readConfiguration(tempFile, proto, defaultSettings)
        .subscribe(
            conf => {
                // @ts-ignore
                expect(conf).not.toEqual(defaultSettings);
                // @ts-ignore
                expect(conf).toEqual(expectedConfig);
                fs.unlinkSync(tempFile);
                done();
            }
        );
    });

    it("should yield the default settings augmented with settings provided via environment variables, " +
            "if the specified configuration file has syntax error", done => {
        const proto = {tavaszi: "", husveti: "", aprilisi: ""};
        const defaultSettings = {tavaszi: "tekercs"};
        const configToStore =  {tavaszi: "mulatsag", aprilisi: "trefa"};
        setEnvVar("APRILISI", "eso");
        const expectedConfig = {tavaszi: "tekercs", aprilisi: "eso"};

        const tempFile = storeConfigInTempFile("{{{{");

        readConfiguration(tempFile, proto, defaultSettings)
        .subscribe(
            conf => {
                // @ts-ignore
                expect(conf).toEqual(expectedConfig);
                fs.unlinkSync(tempFile);
                done();
            }
        );
    });
});
