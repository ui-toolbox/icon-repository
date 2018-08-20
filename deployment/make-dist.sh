#!/bin/bash -xe

# Mac OS: the following assumes you have executed
#     brew install coreutils
READLINK=$(greadlink --help >/dev/null 2>&1 && echo greadlink || echo readlink)

repo_root=$($READLINK -f $(dirname $0)/..)

dist_dir="${repo_root}/dist"

clean_dist() {
    rm -rf "$dist_dir" && \
        mkdir -p "$dist_dir"
}

dist_backend() {
    cd "${repo_root}/backend"
    mkdir -p "$dist_dir/backend/"
    npm install && \
        npm run build:backend && \
        cp -a package*.json "$dist_dir/backend/" && \
        cp -a build/src/* "$dist_dir/backend/" \
    || exit 1
    cd -
}

dist_frontend() {
    cd "${repo_root}/client"
    mkdir -p "$dist_dir/frontend/" 
    npm install && \
        rm -rf dist && \
        npm run build && \
        cp -a "${repo_root}"/client/dist/* "$dist_dir/frontend/" \
    || exit 1
    cd -
}

dist_all() {
    clean_dist && dist_backend && dist_frontend
}

pack() {
    dist_all && \
        cd "$dist_dir" && \
        tar -czf icon-repo-app.tgz --exclude '.DS_Store' backend frontend
}

# build_docker() {
#     dist_all && cd docker && docker build -t cxn/icon-repo-app .
# }

# start_docker() {
#     "pwd && ls -al && node app.js",
# }

pack
