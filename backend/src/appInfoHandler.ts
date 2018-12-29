import * as path from "path";
import { Request, Response } from "express";
import { readTextFile } from "./utils/rx";
import loggerFactory from "./utils/logger";
import { map } from "rxjs/operators";

interface VersionInfo {
    version: string;
    commit: string;
}

interface AppInfo {
    versionInfo: VersionInfo;
    appDescription: string;
}

const appInfoHandlerProvider: (appDescription: string, packageRootDir: string) => (req: Request, res: Response) => void
= (appDescription, packageRootDir) => (req, res) => {
    const logCtx = loggerFactory("app-info");
    readTextFile(path.resolve(packageRootDir, "version.json"))
    .pipe(map(versionJSON => JSON.parse(versionJSON)))
    .subscribe(
        (versionInfo: VersionInfo) => {
            const appInfo: AppInfo = {
                versionInfo,
                appDescription
            };
            res.send(appInfo);
        },
        error => {
            logCtx.error(error);
            res.status(500).send({error: "Failed to retreive "}).end();
        },
        undefined
    );
};

export default appInfoHandlerProvider;
