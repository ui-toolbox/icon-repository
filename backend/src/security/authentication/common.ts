import { Observable } from "rxjs";

export interface ICredentials {
    readonly username: string;
    readonly password: string;
}

export type AuthenticationDataSource = (credentials: ICredentials) => Observable<boolean>;
