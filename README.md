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
            -p 127.0.0.1:5432:5432 \
            nightmanager/postgres_10 \
            --pg-cluster-owner-userid `id -u` \
            --pg-cluster-owner-groupid `id -g` \
            --pg-db-owner-name iconrepo \
            --pg-db-owner-password iconrepo \
            --pg-db-name iconrepo \
            --pg-log-statements
        ```

1. Setup and start the backend
   
   1. Install the backend npm dependencies:

        `npm install`

   2. Import the demo data (optional, but recommended for frontend development)

      `npm run dev:import`

   3. Use a simple authN/authR setup:
      
      `export ICONREPO_CONFIG_FILE="${PWD}/configurations/dev.json"`

   4. Start the backend

       `npm run dev`

2. Setup and start the front end

    ```
    git clone git@github.com:pdkovacs/iconrepo-ui.git
    cd iconrepo-ui
    npm install && npm run dev
    ```

