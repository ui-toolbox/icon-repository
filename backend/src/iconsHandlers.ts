import { Request, Response } from "express";
import logger from "./utils/logger";

import { IAddIconRequestData, IAddIconFileRequestData } from "./icon";
import { IIconService } from "./iconsService";
import { getAuthentication } from "./security/common";
export interface IIconHanlders {
    readonly getIconRepoConfig: (req: Request, res: Response) => void;
    readonly icons: (req: Request, res: Response) => void;
    readonly getIcon: (req: Request, res: Response) => Promise<void>;
    readonly getIconFile: (req: Request, res: Response) => void;
    readonly createIcon: (req: Request, res: Response) => void;
    readonly addIconFile: (req: Request, res: Response) => void;
}

const iconHandlersProvider: (iconService: IIconService) => IIconHanlders
= iconService => ({
    getIconRepoConfig: (req: Request, res: Response) => iconService.getRepoConfiguration().toPromise()
    .then(
        config => res.send(config),
        err => {
            logger.createChild("icon-formats service").error("Failed to retrieve icons formats", err);
            res.status(500).send(err.message);
        }
    ),
    icons: (req: Request, res: Response) => {
        const log = logger.createChild(`"/icons" request handler`);
        iconService.getIcons().toPromise()
        .then(
            iconList => res.send(iconList),
            err => {
                log.error("Failed to retrieve icons", err);
                res.status(500).send(err.message);
            }
        );
    },
    getIcon: (req: Request, res: Response) =>
        iconService.getIcon(req.params.path)
            .toPromise()
            .then(
                icon => {
                    res.contentType(icon.fileFormat);
                    res.end(icon.fileData);
                }
            )
            .catch(error => {
                if (error.code === "ENOENT") {
                    res.status(404).send(`Icon not found on path: ${req.params.path}`);
                } else {
                    res.status(500).send(`Error while retrieving icon on path: ${req.params.path}`);
                }
            }),
    getIconFile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("getIconFile");
        iconService.getIconFile(req.params.id, req.params.format, req.params.size)
        .toPromise()
        .then(
            result => {
                res.send(result.toString("binary"));
            },
            error => {
                ctxLogger.error("Failed to retrieve icon file for %d, %s, %s: %o",
                                req.params.id, req.params.format, req.params.size, error);
                res.sendStatus(500).end();
            }
        );
    },

    createIcon: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("createIcon");
        ctxLogger.info("START");
        const iconData: IAddIconRequestData = {
            iconName: req.body.iconName,
            format: req.body.fileFormat,
            size: req.body.iconSize,
            content: (req.files as any)[0].buffer
        };
        iconService.createIcon(iconData, getAuthentication(req.session).username)
        .subscribe(
            result => {
                ctxLogger.info("Icon #%d created: %o", result, iconData);
                res.status(201).send({iconId: result}).end();
            },
            error => {
                ctxLogger.error("An error occurred while creating icon %o: %o", iconData, error);
                res.status(500).end("An error occurred while creating icon");
            }
        );
    },

    addIconFile: (req: Request, res: Response) => {
        const iconData: IAddIconFileRequestData = {
            iconId: req.params.id,
            format: req.params.format,
            size: req.params.size,
            content: (req.files as any)[0].buffer
        };
        if (!iconData.iconId ||
                !iconData.format || iconData.format === ":format" ||
                !iconData.size || iconData.size === ":size" ||
                !iconData.content) {
            res.status(400).end();
        } else {
            res.status(201).end();
        }
    }
});

export default iconHandlersProvider;
