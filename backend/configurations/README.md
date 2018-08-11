## Configuration for local dev testing with OIDC in the "/icons" context

(This description assumes Mac OS. Differences are marked for Ubuntu 18.04 where appropriate.)

### 1. Configure dnsmasq
`/usr/local/etc/dnsmasq.conf` (Ubuntu 18.04: `/etc/NetworkManager/dnsmasq.d/test.conf`):
```
address=/.test/127.0.0.1
```

### 2. Configure Apache
1. `/etc/apache2/extra/httpd-vhosts.conf` (Ubuntu 18.04: `/etc/apache2/sites-available/icon-repo-test.conf`)
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
2. Add `Listen 8080` (in `/etc/apache2/ports.conf` on Ubuntu 18.04)


Notes for Ubuntu 18.04:
- Replace `/private/var/log/apache2/` with `${APACHE_LOG_DIR}`
- `$ sudo a2enmod proxy`
- `$ sudo a2enmod proxy_http`
- `$ sudo a2enmod headers`
- `$ sudo a2ensite icon-repo-test`
- `$ sudo systemctl reload apache2`

### 3. Start the test Identity Provider (IP)
1. Download the code from https://github.com/pdkovacs/oauth2-in-action
2. Start the IP server by executing
```
npm run dev:authrzn
```

### 5. Start the icon-repository application to use "oidc" authentication
```
npm run dev:oidc
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
