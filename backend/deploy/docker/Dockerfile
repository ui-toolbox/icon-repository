FROM node:lts-slim
WORKDIR /usr/src/app
COPY build/ ./
COPY package.json package-lock.json ./
WORKDIR /usr/src/app/src
RUN npm ci --omit=dev
EXPOSE 8080
CMD [ "node", "app.js" ]
