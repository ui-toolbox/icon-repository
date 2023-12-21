import { format } from "util";
import { type Request, type Response } from "express";
import { createLogger } from "./utils/logger";

import {
	type IconDescriptor,
	type IconfileDescriptor,
	type IconAttributes,
	IconNotFound,
	IconfileAlreadyExists
} from "./icon";
import { type IconService, type DescribeAllIcons, type DescribeIcon } from "./icons-service";
import { getAuthentication } from "./security/authenticated-user";
import _, { isNil } from "lodash";

const logger = createLogger("icons-handlers");

export interface IconHanlders {
	readonly describeAllIcons: (req: Request, res: Response) => void
	readonly describeIcon: (req: Request, res: Response) => void
	readonly createIcon: (req: Request, res: Response) => void
	readonly ingestIconfile: (req: Request, res: Response) => void
	readonly updateIcon: (req: Request, res: Response) => void
	readonly deleteIcon: (req: Request, res: Response) => void
	readonly getIconfile: (req: Request, res: Response) => void
	readonly deleteIconfile: (req: Request, res: Response) => void
	readonly addTag: (req: Request, res: Response) => void
	readonly getTags: (req: Request, res: Response) => void
	readonly removeTag: (req: Request, res: Response) => void
	readonly release: () => Promise<void>
}

interface UploadedFileDescriptor {
	readonly originalname: string
	readonly mimetype: string
	readonly encoding: string
	readonly buffer: Buffer
	readonly size: number
}

const getUsername = (session: any): string => getAuthentication(session)?.username ?? "";

export const createIconfilePath = (baseUrl: string, iconName: string, iconfileDesc: IconfileDescriptor): string =>
	`${baseUrl}/${iconName}/format/${iconfileDesc.format}/size/${iconfileDesc.size}`;

type CreateIconfilePaths = (baseUrl: string, iconDesc: IconDescriptor) => IconPath[];

const createIconfilePaths: CreateIconfilePaths =
	(baseUrl, iconDesc) =>
		iconDesc.iconfiles.map(
			iconfileDescriptor =>
				({
					...iconfileDescriptor,
					path: createIconfilePath(baseUrl, iconDesc.name, iconfileDescriptor)
				})
		);

export interface IconPath extends IconfileDescriptor {
	readonly path: string
}

// TODO: have this extend IconfileDescriptorEx instead of IconfileDescriptor
export interface IngestedIconfileDTO extends IconfileDescriptor {
	iconName: string
	path: string
}

export interface IconDTO {
	readonly name: string
	readonly modifiedBy: string
	readonly paths: IconPath[]
	readonly tags: string[]
}

export const createIconDTO = (iconPathRoot: string, iconDesc: IconDescriptor): IconDTO => ({
	name: iconDesc.name,
	modifiedBy: iconDesc.modifiedBy,
	paths: createIconfilePaths(iconPathRoot, iconDesc),
	tags: iconDesc.tags
});

const describeAllIcons = (getter: DescribeAllIcons, iconPathRoot: string) => (req: Request, res: Response): void => {
	const asyncFunc = async (): Promise<void> => {
		const iconList = await getter();
		const iconDTOArray = iconList.map(iconDescriptor => createIconDTO(iconPathRoot, iconDescriptor));
		res.send(iconDTOArray);
	};
	asyncFunc().then().catch(error => {
		logger.error("#describeAllIcons: Failed to retrieve icons", error);
		res.status(500).send({ error: error.message });
	});
};

const describeIcon = (getter: DescribeIcon, iconPathRoot: string) => (req: Request, res: Response): void => {
	const asyncFunc = async (): Promise<void> => {
		const iconDescriptor = await getter(req.params.name);
		if (isNil(iconDescriptor)) {
			res.status(404).end();
			return;
		}
		const iconDTO = createIconDTO(iconPathRoot, iconDescriptor);
		res.send(iconDTO);
	};
	asyncFunc().then().catch(error => {
		if (error instanceof IconNotFound) {
			res.status(404).end();
		} else {
			logger.error("#describeIcon: Failed to retrieve icon description %O", error);
			res.status(500).send({ error: error.message });
		}
	});
};

