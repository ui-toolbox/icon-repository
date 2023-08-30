import type * as http from "http";
import iconHandlersProvider from "../../src/icons-handlers";
import { getTestRepoDir, deleteTestGitRepo } from "../git/git-test-utils";
import { type Iconfile } from "../../src/icon";
import { createTestConfiguration } from "../service/service-test-utils";
import { createLogger } from "../../src/utils/logger";
import { createDefaultIconService } from "../../src/app-assembly";
import { makeSureHasUptodateSchemaWithNoData } from "../db/db-test-utils";
import { createPool, createConnectionProperties } from "../../src/db/db";
import { getDefaultConfiguration } from "../../src/configuration";
import { type AddressInfo } from "net";
import _, { isNil } from "lodash";
import { type Auth, getIconfile, type RequestBuilder, type RequestResult } from "./api-client";
import { type Server, createServer } from "../../src/server";

const logger = createLogger("api-test-utils");

export const uxAuth: Auth = { user: "ux", password: "ux" };
export const devAuth: Auth = { user: "dev", password: "dev" };

export const defaultAuth: Auth = { user: "ux", password: "ux" };

type StartServer = (customServerConfig: any) => Promise<Server>;

let localServerRef: Server | undefined;

export const startTestServer: StartServer = async customConfig => {
	logger.debug("Test server is being started");
	const testConfiguration = await createTestConfiguration({
		...customConfig,
		icon_data_location_git: getTestRepoDir(),
		icon_data_create_new: true
	});
	const iconService = await createDefaultIconService(testConfiguration);
	const server = await createServer(testConfiguration, iconHandlersProvider(iconService));
	if (!isNil(localServerRef)) {
		logger.warn("server is already initialized");
		throw new Error("server is already initialized");
	} else {
		localServerRef = server;
		return server;
	}
};

const startTestServerWithBackdoors = async (): Promise<Server> => await startTestServer({ enable_backdoors: true });

export const shutdownDownServer = async (): Promise<void> => {
	if (!isNil(localServerRef)) {
		try {
			await localServerRef.shutdown();
			localServerRef = undefined;
		} catch (err) {
			logger.error("Error during shutdown: %o", err);
		}
	}
};

const tearDownGitRepoAndServer = async (): Promise<void> => {
	delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
	try {
		await deleteTestGitRepo();
		await shutdownDownServer();
	} catch (error) {
		logger.error("Error during tear-down: %os", error);
	}
};

type UploadField = Record<string, string>;

interface FileAttachment {
	readonly name: string
	readonly value: Buffer
	readonly filename: string
}

interface RequestData {
	readonly baseUrl?: string
	readonly method?: "GET" | "PATCH" | "POST" | "PUT" | "DELETE"
	readonly path?: string
	readonly auth?: Auth
	readonly responseValidator?: (response: Response) => boolean
	readonly field?: UploadField
	readonly fileAttachment?: FileAttachment
	readonly respBodyAsBuffer?: boolean
	readonly cookies?: string
}

class RequestBuilderImpl implements RequestBuilder {
	private readonly data: RequestData;

	constructor (
		data: RequestData,
		private readonly setCookies: (cookie: string) => void
	) {
		this.data = {
			responseValidator: (response: Response) => response.status >= 100 && response.status < 300,
			method: "GET",
			...data
		};
	}

	public get = (path: string): RequestBuilder => new RequestBuilderImpl({ ...this.data, method: "GET", path }, this.setCookies);
	public patch = (path: string): RequestBuilder => new RequestBuilderImpl({ ...this.data, method: "PATCH", path }, this.setCookies);
	public post = (path: string): RequestBuilder => new RequestBuilderImpl({ ...this.data, method: "POST", path }, this.setCookies);
	public put = (path: string): RequestBuilder => new RequestBuilderImpl({ ...this.data, method: "PUT", path }, this.setCookies);
	public del = (path: string): RequestBuilder => new RequestBuilderImpl({ ...this.data, method: "DELETE", path }, this.setCookies);
	public baseUrl = (url: string): RequestBuilder => new RequestBuilderImpl({ ...this.data, baseUrl: url }, this.setCookies);
	public auth = (username: string, password: string): RequestBuilder => new RequestBuilderImpl({ ...this.data, auth: { user: username, password } }, this.setCookies);
	public ok = (responseValidator: (resp: Response) => boolean): RequestBuilder => new RequestBuilderImpl({ ...this.data, responseValidator }, this.setCookies);

	public field = (fieldSpec: Record<string, string>): RequestBuilder => new RequestBuilderImpl({ ...this.data, field: fieldSpec }, this.setCookies);

	public attach = (name: string, value: Buffer, filename: string): RequestBuilder => new RequestBuilderImpl({
		...this.data,
		fileAttachment: { name, value, filename }
	}, this.setCookies);

	public buffer = (on: boolean): RequestBuilder => new RequestBuilderImpl({ ...this.data, respBodyAsBuffer: on }, this.setCookies);

