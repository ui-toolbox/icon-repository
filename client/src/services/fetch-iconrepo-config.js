import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

export default () => {
    return fetch(getEndpointUrl('/icons/config'), {
        method: 'GET',
        credentials: 'include',
    })
    .then(response => {
        if (response.status !== 200) {
            return throwError('Failed to get the icon repository configuration', response);
        } else {
            return response.json();
        }
    });
}
