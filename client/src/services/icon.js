import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

export const describeAllIcons = () => fetch(getEndpointUrl(`/icon`), {
    method: 'GET',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 200) {
        return throwError('Failed to fetch icon descriptions', response);
    } else {
        return response.json();
    }
});

export const describeIcon = iconName => fetch(getEndpointUrl(`/icon/${iconName}`), {
    method: 'GET',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 200) {
        return throwError('Failed to fetch icon description', response);
    } else {
        return response.json();
    }
});

export const createIcon = formData => fetch(getEndpointUrl("/icon"), {
    method: 'POST',
    credentials: 'include',
    body: formData
})
.then(response => {
    if (response.status !== 201) {
        return throwError('Failed to create icon', response);
    } else {
        return response.json();
    }
});

export const ingestIconfile = (iconName, formData) => fetch(getEndpointUrl(`/icon/${iconName}`), {
    method: 'POST',
    credentials: 'include',
    body: formData
})
.then(response => {
    if (response.status !== 200) {
        return throwError('Failed to add icon file', response);
    } else {
        return response.json();
    }
});

export const renameIcon = (oldName, newName) => fetch(getEndpointUrl(`/icon/${oldName}`), {
    method: 'PATCH',
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

export const deleteIcon = iconName => fetch(getEndpointUrl(`/icon/${iconName}`), {
    method: 'DELETE',
    credentials: 'include'
})
.then(response => {
    if (response.status !== 204) {
        return throwError('Failed to delete icon', response);
    }
});

export const addIconfile = (iconName, format, size, formData) => fetch(
    getEndpointUrl(`/icon/${iconName}/format/${format}/size/${size}`),
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
    iconPaths
    .map(iconfile => ({
        format: iconfile.format,
        size: iconfile.size,
        path: iconfile.path,
        url: getEndpointUrl(iconfile.path)
    }));

export const preferredIconfileType = icon => {
    // If the icon has SVG format, prefer that
    const svgFiles = icon.paths.filter(iconfile => iconfile.format === 'svg');
    return svgFiles.length > 0
        ? svgFiles[0]
        : icon.paths[0];
}

export const urlOfIconfile = (icon, iconfileType) =>
    getEndpointUrl(icon.paths.filter(iconfile => iconfile.format === iconfileType.format && iconfile.size === iconfileType.size)[0].path);

export const preferredIconfileUrl = icon => urlOfIconfile(icon, preferredIconfileType(icon));

export const indexInIconfileListOfType = (iconfileList, iconfileType) =>
    iconfileList.findIndex(element => element.format === iconfileType.format && element.size === iconfileType.size);
