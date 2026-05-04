FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps --ignore-scripts && echo "NPM INSTALL: OK"

EXPOSE 3000

CMD ["echo", "install only test"]
