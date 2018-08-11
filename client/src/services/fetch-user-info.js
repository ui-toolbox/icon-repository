import { List } from 'immutable';
import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

export default () => fetch(getEndpointUrl('/user'), {
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
);
