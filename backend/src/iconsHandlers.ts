import { Request, Response } from "express";
import logger from "./logger";

import { IIconService } from "./iconsService";

export default (icons: IIconService) => {
    const ctxLogger = logger.createChild("icon-service");
    return {
        getIconFormats: (req: Request, res: Response) => icons.getAllowedIconFormats().toPromise()
        .then(
            allowedIconFormats => res.send(allowedIconFormats),
            err => {
                ctxLogger.error("Failed to retrieve icons formats", err);
                res.status(500).send(err.message);
            }
        ),
        getAllIcons: (req: Request, res: Response) => {
            const log = logger.createChild(`"/icons" request handler`);
            icons.getIcons().toPromise()
            .then(
                iconList => res.send(iconList),
                err => {
                    log.error("Failed to retrieve icons", err);
                    res.status(500).send(err.message);
                }
            );
        },
        getIcon: (req: Request, res: Response) =>
            icons.getIcon(req.params.path)
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
        createIcon: (req: Request, res: Response) => {
            res.status(201).end();
        },
        addFormat: (req: Request, res: Response) => {
            res.status(201).end();
        }
    };
};
