import { List } from 'immutable';
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

export const renameIcon = (oldName, newName) => fetch(getEndpointUrl(`/icons/${oldName}`), {
    method: 'PUT',
    headers: {
        "Content-Type": "application/json; charset=utf-8"
    },
    credentials: 'include',
    body: JSON.stringify({name: newName})
})
.then(response => {
    if (response.status !== 204) {
        return throwError('Failed to rename icon', response);
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

export const addIconfile = (iconName, format, size, formData) => fetch(
    getEndpointUrl(`/icons/${iconName}/formats/${format}/sizes/${size}`),
    {
        method: 'POST',
        credentials: 'include',
        body: formData
    }
)
.then(response => {
    if (response.status !== 201) {
        return throwError('Failed to add icon-file', response);
    }
})

export const deleteIconfile = iconfilePath => fetch(getEndpointUrl(iconfilePath), {
    method: 'DELETE',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 204) {
        return throwError('Failed to delete icon file', response);
    }
});

export const createIconfileList = iconPaths =>
    List(Object.keys(iconPaths))
    .flatMap(format => Object.keys(iconPaths[format])
        .map(size => {
            const path = iconPaths[format][size];
            const url = getEndpointUrl(path);
            return { format, size, path, url };
        }))
    .toArray();
