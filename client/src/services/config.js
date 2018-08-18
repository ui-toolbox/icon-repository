import getEndpointUrl from '@/services/url';
import { throwError } from '@/services/errors';

let iconRepoConfig;
let appInfo;

const clone = obj => JSON.parse(JSON.stringify(obj));

export const getConfig = () => clone(iconRepoConfig);
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

const fetchIconRepoConfig = () =>
    getConfigFromService('/icons/config')
    .then(
        config => iconRepoConfig = config
    );

const fetchAppInfo = () =>
    getConfigFromService('/app-info')
    .then(
        info => appInfo = info
    );

export const fetchConfig = () =>
    fetchAppInfo()
    .then(
        () => fetchIconRepoConfig()
    );
