import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

export default formData => fetch(getEndpointUrl("/icons"), {
    method: 'POST',
    credentials: 'include',
    body: formData
})
.then(response => {
    if (response.status !== 201) {
        return throwError('Failed to create icon', response);
    }
});
