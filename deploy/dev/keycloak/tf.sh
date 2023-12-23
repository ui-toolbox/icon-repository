#!/bin/bash

tf_command=$1

. ~/.keycloak.secrets
. ~/.iconrepo-nodejs.secrets
# export TF_LOG=DEBUG
terraform init &&
  terraform $tf_command -auto-approve \
    -var="tf_client_secret=$KEYCLOAK_TF_CLIENT_SECRET" \
    -var="client_secret=$ICONREPO_NODEJS_CLIENT_SECRET"
