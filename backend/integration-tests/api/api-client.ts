import * as superagent from "superagent";
import { Observable, Observer } from "rxjs";
import { IconDTO } from "../../src/iconsHandlers";
import { List } from "immutable";

export const describeAllIcons: (baseUrl: string, auth: Auth) => Observable<List<IconDTO>>
= (baseUrl, auth) => Observable.create((observer: Observer<List<IconDTO>>) => {
    superagent
        .get(`${baseUrl}/icons/`)
        .auth(auth.user, auth.password)
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

export const describeIcon: (baseUrl: string, iconName: string) => Observable<IconDTO>
= (baseUrl, iconName) => Observable.create((observer: Observer<boolean>) => {
    superagent
        .get(`${baseUrl}/icons/${iconName}`)
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
    baseUrl: string,
    auth: Auth,
    iconName: string,
    format: string,
    size: string) => Observable<Buffer>
= (baseUrl, auth, iconName, format, size) => Observable.create((observer: Observer<Buffer>) => {
    superagent
        .get(`${baseUrl}/icons/${iconName}/formats/${format}/sizes/${size}`)
        .auth(auth.user, auth.password)
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
