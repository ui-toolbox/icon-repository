locals {
  keycloak_url = "http://keycloak:8080"
  client_id    = "iconrepo-nodejs"
  client_name  = "NodeJS backend for Icon Repository"
  app_hostname = "iconrepo-nodejs.local.com"
  # groups = [ "USERS", "PRIVILEGED_USERS" ]
}

terraform {
  required_providers {
    keycloak = {
      source = "mrparkers/keycloak"
      version = "4.2.0"
    }
  }
}

provider "keycloak" {
    client_id     = "terraform"
    client_secret = "${var.tf_client_secret}"
    url           = "${local.keycloak_url}"
}

data "keycloak_realm" "realm" {
    realm = "my-realm"
}

resource "keycloak_openid_client" "iconrepo_nodejs_client" {
  realm_id            = data.keycloak_realm.realm.id
  client_id           = "${local.client_id}"
  client_secret       = "${var.client_secret}"

  name                = "${local.client_name}"
  enabled             = true

  access_type         = "CONFIDENTIAL"
  valid_redirect_uris = [
    "http://${local.app_hostname}/*"
  ]
  standard_flow_enabled = true

  login_theme = "keycloak"
}

resource "keycloak_openid_group_membership_protocol_mapper" "iconrepo_nodejs_client_group_membership_mapper" {
  realm_id  = data.keycloak_realm.realm.id
  client_id = keycloak_openid_client.iconrepo_nodejs_client.id
  name      = "group-membership-mapper"

  claim_name = "groups"
  full_path = false
}

# resource "keycloak_group" "iconrepo_nodejs" {
#   count    = length(local.groups)
#   realm_id = data.keycloak_realm.realm.id
#   name     = local.groups[count.index]
# }

variable "tf_client_secret" {
  type = string
}

variable "client_secret" {
  type = string
}
