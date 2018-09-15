import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

export const iconfileTypes = Object.freeze({
    svg: [
        "18px", "24px", "48px"
    ],
    png: [
        "18dp", "24dp", "36dp", "48dp", "144dp"
    ]
});

let appInfo;

const clone = obj => JSON.parse(JSON.stringify(obj));

export const getAppInfo = () => clone(appInfo);

const getConfigFromService = path => 
    fetch(getEndpointUrl(path), {
        method: 'GET',
        credentials: 'include',
    })
    .then(response => {
        if (response.status !== 200) {
            return throwError('Failed to get the icon repository configuration', response);
        } else {
            return response.json();
        }
    })

const fetchAppInfo = () =>
    getConfigFromService('/app-info')
    .then(
        info => appInfo = info
    );

export const fetchConfig = () => fetchAppInfo();

export const defaultTypeForFile = fileName => {
    const formats = Object.keys(iconfileTypes);
    const filenameExtension = fileName.split('.').pop();
    let format = null;
    let size = null;
    if (formats.includes(filenameExtension)) {
        format = filenameExtension;
        size = iconfileTypes[filenameExtension][0];
    }
    return {
        format,
        size
    };
}
