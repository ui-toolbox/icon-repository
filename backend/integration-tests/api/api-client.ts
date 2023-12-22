import { type IconDTO } from "../../src/icons-handlers";
import { type IconfileDescriptor, type IconAttributes } from "../../src/icon";
import { createLogger } from "../../src/utils/logger";

export const authenticationBackdoorPath = "/backdoor/authentication";

export interface RequestBuilder {
	readonly get: (path: string) => RequestBuilder
	readonly patch: (path: string) => RequestBuilder
	readonly post: (path: string) => RequestBuilder
	readonly put: (path: string) => RequestBuilder
	readonly del: (path: string) => RequestBuilder
	readonly baseUrl: (url: string) => RequestBuilder
	readonly auth: (username: string, password: string) => RequestBuilder
	readonly ok: (responseValidator: (resp: Response) => boolean) => RequestBuilder
	readonly field: (fieldSpec: Record<string, string>) => RequestBuilder
	readonly attach: (name: string, value: Buffer, filename: string) => RequestBuilder
	readonly buffer: (on: boolean) => RequestBuilder
	readonly send: (json?: any) => Promise<RequestResult>
}

export interface RequestResult {
	readonly body: any
	readonly status: number
	readonly error: any
}

interface IconfileInfo {
	iconName: string
	format: string
	size: string
	path: string
}

export const getFilePath = (iconName: string, fileDescriptor: IconfileDescriptor): string =>
	`/icon/${iconName}/format/${fileDescriptor.format}/size/${fileDescriptor.size}`;

export const setAuth = async (
	rb: RequestBuilder,
	permissions: string[],
	userName: string = "ux"
): Promise<void> => {
	const logger = createLogger("api-client: setAuth");
	logger.info("START");
	await rb
		.put(authenticationBackdoorPath)
		.send({ username: userName, permissions });
};

export const describeAllIcons = async (reqBuilder: RequestBuilder): Promise<IconDTO[]> => {
	const logger = createLogger("api-client: describeAllIcons");
	logger.info("START");
	const response = await reqBuilder.get("/icon").send();
	return response.body;
};

export interface Auth {
	readonly user: string
	readonly password: string
}

export const describeIcon = async (reqBuilder: RequestBuilder, iconName: string): Promise<IconDTO> => {
	const response = await reqBuilder
		.get(`/icon/${iconName}`)
		.ok(res => res.status === 200 || res.status === 404)
		.send();
	switch (response.status) {
		case 200:
			return response.body;
		case 404:
			return response.body;
		default:
			throw new Error(`Failed to query icon ${iconName}: ${response.error.message}`);
	}
};

export const getIconfile = async (
	rb: RequestBuilder,
	iconName: string,
	iconfileDesc: IconfileDescriptor): Promise<Buffer> => {
	const response = await rb
		.get(getFilePath(iconName, iconfileDesc))
		.buffer(true)
		.send();
	return Buffer.from(response.body as string, "binary");
};

export const createIcon = async (
	rb: RequestBuilder,
	iconName: string,
	initialIconfile: Buffer
): Promise<IconDTO> => {
	const logger = createLogger("api-client#createIcon");
	logger.debug("about to GET /icon...");
	const response = await rb
		.post("/icon")
		.field({ iconName })
		.attach(
			"iconfile",
			initialIconfile,
			`${iconName}`
		)
		.send();
	logger.debug("response.body: %o", response.body);
	return response.body;
};

export const ingestIconfile = async (
	rb: RequestBuilder,
	iconName: string,
	iconfileContent: Buffer): Promise<IconfileInfo> => {
	const logger = createLogger("api-client#ingestIconfile");
	logger.debug("ingestIconfile: '%s'", iconName);
	const response = await rb
		.post(`/icon/${iconName}`)
		.attach(
			"icon",
			iconfileContent,
			`${iconName}`
		)
		.send();
	logger.debug("ingestIconfile['%s']: response.body", iconName, response.body);
	return response.body;
};

export const updateIcon = async (
	rb: RequestBuilder,
	iconName: string,
	newIconAttributes: IconAttributes
): Promise<void> => {
	const logger = createLogger("api-client: updateIcon");
	logger.info("START");
	await rb
		.patch(`/icon/${iconName}`)
		.send(newIconAttributes);
	logger.info("Got result");
};

export const deleteIcon = async (
	rb: RequestBuilder,
	iconName: string
): Promise<void> => {
	const logger = createLogger("api-client: deleteIcon");
	logger.info("START");
	await rb
		.del(`/icon/${iconName}`)
		.send();
};

export const deleteIconfile = async (
	rb: RequestBuilder,
	iconName: string,
	iconfileDesc: IconfileDescriptor
): Promise<void> => {
	await rb
		.del(`/icon/${iconName}/format/${iconfileDesc.format}/size/${iconfileDesc.size}`)
		.send();
};

export const addTag = async (
	rb: RequestBuilder,
	iconName: string,
	tag: string
): Promise<void> => {
	await rb
		.post(`/icon/${iconName}/tag`)
		.send({ tag });
};

export const getTags = async (
	rb: RequestBuilder
): Promise<string[]> => {
	const response = await rb
		.get("/tag")
		.send(); ;
	return response.body;
};

export const removeTag = async (
	rb: RequestBuilder,
	iconName: string,
	tag: string
): Promise<void> => {
	await rb
		.del(`/icon/${iconName}/tag/${tag}`)
		.send();
};