const getTags = (req: Request, res: Response, iconService: IconService): void => {
	const asyncFunc = async (): Promise<void> => {
		const tagSet = await iconService.getTags();
		logger.debug("#getTags: returning %o", tagSet);
		res.status(200).send(tagSet).end();
	};
	asyncFunc().then().catch(error => {
		logger.error("#getTags: Failed fetch tags", error);
		res.status(500).send({ error: error.message });
	});
};

const removeTag = (req: Request, res: Response, iconService: IconService): void => {
	let iconName: string, tag: string;
	const asyncFunc = async (): Promise<void> => {
		const iconName = req.params.name;
		const tag = req.params.tag;
		await iconService.removeTag(iconName, tag, getUsername(req.session));
		res.status(204).end();
	};
	asyncFunc().then().catch(error => {
		logger.error("#removeTag: Failed to remove tag %s from %s: %o", tag, iconName, error);
		res.status(500).send({ error: error.message });
	});
};

const iconHandlersProvider = (iconService: IconService) => (iconPathRoot: string): IconHanlders => ({
	describeAllIcons: (req: Request, res: Response) => {
		describeAllIcons(iconService.describeAllIcons, iconPathRoot)(req, res);
	},

	describeIcon: (req: Request, res: Response) => { describeIcon(iconService.describeIcon, iconPathRoot)(req, res); },

	createIcon: (req: Request, res: Response) => {
		let iconName: string;
		const asyncFunc = async (): Promise<void> => {
			logger.debug("#createIcon: START");
			const file: UploadedFileDescriptor = req.file as Express.Multer.File;
			iconName = req.body.iconName;
			logger.debug("#createIcon: iconName: %s", iconName);
			const iconDescEx = await iconService.createIcon(iconName, file.buffer, getUsername(req.session));
			logger.debug("#createIcon: Icon %o created: %o", iconDescEx, iconName);
			const iconfileInfo: IconDTO = {
				name: iconName,
				modifiedBy: iconDescEx.modifiedBy,
				paths: [{
					format: iconDescEx.iconfiles[0].format,
					size: iconDescEx.iconfiles[0].size,
					path: createIconfilePath(iconPathRoot, iconDescEx.name, iconDescEx.iconfiles[0])
				}],
				tags: iconDescEx.tags
			};
			res.status(201).send(iconfileInfo).end();
		};
		asyncFunc().then().catch(error => {
			logger.error("#createIcon: An error occurred while creating icon %o: %o", iconName, error);
			res.status(500).send({ error: error.message });
		});
	},

	ingestIconfile: (req: Request, res: Response) => {
		const asyncFunc = async (): Promise<void> => {
			logger.debug("#ingestIconfile: START");
			const file: UploadedFileDescriptor = req.file as Express.Multer.File;
			const iconName: string = req.params.name;
			const iconfileDesc = await iconService.ingestIconfile(iconName, file.buffer, getUsername(req.session));
			logger.debug("#ingestIconfile: Icon file '%o' for icon '%s' ingested", iconfileDesc, iconName);
			const iconfileInfo: IngestedIconfileDTO = {
				iconName,
				...iconfileDesc,
				path: createIconfilePath(iconPathRoot, iconName, iconfileDesc)
			};
			res.status(200).send(iconfileInfo).end();
		};
		asyncFunc().then().catch(error => {
			logger.error("#ingestIconfile: ingesting iconfile %o failed: %o", req.files, error);
			const statusCode = error instanceof IconfileAlreadyExists ? 409 : 500;
			res.status(statusCode).send({ error: error.message }).end();
		});
	},

	updateIcon: (req: Request, res: Response) => {
		let oldIconName: string;
		const asyncFunc = async (): Promise<void> => {
			logger.info(`#updateIcon: START ${req.body.name}`);
			oldIconName = req.params.name;
			const newIcon: IconAttributes = { name: req.body.name };
			if (_.isNil(newIcon.name)) {
				const errmsg = "Missing new icon data";
				logger.error("#updateIcon: %s", errmsg);
				res.status(400).send({ error: errmsg }).end();
			} else {
				await iconService.updateIcon(oldIconName, newIcon, getUsername(req.session));
				logger.info("#updateIcon: Icon %s updated: %o", oldIconName, newIcon);
				res.status(204).end();
			};
		};
		asyncFunc().then().catch(error => {
			logger.error("#updateIcon: An error occurred while updating icon %o: %o", oldIconName, error);
			res.status(500).send({ error: error.message });
		});
	},

	deleteIcon: (req: Request, res: Response) => {
		logger.debug("#deleteIcon: req.params: %o", req.params);
		const asyncFunc = async (): Promise<void> => {
			if (_.isNil(req.params?.name)) {
				logger.error("#deleteIcon: Missing icon name");
				res.status(400).send({ error: "Icon name must be specified" }).end();
			} else {
				const iconName = req.params.name;
				await iconService.deleteIcon(iconName, getUsername(req.session));
				res.status(204).end();
			}
		};
		asyncFunc().then().catch(error => {
			logger.error(error);
			res.status(500).send({ error: error.message });
		});
	},

	getIconfile: (req: Request, res: Response) => {
		const asyncFunc = async (): Promise<void> => {
			const result = await iconService.getIconfile(req.params.name, req.params.format, req.params.size);
			res.type(req.params.format).send(result);
		};
		asyncFunc().then().catch(error => {
			if (error instanceof IconNotFound) {
				res.status(404).end();
			} else {
				const logMessage = format(
					"Failed to retrieve icon file for %s, %s, %s: %o",
					req.params.name, req.params.format, req.params.size, error);
				logger.error("#getIconfile: %s", logMessage);
				res.status(500).send({ error: error.message });
			}
		});
	},

	deleteIconfile: (req: Request, res: Response) => {
		if (_.isNil(req.params.name)) {
			logger.error("#deleteIconfile: Missing icon name");
			res.status(400).send({ error: "Icon name must be specified" }).end();
		} else if (_.isNil(req.params.format) || _.isNil(req.params.size)) {
			logger.error("#deleteIconfile: Missing format or size parameter %o", req.params);
			res.status(400).send({ error: "Missing format or size parameter" }).end();
		} else {
			const iconName = req.params.name;
			const asyncFunc = async (): Promise<void> => {
				const iconfileDesc: IconfileDescriptor = { format: req.params.format, size: req.params.size };
				await iconService.deleteIconfile(
					iconName,
					iconfileDesc,
					getUsername(req.session)
				);
				res.status(204).end();
			};
			asyncFunc().then().catch(error => {
				logger.error(format("#deleteIconfile: Could not delete icon file: %o", error));
				const status = error instanceof IconNotFound ? 404 : 500;
				res.status(status).send({ error: error.message });
			});
		}
	},

	getTags: (req: Request, res: Response) => { getTags(req, res, iconService); },

	addTag: (req: Request, res: Response) => {
		if (_.isNil(req.params.name)) {
			logger.error("#addTag: Missing icon name");
			res.status(400).send({ error: "Icon name must be specified" }).end();
		} else if (_.isNil(req.body.tag)) {
			logger.error("#addTag: Missing tag text for \"%s\": %o", req.params.name, req.body);
			res.status(400).send({ error: "Tag must be specified" }).end();
		} else {
			const asyncFunc = async (): Promise<void> => {
				await iconService.addTag(
					req.params.name,
					req.body.tag,
					getUsername(req.session)
				);
				res.status(201).end();
			};
			asyncFunc().then().catch(error => {
				logger.error(format("#addTag: Could not add tag %s to %s: %o", req.params.name, req.body.tag, error));
				const status = error instanceof IconNotFound ? 404 : 500;
				res.status(status).send({ error: error.message });
			});
		}
	},

	removeTag: (req: Request, res: Response) => { removeTag(req, res, iconService); },

	release: iconService.release
});

export default iconHandlersProvider;
