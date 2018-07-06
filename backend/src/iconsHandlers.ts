import { Request, Response } from "express";
import logger from "./utils/logger";

import { CreateIconInfo, IconFile, IconFileDescriptor, IconDescriptor } from "./icon";
import { IconService, DescribeAllIcons, DescribeIcon } from "./iconsService";
import { getAuthentication } from "./security/common";
import { Set } from "immutable";
export interface IconHanlders {
    readonly getIconRepoConfig: (req: Request, res: Response) => void;
    readonly describeAllIcons: (iconPathRoot: string) => (req: Request, res: Response) => void;
    readonly describeIcon: (iconPathRoot: string) => (req: Request, res: Response) => void;
    readonly getIconFile: (req: Request, res: Response) => void;
    readonly createIcon: (req: Request, res: Response) => void;
    readonly addIconFile: (req: Request, res: Response) => void;
}

export interface IconPathsDTO {
    [format: string]: {
        [size: string]: string
    };
}

type CreateIconFilePaths = (baseUrl: string, iconFiles: Set<IconFileDescriptor>) => IconPathsDTO;

const createIconFilePaths: CreateIconFilePaths = (baseUrl, iconFiles) => iconFiles
    .groupBy(ifDesc => ifDesc.format)
    .reduce(
        (paths, fileDescCollection, format) => ({
            ...paths,
            [format]: fileDescCollection.reduce(
                (sizeToPath, fdescItem) => ({
                    ...sizeToPath,
                    [fdescItem.size]: `${baseUrl}/formats/${format}/sizes/${fdescItem.size}`
                }),
                {}
            )
        }),
        {}
    );

export class IconDTO {
    public readonly iconName: string;
    public readonly iconFiles: IconPathsDTO;

    constructor(iconPathRoot: string, iconDesc: IconDescriptor) {
        this.iconName = iconDesc.iconName;
        this.iconFiles = createIconFilePaths(iconPathRoot, iconDesc.iconFiles);
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
            res.status(500).send(error.message);
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
            res.status(500).send(error.message);
        },
        void 0
    );
};

const iconHandlersProvider: (iconService: IconService) => IconHanlders
= iconService => ({
    getIconRepoConfig: (req: Request, res: Response) => iconService.getRepoConfiguration().toPromise()
    .then(
        config => res.send(config),
        err => {
            logger.createChild("icon-formats service").error("Failed to retrieve icons formats", err);
            res.status(500).send(err.message);
        }
    ),

    describeAllIcons: (iconPathRoot: string) => (req: Request, res: Response) =>
        describeAllIcons(iconService.describeAllIcons, iconPathRoot)(req, res),

    describeIcon: (iconPathRoot: string) => (req: Request, res: Response) =>
        describeIcon(iconService.describeIcon, iconPathRoot)(req, res),

    getIconFile: (req: Request, res: Response) => {
        const ctxLogger = logger.createChild("getIconFile");
        iconService.getIconFile(req.params.name, req.params.format, req.params.size)
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
        const iconData: CreateIconInfo = {
            name: req.body.name,
            format: req.body.format,
            size: req.body.size,
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
        const ctxLogger = logger.createChild("addIconFile");
        const iconData: IconFile = {
            iconName: req.params.name,
            format: req.params.format,
            size: req.params.size,
            content: (req.files as any)[0].buffer
        };
        if (!iconData.iconName ||
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
                    res.status(500).end();
                },
                () => res.status(201).end()
            );
        }
    }
});

export default iconHandlersProvider;
