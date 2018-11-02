import { SuperAgentRequest } from "superagent";
import { Observable, Observer } from "rxjs";
import { IconDTO } from "../../src/iconsHandlers";
import { List } from "immutable";
import { IconFileDescriptor, IconAttributes } from "../../src/icon";
import loggerFactory from "../../src/utils/logger";

export const authenticationBackdoorPath = "/backdoor/authentication";

export interface RequestBuilder {
    get: (path: string) => SuperAgentRequest;
    patch: (path: string) => SuperAgentRequest;
    post: (path: string) => SuperAgentRequest;
    put: (path: string) => SuperAgentRequest;
    del: (path: string) => SuperAgentRequest;
}

interface IconfileInfo {
    iconName: string;
    format: string;
    size: string;
    path: string;
}

export const getFilePath = (iconName: string, fileDescriptor: IconFileDescriptor) =>
    `/icons/${iconName}/formats/${fileDescriptor.format}/sizes/${fileDescriptor.size}`;

export const setAuth: (
    requestBuilder: RequestBuilder,
    privileges: string[],
    userName?: string
) => Observable<void>
= (requestBuilder, privileges) => Observable.create((observer: Observer<any>) => {
    const userName: string = "ux";
    requestBuilder
    .put(authenticationBackdoorPath)
    .auth(userName, "ux")
    .send({username: userName, privileges})
    .then(
        response => {
            observer.next(void 0);
            observer.complete();
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error));
});

export const describeAllIcons: (reqBuilder: RequestBuilder) => Observable<List<IconDTO>>
= reqBuilder => Observable.create((observer: Observer<List<IconDTO>>) => {
    const logger = loggerFactory("api-client: describe-all-icons");
    logger.info("START");
    reqBuilder
        .get(`/icons`)
        .then(
            response => {
                observer.next(List(response.body));
                observer.complete();
            },
            error => observer.error(error)
        )
        .catch(error => observer.error(error));
});

export interface Auth {
    readonly user: string;
    readonly password: string;
}

export const describeIcon: (reqBulder: RequestBuilder, iconName: string) => Observable<IconDTO>
= (reqBuilder, iconName) => Observable.create((observer: Observer<boolean>) => {
    reqBuilder
        .get(`/icons/${iconName}`)
        .ok(res => res.status === 200 || res.status === 404)
        .then(
            response => {
                switch (response.status) {
                    case 200:
                        observer.next(response.body);
                        break;
                    case 404:
                        observer.next(void 0);
                        break;
                    default:
                        observer.error(`Failed to query icon ${iconName}: ${response.error}`);
                        return;
                }
                observer.complete();
            },
            error => observer.error(error)
        )
        .catch(error => observer.error(error));
});

export const getIconFile: (
    requestBuilder: RequestBuilder,
    iconName: string,
    iconFileDesc: IconFileDescriptor) => Observable<Buffer>
= (requestBuilder, iconName, iconFileDesc) => Observable.create((observer: Observer<Buffer>) => {
    requestBuilder
        .get(getFilePath(iconName, iconFileDesc))
        .buffer(true)
        .then(
            response => {
                observer.next(Buffer.from(response.body, "binary"));
                observer.complete();
            },
            error => observer.error(error)
        )
        .catch(error => observer.error(error));
});

export const createIcon: (
    requestBuilder: RequestBuilder,
    iconName: string,
    initialIconfile: Buffer)
=> Observable<IconfileInfo>
= (requestBuilder, iconName, initialIconFile) => Observable.create((observer: Observer<number>) =>
    requestBuilder
        .post("/icons")
        .field({name: iconName})
        .attach(
            "icon",
            initialIconFile,
            `${iconName}`
        )
        .then(
            result => {
                observer.next(result.body);
                observer.complete();
            },
            error => observer.error(error)
        )
        .catch(error => observer.error(error)));

export const ingestIconfile: (
    requestBuilder: RequestBuilder,
    iconName: string,
    iconfileContent: Buffer) => Observable<IconfileInfo>
= (requestBuilder, iconName, iconfileContent) => Observable.create((observer: Observer<IconfileInfo>) =>
    requestBuilder
    .post(`/icons/${iconName}`)
    .attach(
        "icon",
        iconfileContent,
        `${iconName}`
    )
    .then(
        result => {
            observer.next(result.body);
            observer.complete();
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error)));

export const updateIcon: (
    requestBuilder: RequestBuilder,
    iconName: string,
    newIconAttributes: IconAttributes
) => Observable<void>
= (requestBuilder, iconName, newIconAttributes) => Observable.create((observer: Observer<void>) => {
    const logger = loggerFactory("api-client: describe-all-icons");
    logger.info("START");
    requestBuilder
    .patch(`/icons/${iconName}`)
    .send(newIconAttributes)
    .then(
        () => {
            logger.info("Got result");
            observer.next(void 0);
            observer.complete();
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error));
});

export const deleteIcon: (
    requestBuilder: RequestBuilder,
    iconName: string
) => Observable<void>
= (requestBuilder, iconName) => Observable.create((observer: Observer<void>) => {
    requestBuilder
    .del(`/icons/${iconName}`)
    .then(
        result => {
            observer.next(void 0);
            observer.complete();
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error));
});

export const deleteIconFile: (
    requestBuilder: RequestBuilder,
    iconName: string,
    iconFileDesc: IconFileDescriptor
) => Observable<void>
= (requestBuilder, iconName, iconFileDesc) => Observable.create((observer: Observer<void>) => {
    requestBuilder
    .del(`/icons/${iconName}/formats/${iconFileDesc.format}/sizes/${iconFileDesc.size}`)
    .then(
        result => {
            observer.next(void 0);
            observer.complete();
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error));
});
