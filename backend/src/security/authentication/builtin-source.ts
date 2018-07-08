import { Observable } from "rxjs";
import { List } from "immutable";
import { ICredentials, AuthenticationDataSource } from "./common";

const data: List<ICredentials> = List([
    {
        username: "ux",
        password: "ux"
    },
    {
        username: "dev",
        password: "dev"
    }
]);

const isEqual: (creds1: ICredentials, creds2: ICredentials) => boolean
= (creds1, creds2) => creds1.username === creds2.username && creds1.password === creds2.password;

const builtInAuthenticationDataSource: AuthenticationDataSource
= currentCredentials => Observable.of(!!data.find(creds => isEqual(creds, currentCredentials)));

export default builtInAuthenticationDataSource;
