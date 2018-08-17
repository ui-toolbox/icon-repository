import { List } from 'immutable';
import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

const privilegDictionary = Object.freeze({
    CREATE_ICON: "CREATE_ICON",
    ADD_ICON_FILE: "ADD_ICON_FILE",
    REMOVE_ICON_FILE: "REMOVE_ICON_FILE",
    REMOVE_ICON: "REMOVE_ICON"
});

export const initialUserInfo = () => ({
    authenticated: false,
    username: 'John Doe',
    privileges: List()
});

export const fetchUserInfo = () => fetch(getEndpointUrl('/user'), {
    method: 'GET',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 200) {
        return throwError('Failed to get user info', response);
    } else {
        return response.json();
    }
})
.then(
    json => {
        json.privileges = List(json.privileges);
        json.authenticated = true;
        return json;
    }
)

export const hasAddIconPrivilege = user => user.privileges && user.privileges.contains(privilegDictionary.CREATE_ICON);
export const hasUpdateIconPrivilege = user => user.privileges && user.privileges.contains(privilegDictionary.REMOVE_ICON);
