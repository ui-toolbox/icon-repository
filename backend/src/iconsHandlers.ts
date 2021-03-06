import { format } from "util";
import { Request, Response } from "express";
import loggerFactory from "./utils/logger";
import { map } from "rxjs/operators";

import {
    IconDescriptor,
    IconfileDescriptor,
    IconAttributes,
    IconNotFound,
    IconfileAlreadyExists } from "./icon";
import { IconService, DescribeAllIcons, DescribeIcon } from "./iconsService";
import { getAuthentication } from "./security/common";
export interface IconHanlders {
    readonly describeAllIcons: (req: Request, res: Response) => void;
    readonly describeIcon: (req: Request, res: Response) => void;
    readonly createIcon: (req: Request, res: Response) => void;
    readonly ingestIconfile: (req: Request, res: Response) => void;
    readonly updateIcon: (req: Request, res: Response) => void;
    readonly deleteIcon: (req: Request, res: Response) => void;
    readonly getIconfile: (req: Request, res: Response) => void;
    readonly deleteIconfile: (req: Request, res: Response) => void;
    readonly addTag: (req: Request, res: Response) => void;
    readonly getTags: (req: Request, res: Response) => void;
    readonly removeTag: (req: Request, res: Response) => void;
    readonly release: () => void;
}

interface UploadedFileDescriptor {
    readonly originalname: string;
    readonly mimetype: string;
    readonly encoding: string;
    readonly buffer: Buffer;
    readonly size: number;
}

const getUsername = (session: any) => getAuthentication(session).username;

export const createIconfilePath = (baseUrl: string, iconName: string, iconfileDesc: IconfileDescriptor) =>
    `${baseUrl}/${iconName}/format/${iconfileDesc.format}/size/${iconfileDesc.size}`;

type CreateIconfilePaths = (baseUrl: string, iconDesc: IconDescriptor) => IconPath[];

const createIconfilePaths: CreateIconfilePaths
= (baseUrl, iconDesc) =>
    iconDesc.iconfiles.toArray()
    .map(iconfileDescriptor =>
        ({
            ...iconfileDescriptor,
            path: createIconfilePath(baseUrl, iconDesc.name, iconfileDescriptor)
        }));

export interface IconPath extends IconfileDescriptor {
    readonly path: string;
}

// TODO: have this extend IconfileDescriptorEx instead of IconfileDescriptor
export interface IngestedIconfileDTO extends IconfileDescriptor {
    iconName: string;
    path: string;
}

export interface IconDTO {
    readonly name: string;
    readonly modifiedBy: string;
    readonly paths: IconPath[];
    readonly tags: string[];
}

export const createIconDTO: (iconPathRoot: string, iconDesc: IconDescriptor) => IconDTO
= (iconPathRoot, iconDesc) => ({
    name: iconDesc.name,
    modifiedBy: iconDesc.modifiedBy,
    paths: createIconfilePaths(iconPathRoot, iconDesc),
    tags: iconDesc.tags.toArray()
});

const describeAllIcons: (getter: DescribeAllIcons, iconPathRoot: string) => (req: Request, res: Response) => void
= (getter, iconPathRoot) => (req, res) => {
    const log = loggerFactory(`${req.url} request handler`);
    getter()
    .pipe(map(iconList => iconList.map(iconDescriptor => createIconDTO(iconPathRoot, iconDescriptor)).toArray()))
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
    const log = loggerFactory(`${req.url} request handler`);
    getter(req.params.name)
    .pipe(map(iconDescriptor => iconDescriptor ? createIconDTO(iconPathRoot, iconDescriptor) : void 0))
    .subscribe(
        iconDTO => iconDTO ? res.send(iconDTO) : res.status(404).end(),
        error => {
            if (error instanceof IconNotFound) {
                res.status(404).end();
            } else {
                log.error("Failed to retrieve icon description %O", error);
                res.status(500).send({error: error.message});
            }
        },
        void 0
    );
};

const getTags: (req: Request, res: Response, iconService: IconService) => void = (req, res, iconService) => {
    const log = loggerFactory(`${req.url} request handler`);
    iconService.getTags()
    .subscribe(
        tagSet => {
            log.debug("returning %o", tagSet);
            res.status(200).send(tagSet.toArray()).end();
        },
        error => {
            log.error("Failed fetch tags", error);
            res.status(500).send({error: error.message});
        },
        void 0
    );
};

