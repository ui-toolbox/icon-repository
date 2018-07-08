const fetchIconRepositorConfig = (baseUrl) => {
    return fetch(`${baseUrl}/icons/config`, {
        method: 'GET',
        credentials: 'include',
    })
    .then(response => {
        if (response.status < 200 || response.status >= 300) {
            throw new Error('Failed to get the icon repository configuration');
        }
        return response.json();
    });
}

module.exports = fetchIconRepositorConfig;
