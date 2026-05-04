FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN node --version && npm --version && echo "Node OK"

RUN npm install --legacy-peer-deps --ignore-scripts 2>&1 | tail -5

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:all"]
