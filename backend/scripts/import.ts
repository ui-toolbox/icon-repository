import { format as strformat } from "util";
import * as path from "path";

import {
	getBaseUrl,
	Session,
	startTestServer
} from "../integration-tests/api/api-test-utils";
import { createLogger } from "../src/utils/logger";
import configuration from "../src/configuration";
import { getSerializer } from "../src/utils/serializer";
import { describeIcon } from "../integration-tests/api/api-client";
import { readFile, readdir } from "fs/promises";
import _ from "lodash";

const defaultSourceDir = path.resolve(
	__dirname,
	".." /* exit "script" dir */,
	".." /* exit "build" dir */,
	"demo-data");
const sourceDir = process.env.ICON_IMPORT_SOURCE_DIR ?? defaultSourceDir;

delete process.env.ICON_DATA_LOCATION_GIT;

const logger = createLogger("importer");

interface SourceFileDescriptor {
	name: string
	format: string
	size: string
	filePath: string
}

const stripExtension = (fileName: string): string => fileName.replace(/(.*)\.[^.]*$/, "$1");

const iconfileCollector = async (): Promise<SourceFileDescriptor[]> => {
	let result: SourceFileDescriptor[] = [];
	const directoriesForFormats = await readdir(sourceDir);
	for (const directoryForFormat of directoriesForFormats) {
		const directoriesForSizes = await readdir(path.join(sourceDir, directoryForFormat));
		for (const directoryForSize of directoriesForSizes) {
			const files = await readdir(path.join(sourceDir, directoryForFormat, directoryForSize));
			result = result.concat(files.map(file => ({
				name: stripExtension(file),
				format: directoryForFormat,
				size: directoryForSize,
				filePath: file
			})));
		}
	}
	return result;
};

const createSession = (): Session => new Session(
	getBaseUrl(),
	undefined
);

const doesIconExist = async (iconName: string): Promise<boolean> => {
	const icon = await describeIcon(
		createSession().request(),
		iconName
	);
	return !_.isNil(icon);
};

const addIconfile = async (
	iconName: string,
	format: string,
	size: string,
	content: Buffer,
	create: boolean
): Promise<void> => {
	const url: string = create
		? "/icon"
		: `/icon/${iconName}`;

	const request = create
		? createSession().request().post(url).field({ name: iconName })
		: createSession().request().post(url);

	const response = await request
		.attach("icon", content, iconName)
		.send();
	if (create && (response.status === 201 || response.status === 200)) {
		const message = create
			? `"${iconName}" created with ${format} ${size}`
			: `${format} ${size} added to "${iconName}"`;
		logger.info(message);
	} else {
		const errorMessage = create
			? strformat("Creating \"%s\" with %s %s failed: %o", iconName, format, size, response.error)
			: strformat("Adding %s %s to \"%s\" failed with %o", format, size, iconName, response.error);
		throw new Error(errorMessage);
	}
};

const existingIcons: string[] = [];

const readAndUploadIconfile = async (descriptors: SourceFileDescriptor[]): Promise<void> => {
	logger.debug("Processing icon file: %o", descriptors);
	for (const descriptor of descriptors) {
		const content = await readFile(path.join(sourceDir, descriptor.format, descriptor.size, descriptor.filePath));
		const iconExists = existingIcons.includes(descriptor.name)
			? true
			: await doesIconExist(descriptor.name);
		existingIcons.push(descriptor.name);
		await addIconfile(
			descriptor.name,
			descriptor.format,
			descriptor.size,
			content,
			!iconExists
		);
	}
};

const importIcons = async (): Promise<any> => {
	logger.info("Start importing from %s", sourceDir);
	const iconfileData = await iconfileCollector();

	const enqueueJob = await getSerializer("I M P O R T");

	await enqueueJob(async () => { await readAndUploadIconfile(iconfileData); });
};

configuration
	.then(
		async configProvider => await startTestServer(configProvider)
	)
	.then(
		async server => {
			await importIcons()
				.then(
					async () => { await server.shutdown(); }
				);
		}
	)
	.then(
		() => {
			logger.info("Import finshed");
			process.exit(0);
		}
	).catch(error => {
		logger.error(strformat("Importing icons failed: %o", error));
		process.exit(1);
	});
