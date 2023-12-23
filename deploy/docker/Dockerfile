FROM node:lts-slim

LABEL Name="iconrepo"
LABEL Version="1.0.0"

RUN useradd -u 1101 -m --shell /bin/false iconrepo

RUN apt-get update -y && apt-get install git -y
WORKDIR /usr/src/app
COPY build/ ./
COPY package.json package-lock.json ./
WORKDIR /usr/src/app/src
RUN npm ci --omit=dev
EXPOSE 8080

RUN mkdir /data
RUN chown iconrepo /data

VOLUME ["/data"]

USER iconrepo

CMD [ "node", "app.js" ]
