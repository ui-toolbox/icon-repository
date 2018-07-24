import { SuperAgentRequest } from "superagent";
import { Observable, Observer } from "rxjs";
import { IconDTO } from "../../src/iconsHandlers";
import { List } from "immutable";
import { IconFile, IconFileDescriptor, IconAttributes } from "../../src/icon";

export const authenticationBackdoorPath = "/backdoor/authentication";

export interface RequestBuilder {
    get: (path: string) => SuperAgentRequest;
    post: (path: string) => SuperAgentRequest;
    put: (path: string) => SuperAgentRequest;
    del: (path: string) => SuperAgentRequest;
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
    initialIconFile: IconFile)
=> Observable<number>
= (requestBuilder, initialIconFile) => Observable.create((observer: Observer<number>) =>
    requestBuilder
        .post("/icons")
        .field({name: initialIconFile.name})
        .field({format: initialIconFile.format})
        .field({size: initialIconFile.size})
        .attach(
            "icon",
            initialIconFile.content,
            `${initialIconFile.name}-${initialIconFile.size}.${initialIconFile.format}`
        )
        .then(
            result => {
                observer.next(result.body.id);
                observer.complete();
            },
            error => observer.error(error)
        )
        .catch(error => observer.error(error)));

export const updateIcon: (
    requestBuilder: RequestBuilder,
    oldIconName: string,
    newIcon: IconAttributes
) => Observable<void>
= (requestBuilder, oldIconName, newIcon) => Observable.create((observer: Observer<void>) =>
    requestBuilder
    .put(`/icons/${oldIconName}`)
    .send(newIcon)
    .then(
        result => {
            observer.next(void 0);
            observer.complete();
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error)));

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

export const addIconFile: (
    requestBuilder: RequestBuilder,
    iconFile: IconFile
) => Observable<number>
= (requestBuilder, iconFile) =>
    Observable.create((observer: Observer<number>) =>
        requestBuilder
        .post(`/icons/${iconFile.name}/formats/${iconFile.format}/sizes/${iconFile.size}`)
        .attach("icon", iconFile.content, `${iconFile.name}-${iconFile.size}.${iconFile.format}`)
        .then(
            result => {
                observer.next(result.body.id);
                observer.complete();
            },
            error => observer.error(error)
        )
        .catch(error => observer.error(error)));

export const updateIconFile: (
    requestBuilder: RequestBuilder,
    iconFile: IconFile
) => Observable<void>
= (requestBuilder, iconFile) =>
    Observable.create((observer: Observer<number>) =>
    requestBuilder
    .put(`/icons/${iconFile.name}/formats/${iconFile.format}/sizes/${iconFile.size}`)
    .attach("icon", iconFile.content, `${iconFile.name}-${iconFile.size}.${iconFile.format}`)
    .then(
        result => {
            observer.next(result.body.id);
            observer.complete();
        },
        error => observer.error(error)
    )
    .catch(error => observer.error(error)));

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
