import * as http from "http";
import { Observable } from "rxjs";

import configuration from "../../src/configuration";
import { ConfigurationData } from "../../src/configuration";
import iconDAFsProvider, { createConnectionProperties } from "../../src/db/db";
import gitProvider from "../../src/git";
import serverProvider from "../../src/server";
import { Server } from "http";
import iconServiceProvider from "../../src/iconsService";
import iconHandlersProvider from "../../src/iconsHandlers";
import logger from "../../src/utils/logger";
import { getTestRepoDir, deleteTestGitRepo } from "../git/git-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { Auth, getIconFile } from "./api-client";
import { SuperAgent, SuperAgentRequest, agent, Response } from "superagent";
import { IconFile } from "../../src/icon";

logger.setLevel("silly");

type StartServer = (customServerConfig: any) => Observable<Server>;

export const defaultTestServerconfig = Object.freeze({
    authentication_type: "basic"
});

let localServerRef: Server;

export const startServer: StartServer = customConfig => {
    return configuration
    .flatMap(configurationProvider => {
        const configData: ConfigurationData = Object.assign(
            Object.assign(
                configurationProvider(),
                defaultTestServerconfig
            ),
            Object.assign(customConfig, {server_port: 0})
        );
        return iconServiceProvider(
            {
                resetData: "always"
            },
            iconDAFsProvider(createConnectionProperties(configData)),
            gitProvider(configData.icon_data_location_git)
        )
        .flatMap(iconService => {
            const iconHandlers = iconHandlersProvider(iconService);
            return serverProvider(() => configData, iconHandlers);
        })
        .map(server => {
            localServerRef = server;
            return server;
        });
    });
};

export const startServerWithBackdoors: StartServer = customConfig =>
    startServer(Object.assign(customConfig, {enable_backdoors: true}));

export const startTestServer = (done: () => void) =>
    startServerWithBackdoors({icon_data_location_git: getTestRepoDir()})
    .subscribe(boilerplateSubscribe(fail, done));

export const tearDownGitRepoAndServer = (server: Server, done: () => void) => {
    delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
    deleteTestGitRepo()
        .map(() => server.close())
    .subscribe(boilerplateSubscribe(fail, done));
};

export class Session {
    private static readonly defaultResponseValidator = (resp: Response) => resp.status < 400;
    private readonly baseUrl: string;
    private readonly session: SuperAgent<SuperAgentRequest>;
    private readonly authInfo: Auth;
    private readonly responseValidator: (resp: Response) => boolean;

    constructor(
        baseUrl: string,
        session: SuperAgent<SuperAgentRequest>,
        authInfo: Auth,
        responseValidator: (resp: Response) => boolean
    ) {
        this.baseUrl = baseUrl;
        this.session = session;
        this.authInfo = authInfo || defaultAuth;
        this.responseValidator = responseValidator || Session.defaultResponseValidator;
    }

    public auth(auth: Auth) {
        return new Session(this.baseUrl, this.session, auth, this.responseValidator);
    }

    public responseOK(validator: (resp: Response) => boolean) {
        return new Session(this.baseUrl, this.session, this.authInfo, validator);
    }

    public requestBuilder() {
        return ({
            get: (path: string) => this.addConfig(this.session.get(`${this.baseUrl}${path}`)),
            post: (path: string) => this.addConfig(this.session.post(`${this.baseUrl}${path}`).ok(() => true)),
            put: (path: string) => this.addConfig(this.session.put(`${this.baseUrl}${path}`).ok(() => true)),
            del: (path: string) => this.addConfig(this.session.del(`${this.baseUrl}${path}`).ok(() => true))
        });
    }

    private addConfig(req: SuperAgentRequest) {
        if (this.authInfo) {
            req = req.auth(this.authInfo.user, this.authInfo.password);
        }
        if (this.responseValidator) {
            req = req.ok(this.responseValidator);
        }
        return req;
    }
}

export const manageTestResourcesBeforeAndAfter: () => () => Session = () => {
    beforeEach(done => startTestServer(done));
    afterEach(done => tearDownGitRepoAndServer(localServerRef, done));
    return () => new Session(getBaseUrl(), agent(), void 0, void 0);
};

export const getBaseUrl = () => `http://localhost:${localServerRef.address().port}`;
export const getBaseURLBasicAuth = (
    server: http.Server,
    auth: string) => `http://${auth}@localhost:${server.address().port}`;

export const uxAuth: Auth = {user: "ux", password: "ux"};
export const devAuth: Auth = {user: "dev", password: "dev"};

export const defaultAuth: Auth = {user: "ux", password: "ux"};

export const getCheckIconFile: (session: Session, iconFile: IconFile) => Observable<any>
    = (session, iconFile) => getIconFile(
        session.requestBuilder(),
        iconFile.name,
        {
            format: iconFile.format, size: iconFile.size
        }
    )
    .map(buffer => expect(Buffer.compare(iconFile.content, buffer)).toEqual(0));

export const iconEndpointPath = "/icons";
export const iconFileEndpointPath = "/icons/:id/formats/:format/sizes/:size";
