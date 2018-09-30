import * as util from "util";
import { Request, Response } from "express";
import logger from "./utils/logger";

import {
    IconFile,
    IconDescriptor,
    IconFileDescriptor,
    IconAttributes,
    IconNotFound,
    IconFileAlreadyExists } from "./icon";
import { IconService, DescribeAllIcons, DescribeIcon } from "./iconsService";
import { getAuthentication } from "./security/common";
export interface IconHanlders {
    readonly describeAllIcons: (req: Request, res: Response) => void;
    readonly describeIcon: (req: Request, res: Response) => void;
    readonly createIcon: (req: Request, res: Response) => void;
    readonly ingestIconfile: (req: Request, res: Response) => void;
    readonly updateIcon: (req: Request, res: Response) => void;
    readonly deleteIcon: (req: Request, res: Response) => void;
    readonly getIconFile: (req: Request, res: Response) => void;
    readonly addIconFile: (req: Request, res: Response) => void;
    readonly updateIconFile: (req: Request, res: Response) => void;
    readonly deleteIconFile: (req: Request, res: Response) => void;
}

interface UploadedFileDescriptor {
    readonly originalname: string;
    readonly mimetype: string;
    readonly encoding: string;
    readonly buffer: Buffer;
    readonly size: number;
}

const createIconfilePath = (baseUrl: string, iconName: string, iconfileDesc: IconFileDescriptor) =>
    `${baseUrl}/${iconName}/formats/${iconfileDesc.format}/sizes/${iconfileDesc.size}`;

type CreateIconFilePaths = (baseUrl: string, iconDesc: IconDescriptor) => IconPathDTO[];

const createIconFilePaths: CreateIconFilePaths
= (baseUrl, iconDesc) =>
    iconDesc.iconFiles.toArray()
    .map(iconfileDescriptor =>
        ({
            ...iconfileDescriptor,
            path: createIconfilePath(baseUrl, iconDesc.name, iconfileDescriptor)
        }));

interface IconPathDTO extends IconFileDescriptor {
    readonly path: string;
}

export class IconDTO {
    public readonly name: string;
    public readonly modifiedBy: string;
    public readonly paths: IconPathDTO[];

    constructor(iconPathRoot: string, iconDesc: IconDescriptor) {
        this.name = iconDesc.name;
        this.modifiedBy = iconDesc.modifiedBy;
        this.paths = createIconFilePaths(iconPathRoot, iconDesc);
    }
}

const describeAllIcons: (getter: DescribeAllIcons, iconPathRoot: string) => (req: Request, res: Response) => void
= (getter, iconPathRoot) => (req, res) => {
    const log = logger.createChild(`${req.url} request handler`);
    getter()
    .map(iconList => iconList.map(iconDescriptor => new IconDTO(iconPathRoot, iconDescriptor)).toArray())
    .subscribe(
        iconDTOArray => res.send(iconDTOArray),
        error => {
            log.error("Failed to retrieve icons", error);
            res.status(500).send({error: error.message});
        },
        void 0
    );
};

const describeIcon: (getter: DescribeIcon, iconPathRoot: string) => (req: Request, res: Response) => void
= (getter, iconPathRoot) => (req, res) => {
    const log = logger.createChild(`${req.url} request handler`);
    getter(req.params.name)
    .map(iconDescriptor => iconDescriptor ? new IconDTO(iconPathRoot, iconDescriptor) : void 0)
    .subscribe(
        iconDTO => iconDTO ? res.send(iconDTO) : res.status(404).end(),
        error => {
            log.error("Failed to retrieve icon description", error);
            res.status(500).send({error: error.message});
        },
        void 0
    );
};

