import { Observable } from "rxjs";
import { Set } from "immutable";

export class Authentication {
    public readonly username: string;
    public readonly privileges: Set<string>;

    constructor(userName: string, privileges: Set<string>) {
        if (!userName || userName.length === 0) {
            throw new Error(`Invalide username/login: ${userName}`);
        }
        this.username = userName;
        this.privileges = privileges || Set();
    }

    public setPrivileges(privileges: Set<string>): Authentication {
        return new Authentication(this.username, privileges);
    }
}

export const storeAuthentication: (session: Express.Session, authentication: Authentication) => void
= (session, authentication) => session.authentication = authentication;

export const getAuthentication: (session: any) => Authentication
= session => session.authentication;

export type GetAllPrivilegesForUser = (userName: string) => Observable<Set<string>>;
