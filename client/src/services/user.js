import { List } from 'immutable';

const privilegDictionary = Object.freeze({
    CREATE_ICON: "CREATE_ICON",
    ADD_ICON_FILE: "ADD_ICON_FILE",
    REMOVE_ICON_FILE: "REMOVE_ICON_FILE",
    REMOVE_ICON: "REMOVE_ICON"
});

export const initialUserInfo = () => ({
    authenticated: false,
    username: 'John Doe',
    privileges: List()
});

export const hasAddIconPrivilege = user => user.privileges && user.privileges.contains(privilegDictionary.CREATE_ICON);
