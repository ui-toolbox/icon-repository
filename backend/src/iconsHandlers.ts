import { format } from "util";
import { Request, Response } from "express";
import logger from "./utils/logger";

import {
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
    readonly deleteIconFile: (req: Request, res: Response) => void;
}

interface UploadedFileDescriptor {
    readonly originalname: string;
    readonly mimetype: string;
    readonly encoding: string;
    readonly buffer: Buffer;
    readonly size: number;
}

export const createIconfilePath = (baseUrl: string, iconName: string, iconfileDesc: IconFileDescriptor) =>
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

export interface IconPathDTO extends IconFileDescriptor {
    readonly path: string;
}

export interface IconDTO {
    readonly name: string;
    readonly modifiedBy: string;
    readonly paths: IconPathDTO[];
}

export const createIconDTO: (iconPathRoot: string, iconDesc: IconDescriptor) => IconDTO
= (iconPathRoot, iconDesc) => ({
    name: iconDesc.name,
    modifiedBy: iconDesc.modifiedBy,
    paths: createIconFilePaths(iconPathRoot, iconDesc)
});

const describeAllIcons: (getter: DescribeAllIcons, iconPathRoot: string) => (req: Request, res: Response) => void
= (getter, iconPathRoot) => (req, res) => {
    const log = logger.createChild(`${req.url} request handler`);
    getter()
    .map(iconList => iconList.map(iconDescriptor => createIconDTO(iconPathRoot, iconDescriptor)).toArray())
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
    .map(iconDescriptor => iconDescriptor ? createIconDTO(iconPathRoot, iconDescriptor) : void 0)
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
        ctxLogger.debug("START");
        const iconName = req.body.name;
        const initialIconfileContent = (req.files as any)[0].buffer;
        ctxLogger.debug("iconName: %s", iconName);
        iconService.createIcon(iconName, initialIconfileContent, getAuthentication(req.session).username)
        .subscribe(
            iconfileDescEx => {
                ctxLogger.debug("Icon %o created: %o", iconfileDescEx, iconName);
                const iconfileInfo = {
                    iconName: iconfileDescEx.name,
                    format: iconfileDescEx.format,
                    size: iconfileDescEx.size,
                    path: createIconfilePath(iconPathRoot, iconfileDescEx.name, iconfileDescEx)
                };
                res.status(201).send(iconfileInfo).end();
            },
            error => {
                ctxLogger.error("An error occurred while creating icon %o: %o", iconName, error);
                res.status(500).send({error: error.message});
            }
        );
    },

    ingestIconfile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("ingest-iconfile-requesthandler");
        ctxLogger.debug("START");
        const file: UploadedFileDescriptor = (req as any).files[0];
        const iconName: string = req.params.name;
        iconService.ingestIconfile(iconName, file.buffer, getAuthentication(req.session).username)
        .subscribe(
            iconfileDesc => {
                ctxLogger.debug("Icon file '%o' for icon '%s' ingested", iconfileDesc, iconName);
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
        ctxLogger.info(`START ${req.body.name}`);
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
                    const logMessage = format(
                        "Failed to retrieve icon file for %s, %s, %s: %o",
                        req.params.name, req.params.format, req.params.size, error);
                    ctxLogger.error(logMessage);
                    res.status(500).send({error: error.message});
                }
            }
        );
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
                    ctxLogger.error(format("Could not delete icon file: %o", error));
                    const status = error instanceof IconNotFound ? 404 : 500;
                    res.status(status).send({error: error.message});
                },
                () => res.status(204).end()
            );
        }
    }
});

export default iconHandlersProvider;
