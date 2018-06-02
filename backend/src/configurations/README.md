## Configuration for local dev testing with OIDC in the "/icons" context

### 1. Configure dnsmasq
`/usr/local/etc/dnsmasq.conf`:
```
address=/.test/127.0.0.1
```

### 2. Configure Apache
`/etc/apache2/extra/httpd-vhosts.conf`:
```
<VirtualHost *:80>
    ServerAdmin webmaster@dummy-host.example.com
    DocumentRoot "/usr/docs/dummy-host.example.com"
    ServerName dev.test
    ServerAlias www.dev.test
    ErrorLog "/private/var/log/apache2/dev.test-error_log"
    CustomLog "/private/var/log/apache2/dev.test-access_log" common

#    ProxyRequests Off
#    ProxyHTMLEnable On
    <Location /icons>
        ProxyPass        http://localhost:49160/icons
        ProxyPassReverse http://localhost:49160/icons
        RequestHeader set X-Forwarded-Proto "http"
#        ProxyHTMLURLMap ^/(.*)$ /icons/$1 R
    </Location>

</VirtualHost>

<VirtualHost *:8080>
    ServerAdmin webmaster@dummy-host.example.com
    DocumentRoot "/usr/docs/dummy-host.example.com"
    ServerName id-server.test
    ServerAlias www.id-server.test
    ErrorLog "/private/var/log/apache2/id-server.test-error_log"
    CustomLog "/private/var/log/apache2/id-server.test-access_log" common

    <Location />
        ProxyPass        http://localhost:9001/
        ProxyPassReverse http://localhost:9001/
        RequestHeader set X-Forwarded-Proto "http"
    </Location>
</VirtualHost>
```

### 3. Start the test Identity Provider (IP)
1. Download the code from https://github.com/pdkovacs/oauth2-in-action
2. Start the IP server by executing
```
npm run dev:authrzn
```

### 4. Set the configuration profile
```
export ICON_REPO_CONFIG_PROFILE=dev-oidc-wcontext
```

### 5. Start the application
```
npm run dev
```

## Configuration for local dev testing with OIDC in the "/icons" context with Docker

Pretty much as the above with the following additional step:

### 4. Build the docker image
```
npm run build:docker
```

### 5. Start the application by starting the container
```
docker rm -f icon-repo-app;
docker run \
    -v "$PWD/build/configurations:/usr/src/app/config" \
    -e "ICON_REPO_CONFIG_FILE=/usr/src/app/config/dev-oidc-wcontext-docker.json" \
    -v "$ICON_DATA_LOCATION_GIT:/data/icons" \
    -e "OIDC_CLIENT_ID=oauth-client-1" \
    -e "OIDC_CLIENT_SECRET=oauth-client-secret-1" \
    -p 49160:8080 \
    --name icon-repo-app \
    cxn/icon-repo-app
```

Note that on Mac the app may fail sometime with the following error:
```
oidcAuthentication#parseAuthorizationToken: Invalid payload.iat [ 1522519531 ]
```
If this happens, you have to restart the docker daemon (not just the container). See https://github.com/docker/for-mac/issues/2076#issuecomment-353313773