const iconHandlersProvider: (iconService: IconService) => (iconPathRoot: string) => IconHanlders
= iconService => iconPathRoot => ({
    describeAllIcons: (req: Request, res: Response) =>
        describeAllIcons(iconService.describeAllIcons, iconPathRoot)(req, res),

    describeIcon: (req: Request, res: Response) =>
        describeIcon(iconService.describeIcon, iconPathRoot)(req, res),

    createIcon: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("icon-create-requesthandler");
        ctxLogger.info("START");
        const iconData: IconFile = {
            name: req.body.name,
            format: req.body.format,
            size: req.body.size,
            content: (req.files as any)[0].buffer
        };
        ctxLogger.debug("iconData: %o", iconData);
        iconService.createIcon(iconData, getAuthentication(req.session).username)
        .subscribe(
            iconfileDescEx => {
                ctxLogger.info("Icon %o created: %o", iconfileDescEx, iconData);
                const iconfileInfo = {
                    iconName: iconfileDescEx.name,
                    format: iconfileDescEx.name,
                    size: iconfileDescEx.size,
                    path: createIconfilePath(iconPathRoot, iconfileDescEx.name, iconfileDescEx)
                };
                res.status(201).send(iconfileInfo).end();
            },
            error => {
                ctxLogger.error("An error occurred while creating icon %o: %o", iconData, error);
                res.status(500).send({error: error.message});
            }
        );
    },

    ingestIconfile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("ingest-iconfile-requesthandler");
        ctxLogger.info("START");
        const file: UploadedFileDescriptor = (req as any).files[0];
        const iconName: string = req.params.name;
        iconService.ingestIconfile(iconName, file.buffer, getAuthentication(req.session).username)
        .subscribe(
            iconfileDesc => {
                ctxLogger.info("Icon file '%o' for icon '%s' ingested", iconfileDesc, iconName);
                const iconfileInfo = {
                    iconName,
                    ...iconfileDesc,
                    path: createIconfilePath(iconPathRoot, iconName, iconfileDesc)
                };
                res.status(200).send(iconfileInfo).end();
            },
            error => {
                ctxLogger.error("ingesting icon file %o failed: %o", req.files, error);
                const statusCode = error instanceof IconFileAlreadyExists ? 409 : 500;
                res.status(statusCode).send({error: error.message}).end();
            }
        );
    },

    updateIcon: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("icon-update-requesthandler");
        ctxLogger.info("START");
        const oldIconName: string = req.params.name;
        const newIcon: IconAttributes = { name: req.body.name };
        if (!newIcon.name) {
            const errmsg = "Missing new icon data";
            ctxLogger.error(errmsg);
            res.status(400).send({ error: errmsg }).end();
        } else {
            iconService.updateIcon(oldIconName, newIcon, getAuthentication(req.session).username)
            .subscribe(
                result => {
                    ctxLogger.info("Icon #%d updated: %o", result, newIcon);
                    res.status(204).send({iconId: result}).end();
                },
                error => {
                    ctxLogger.error("An error occurred while updating icon %o: %o", oldIconName, error);
                    res.status(500).send({error: error.message});
                }
            );
        }
    },

    deleteIcon: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("icon-delete-requesthandler");
        if (!req.params || !req.params.name) {
            ctxLogger.error("Missing icon name");
            res.status(400).send({error: "Icon name must be specified"}).end();
        } else {
            const iconName = req.params.name;
            iconService.deleteIcon(iconName, getAuthentication(req.session).username)
            .subscribe(
                void 0,
                error => {
                    ctxLogger.error(error);
                    res.status(500).send({error: error.message});
                },
                () => res.status(204).end()
            );
        }
    },

    getIconFile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("iconfile-get-requesthandler");
        iconService.getIconFile(req.params.name, req.params.format, req.params.size)
        .toPromise()
        .then(
            result => {
                res.type(req.params.format).send(result);
            },
            error => {
                if (error instanceof IconNotFound) {
                    res.status(404).end();
                } else {
                    const logMessage = util.format(
                        "Failed to retrieve icon file for %s, %s, %s: %o",
                        req.params.name, req.params.format, req.params.size, error);
                    ctxLogger.error(logMessage);
                    res.status(500).send({error: error.message});
                }
            }
        );
    },

    addIconFile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("iconfile-add-requesthandler");
        const iconData: IconFile = {
            name: req.params.name,
            format: req.params.format,
            size: req.params.size,
            content: (req.files as any)[0].buffer
        };
        if (!iconData.name ||
                !iconData.format || iconData.format === ":format" ||
                !iconData.size || iconData.size === ":size" ||
                !iconData.content) {
            res.status(400).end();
        } else {
            iconService.addIconFile(iconData, getAuthentication(req.session).username)
            .subscribe(
                void 0,
                error => {
                    ctxLogger.error(error);
                    res.status(500).send({error: error.message});
                },
                () => res.status(201).end()
            );
        }
    },

    updateIconFile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("iconfile-add-requesthandler");
        const iconData: IconFile = {
            name: req.params.name,
            format: req.params.format,
            size: req.params.size,
            content: (req.files as any)[0].buffer
        };
        if (!iconData.name ||
                !iconData.format || iconData.format === ":format" ||
                !iconData.size || iconData.size === ":size" ||
                !iconData.content) {
            res.status(400).end();
        } else {
            iconService.updateIconFile(iconData, getAuthentication(req.session).username)
            .subscribe(
                void 0,
                error => {
                    ctxLogger.error(error);
                    res.status(500).send({error: error.message});
                },
                () => res.status(204).end()
            );
        }
    },

    deleteIconFile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("iconfile-delete-requesthandler");
        if (!req.params.name) {
            ctxLogger.error("Missing icon name");
            res.status(400).send({error: "Icon name must be specified"}).end();
        } else if (!req.params.format || !req.params.size) {
            ctxLogger.error("Missing format or size parameter %o",  req.params);
            res.status(400).send({error: "Missing format or size parameter"}).end();
        } else {
            const iconName = req.params.name;
            const iconFileDesc: IconFileDescriptor = {format: req.params.format, size: req.params.size};
            iconService.deleteIconFile(
                iconName,
                iconFileDesc, getAuthentication(req.session).username)
            .subscribe(
                void 0,
                error => {
                    ctxLogger.error(error);
                    res.status(500).send({error: error.message});
                },
                () => res.status(204).end()
            );
        }
    }
});

export default iconHandlersProvider;
