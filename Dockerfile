FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps --include=optional

COPY . .

ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN NODE_OPTIONS="--max-old-space-size=1536" npm run build

EXPOSE 3000

CMD ["npm", "run", "start:all"]
