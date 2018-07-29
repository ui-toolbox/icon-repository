import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

export default iconName => fetch(getEndpointUrl(`/icons/${iconName}`), {
    method: 'DELETE',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 204) {
        return throwError('Failed to delete icon', response);
    }
});
