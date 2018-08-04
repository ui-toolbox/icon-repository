import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

export const describeIcon = iconName => fetch(getEndpointUrl(`/icons/${iconName}`), {
    method: 'GET',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 200) {
        return throwError('Failed to describe icon', response);
    } else {
        return response.json();
    }
});

export const createIcon = formData => fetch(getEndpointUrl("/icons"), {
    method: 'POST',
    credentials: 'include',
    body: formData
})
.then(response => {
    if (response.status !== 201) {
        return throwError('Failed to create icon', response);
    }
});

export const deleteIcon = iconName => fetch(getEndpointUrl(`/icons/${iconName}`), {
    method: 'DELETE',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 204) {
        return throwError('Failed to delete icon', response);
    }
});

export const deleteIconfile = iconfilePath => fetch(getEndpointUrl(iconfilePath), {
    method: 'DELETE',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 204) {
        return throwError('Failed to delete icon file', response);
    }
});
