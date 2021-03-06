import * as http from "http";
import { Observable } from "rxjs";
import { flatMap, map, finalize } from "rxjs/operators";

import serverProvider, { Server } from "../../src/server";
import iconHandlersProvider from "../../src/iconsHandlers";
import { getTestRepoDir, deleteTestGitRepo } from "../git/git-test-utils";
import { boilerplateSubscribe } from "../testUtils";
import { Auth, getIconfile } from "./api-client";
import { SuperAgent, SuperAgentRequest, agent, Response } from "superagent";
import { Iconfile } from "../../src/icon";
import { createTestConfiguration } from "../service/service-test-utils";
import loggerFactory from "../../src/utils/logger";
import { createDefaultIconService } from "../../src/app-assembly";
import { makeSureHasUptodateSchemaWithNoData, createTestPool } from "../db/db-test-utils";
import { createPool, createConnectionProperties } from "../../src/db/db";
import { getDefaultConfiguration } from "../../src/configuration";
import { AddressInfo } from "net";

const logger = loggerFactory("api-test-utils");

type StartServer = (customServerConfig: any) => Observable<Server>;

let localServerRef: Server;

export const startServer: StartServer = customConfig => {
    logger.debug("Test server is being started");
    return createTestConfiguration(customConfig)
    .pipe(
        flatMap(testConfiguration => createDefaultIconService(testConfiguration)
            .pipe(
                flatMap(iconService => serverProvider(testConfiguration, iconHandlersProvider(iconService))),
                map(server => {
                    if (localServerRef) {
                        logger.warn("server is already initialized");
                        throw new Error("server is already initialized");
                    } else {
                        localServerRef = server;
                        return server;
                    }
                })
            ))
    );
};

const startServerWithBackdoors: StartServer = customConfig =>
    startServer(Object.assign(customConfig, {enable_backdoors: true}));

const startTestServer = (done: () => void) =>
    startServerWithBackdoors({icon_data_location_git: getTestRepoDir()});

export const shutdownDownServer = () => {
    localServerRef.shutdown();
    localServerRef = undefined;
};

const tearDownGitRepoAndServer = (done: () => void) => {
    delete process.env.GIT_COMMIT_FAIL_INTRUSIVE_TEST;
    deleteTestGitRepo().pipe(map(() => shutdownDownServer()))
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
            patch: (path: string) => this.addConfig(this.session.patch(`${this.baseUrl}${path}`).ok(() => true)),
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
    beforeEach(done =>
        createPool(createConnectionProperties(getDefaultConfiguration()))
        .pipe(
            flatMap(pool => {
                return makeSureHasUptodateSchemaWithNoData(pool)
                .pipe(finalize(() => pool.end()));
            }),
            flatMap(() => startTestServer(done))
        )
        .subscribe(boilerplateSubscribe(fail, done))
    );
    afterEach(done => tearDownGitRepoAndServer(done));
    return () => new Session(getBaseUrl(), agent(), void 0, void 0);
};

export const getBaseUrl = () => `http://localhost:${localServerRef.address().port}`;
export const getBaseURLBasicAuth = (
    server: http.Server,
    auth: string
) => `http://${auth}@localhost:${(server.address() as AddressInfo).port}`;

export const uxAuth: Auth = {user: "ux", password: "ux"};
export const devAuth: Auth = {user: "dev", password: "dev"};

export const defaultAuth: Auth = {user: "ux", password: "ux"};

export const getCheckIconfile: (session: Session, iconfile: Iconfile) => Observable<any>
    = (session, iconfile) => getIconfile(
        session.requestBuilder(),
        iconfile.name,
        {
            format: iconfile.format, size: iconfile.size
        }
    )
    .pipe(map(buffer => expect(Buffer.compare(iconfile.content, buffer)).toEqual(0)));

export const iconEndpointPath = "/icon";
export const iconfileEndpointPath = "/icon/:id/format/:format/size/:size";
