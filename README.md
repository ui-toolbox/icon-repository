# Icon Repository

A web application for UI/UX designers and frontend developers to manage and expolore a library of icons. A distinctive feature of the application is to provide the ability to attach rich, structured, queryable metainformation to the assets in the library while these assets are also published to a git repository designed to be accessed by (automated) build systems.

Enabling consumer-developers (users of the applicatioin) to give effective feed-back on the content is also on the roadmap.

# Setting up the DEV environment

1. Setup and start the database

    1. Install docker (https://store.docker.com/search?type=edition&offering=community)

    1. Optional (for hardened security):
        - create an OS user dedicated to running the database
        - replace `id -u` and `id -g` in the `docker run` command below with the dedicated user's id and group id respectively

    1. Start the database by executing:
        ```
        sudo docker run \
            --name pg-iconrepo \
            -d \
            -p 5432:5432 \
            nightmanager/postgres_10 \
            --pg-cluster-owner-userid `id -u` \
            --pg-cluster-owner-groupid `id -g` \
            --pg-db-owner-name iconrepo \
            --pg-db-owner-password iconrepo \
            --pg-db-name iconrepo \
            --pg-log-statements
        ```
1. Install the backend npm dependencies:

    1. In case you have a private (e.g. your company's) `npm` configuration in place, replace it with a blank one:

        `test ! -f ~/.npmrc-saved && mv ~/.npmrc ~/.npmrc-saved && touch ~/.npmrc`

        (The above command saves the original config as `~/.npmrc-saved`)

    1. Go to the `backend` subdirectory of the local code repository and install/update the `npm` packages:

        `cd backend && npm install && npm upgrade`

1. Import the demo data (optional, but recommended for frontend development)

   `export CREATE_NEW_DB=yes; npm run dev:import`

1. Start the backend

    `npm run dev`

1. Start the frontend in the `client` subdirectory by executing:

    `npm install && npm run dev`
