FROM node:carbon
WORKDIR /usr/src/app
COPY dist/ ./
WORKDIR /usr/src/app/backend
RUN npm install --only=production
VOLUME ["/usr/src/app/config", "/data/icons"]
EXPOSE 8080
RUN groupadd -g 999 icon-repo && \
    useradd -r -u 999 -g icon-repo icon-repo
USER icon-repo
CMD [ "npm", "run", "start:docker" ]