const removeTag: (req: Request, res: Response, iconService: IconService) => void = (req, res, iconService) => {
    const log = loggerFactory(`${req.url} request handler`);
    const iconName = req.params.name;
    const tag = req.params.tag;
    iconService.removeTag(iconName, tag, getUsername(req.session))
    .subscribe(
        remainingReferenceCount => {
            log.debug("returning %o", remainingReferenceCount);
            res.status(200).send({remainingReferenceCount}).end();
        },
        error => {
            log.error("Failed to remove tag %s from %s: %o", tag, iconName, error);
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
        const ctxLogger = loggerFactory("icon-create-requesthandler");
        ctxLogger.debug("START");
        const iconName = req.body.name;
        const initialIconfileContent = (req.files as any)[0].buffer;
        ctxLogger.debug("iconName: %s", iconName);
        iconService.createIcon(iconName, initialIconfileContent, getUsername(req.session))
        .subscribe(
            iconfileDescEx => {
                ctxLogger.debug("Icon %o created: %o", iconfileDescEx, iconName);
                const iconfileInfo: IngestedIconfileDTO = {
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
        const ctxLogger = loggerFactory("ingest-iconfile-requesthandler");
        ctxLogger.debug("START");
        const file: UploadedFileDescriptor = (req as any).files[0];
        const iconName: string = req.params.name;
        iconService.ingestIconfile(iconName, file.buffer, getUsername(req.session))
        .subscribe(
            iconfileDesc => {
                ctxLogger.debug("Icon file '%o' for icon '%s' ingested", iconfileDesc, iconName);
                const iconfileInfo: IngestedIconfileDTO = {
                    iconName,
                    ...iconfileDesc,
                    path: createIconfilePath(iconPathRoot, iconName, iconfileDesc)
                };
                res.status(200).send(iconfileInfo).end();
            },
            error => {
                ctxLogger.error("ingesting icon file %o failed: %o", req.files, error);
                const statusCode = error instanceof IconfileAlreadyExists ? 409 : 500;
                res.status(statusCode).send({error: error.message}).end();
            }
        );
    },

    updateIcon: (req: Request, res: Response) => {
        const ctxLogger = loggerFactory("icon-update-requesthandler");
        ctxLogger.info(`START ${req.body.name}`);
        const oldIconName: string = req.params.name;
        const newIcon: IconAttributes = { name: req.body.name };
        if (!newIcon.name) {
            const errmsg = "Missing new icon data";
            ctxLogger.error(errmsg);
            res.status(400).send({ error: errmsg }).end();
        } else {
            iconService.updateIcon(oldIconName, newIcon, getUsername(req.session))
            .subscribe(
                result => {
                    ctxLogger.info("Icon %s updated: %o", oldIconName, newIcon);
                    res.status(204).end();
                },
                error => {
                    ctxLogger.error("An error occurred while updating icon %o: %o", oldIconName, error);
                    res.status(500).send({error: error.message});
                }
            );
        }
    },

    deleteIcon: (req: Request, res: Response) => {
        const ctxLogger = loggerFactory("icon-delete-requesthandler");
        if (!req.params || !req.params.name) {
            ctxLogger.error("Missing icon name");
            res.status(400).send({error: "Icon name must be specified"}).end();
        } else {
            const iconName = req.params.name;
            iconService.deleteIcon(iconName, getUsername(req.session))
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

    getIconfile: (req: Request, res: Response) => {
        const ctxLogger = loggerFactory("iconfile-get-requesthandler");
        iconService.getIconfile(req.params.name, req.params.format, req.params.size)
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

    deleteIconfile: (req: Request, res: Response) => {
        const ctxLogger = loggerFactory("iconfile-delete-requesthandler");
        if (!req.params.name) {
            ctxLogger.error("Missing icon name");
            res.status(400).send({error: "Icon name must be specified"}).end();
        } else if (!req.params.format || !req.params.size) {
            ctxLogger.error("Missing format or size parameter %o",  req.params);
            res.status(400).send({error: "Missing format or size parameter"}).end();
        } else {
            const iconName = req.params.name;
            const iconfileDesc: IconfileDescriptor = {format: req.params.format, size: req.params.size};
            iconService.deleteIconfile(
                iconName,
                iconfileDesc, getUsername(req.session))
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
    },

    getTags: (req: Request, res: Response) => getTags(req, res, iconService),

    addTag:  (req: Request, res: Response) => {
        const ctxLogger = loggerFactory("add-tag-requesthandler");
        if (!req.params.name) {
            ctxLogger.error("Missing icon name");
            res.status(400).send({error: "Icon name must be specified"}).end();
        } else if (!req.body.tag) {
            ctxLogger.error("Missing tag text for \"%s\": %o", req.params.name, req.body);
            res.status(400).send({error: "Tag must be specified"}).end();
        } else {
            iconService.addTag(
                req.params.name,
                req.body.tag,
                getUsername(req.session)
            )
            .subscribe(
                void 0,
                error => {
                    ctxLogger.error(format("Could not add tag %s to %s: %o", req.params.name, req.body.tag, error));
                    const status = error instanceof IconNotFound ? 404 : 500;
                    res.status(status).send({error: error.message});
                },
                () => res.status(200).end()
            );
        }
    },

    removeTag: (req: Request, res: Response) => removeTag(req, res, iconService),

    release: iconService.release
});

export default iconHandlersProvider;
