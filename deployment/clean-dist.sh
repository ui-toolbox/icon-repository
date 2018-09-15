#!/bin/bash -xe

rm -rf dist \
    && rm -rf client/dist \
    && rm -rf client/node_modules \
    && rm -rf client/package-lock.json \
    && rm -rf backend/build \
    && rm -rf backend/node_modules \
    && rm -rf backend/package-lock.json
