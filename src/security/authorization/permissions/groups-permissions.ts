export enum Permission {
	CREATE_ICON = "CREATE_ICON",
	UPDATE_ICON = "UPDATE_ICON",
	ADD_ICONFILE = "ADD_ICONFILE",
	REMOVE_ICONFILE = "REMOVE_ICONFILE",
	REMOVE_ICON = "REMOVE_ICON",
	ADD_TAG = "ADD_TAG",
	REMOVE_TAG = "REMOVE_TAG"
};

export const permissionsByGroup: Record<string, Permission[]> = {
	ICON_EDITOR: [
		Permission.CREATE_ICON,
		Permission.UPDATE_ICON,
		Permission.ADD_ICONFILE,
		Permission.REMOVE_ICONFILE,
		Permission.REMOVE_ICON,
		Permission.ADD_TAG,
		Permission.REMOVE_TAG
	]
};
