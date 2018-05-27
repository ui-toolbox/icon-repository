# Minimal DEV environment
To start the fronted, in the `client` subdirectory execute:

`npm install && npm run dev`

To start the backend, in the `backend` subdirectory execute:
* `export ICON_DATA_LOCATION_GIT=<path-to-the-icon-data>`
* `npm run dev`

where `<path-to-the-icon-data>` should point to a local copy of the icon data repository. For example:

`export ICON_DATA_LOCATION_GIT=/Users/pkovacs/tmp/ux/icon-repository/icons`.

In case you specify a configuration file (using the `ICON_REPO_CONFIG_FILE` environment variable), you can achieve the same effect with the `icon_data_location_git` property there as with the ICON_DATA_LOCATION_GIT environment variable.
