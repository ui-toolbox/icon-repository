export const throwError = (messageIntro, response) => {
    return response.json().then(
        payloadError => {
            throw new Error(`${messageIntro}: ${payloadError.error}`);
        },
        error => { // reply is not a JSON
            throw new Error(`${messageIntro}: ${response.status} (${response.statusText})`);
        }
    )
};
