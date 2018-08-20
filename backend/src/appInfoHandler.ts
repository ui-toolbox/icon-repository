import * as path from "path";
import { Request, Response } from "express";
import { readTextFile } from "./utils/rx";
import logger from "./utils/logger";

const appInfoHandlerProvider: (appDescription: string, packageRootDir: string) => (req: Request, res: Response) => void
= (appDescription, packageRootDir) => (req, res) => {
    const logCtx = logger.createChild("app-info");
    readTextFile(path.resolve(packageRootDir, "version.json"))
    .map(versionJSON => JSON.parse(versionJSON))
    .subscribe(
        versionInfo => res.send({
            versionInfo,
            appDescription
        }),
        error => {
            logCtx.error(error);
            res.status(500).send({error: "Failed to retreive "}).end();
        },
        undefined
    );
};

export default appInfoHandlerProvider;
