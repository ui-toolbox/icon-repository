import { List } from 'immutable';
import * as user from '@/services/user';

export default userInfoUrl => fetch(userInfoUrl, {
    method: 'GET',
    credentials: 'include'
})
.then(response => {
    if (response.status < 200 || response.status >= 300) {
        throw new Error('Failed to get user info');
    }
    return response.json();
})
.then(
    json => {
        json.privileges = List(json.privileges);
        json.authenticated = true;
        return json;
    },
    error => {
        throw new Error('Failed to get user info: ', error);
    }
);