	public send = async (json?: any): Promise<RequestResult> => {
		const headers = new Headers();

		if (!_.isNil(this.data.auth)) {
			headers.set("Authorization", "Basic " + Buffer.from(this.data?.auth?.user + ":" + this.data?.auth?.password).toString("base64"));
		}

		if (!_.isNil(this.data.cookies)) {
			headers.set("cookie", this.data.cookies);
		}

		let body;

		if (!isNil(this.data.fileAttachment)) {
			const attachment = this.data.fileAttachment;
			const data = new FormData();
			data.append("iconfile", new Blob([attachment.value]), attachment.filename);
			data.append("iconName", this.data.field?.iconName);
			body = data;
		} else if (!isNil(json)) {
			headers.append("Content-Type", "application/json");
			body = JSON.stringify(json);
		}

		const url = `${this.data.baseUrl}${this.data.path}`;
		logger.info("#RequestBuilderImpl.send(): %s %s...", this.data.method, url);
		logger.debug("#RequestBuilderImpl.send(): body: %o, (%s %s)...", body, this.data.method, url);

		const response = await fetch(url, {
			method: this.data.method,
			headers,
			credentials: "include",
			redirect: "manual",
			body
		});

		if (!_.isNil(this.setCookies)) {
			const parsedCookies = parseCookies(response);
			if (!_.isNil(parsedCookies)) {
				this.setCookies(parsedCookies);
			}
		}

		const responseContentType = response.headers.get("content-type");
		logger.debug(
			"#RequestBuilderImpl.send(): HTTP status: %d, Response Content-Type: %s, (%s %s)",
			response.status, responseContentType, this.data.method, url
		);
		const responseBody = !_.isNil(responseContentType) && responseContentType.startsWith("application/json")
			? await response.json()
			: await response.text();

		if (response.status === 302 || isNil(this.data?.responseValidator) || this.data.responseValidator(response)) {
			return {
				status: response.status,
				body: responseBody,
				error: undefined
			};
		}
		logger.error("Invalid response: %o", responseBody);
		throw new Error("Invalid repsonse");
	};
}

export class Session {
	private static readonly defaultResponseValidator = (resp: Response): boolean => resp.status < 400;
	private readonly baseUrl: string;
	private readonly responseValidator: (resp: Response) => boolean;
	private parsedCookies: string;

	constructor (
		baseUrl: string,
		responseValidator: ((resp: Response) => boolean) | undefined
	) {
		this.baseUrl = baseUrl;
		this.responseValidator = responseValidator ?? Session.defaultResponseValidator;
	}

	public request (requestData?: RequestData): RequestBuilder {
		return new RequestBuilderImpl({ baseUrl: this.baseUrl, cookies: this.parsedCookies, ...requestData }, (cookie: string) => {
			this.parsedCookies = cookie;
		});
	}

	public async loginWithAllPrivileges (): Promise<void> {
		await this.request({ auth: uxAuth }).get("/login").send();
	}
};

export const getBaseUrl = (): string => `http://localhost:${localServerRef?.address().port}`;
export const getBaseURLBasicAuth = (
	server: http.Server,
	auth: string
): string => `http://${auth}@localhost:${(server.address() as AddressInfo).port}`;

export const getCheckIconfile = async (session: Session, iconfile: Iconfile): Promise<boolean> => {
	const buffer = await getIconfile(
		session.request(),
		iconfile.name,
		{
			format: iconfile.format, size: iconfile.size
		}
	);
	const diff = Buffer.compare(iconfile.content, buffer);
	expect(diff).toEqual(0);
	return diff === 0;
};

export const iconEndpointPath = "/icon";
export const iconfileEndpointPath = "/icon/:id/format/:format/size/:size";
export const manageTestResourcesBeforeAndAfter = (): () => Session => {
	beforeEach(async () => {
		try {
			logger.debug("#manageTestResourcesBeforeAndAfter: creating temporary pool...");
			const pool = await createPool(createConnectionProperties(getDefaultConfiguration()));
			try {
				logger.debug("#manageTestResourcesBeforeAndAfter: getting schema ready...");
				await makeSureHasUptodateSchemaWithNoData(pool);
			} finally {
				logger.debug("#manageTestResourcesBeforeAndAfter: closing temporary pool...");
				await pool.end();
			}
			logger.debug("#manageTestResourcesBeforeAndAfter: staring test server...");
			await startTestServerWithBackdoors();
		} catch (error) {
			logger.error("error in beforeEach: %o", error);
			process.exit(1);
		}
	});
	afterEach(async () => { await tearDownGitRepoAndServer(); });
	return () => new Session(getBaseUrl(), undefined);
};

const parseCookies = (response: Response): string | null => {
	const raw = response.headers.getSetCookie();
	return raw.length === 0
		? null
		: raw.map((entry) => {
			const parts = entry.split(";");
			const cookiePart = parts[0];
			return cookiePart;
		}).join(";");
};
