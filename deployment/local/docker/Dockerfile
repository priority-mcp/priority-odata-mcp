FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --include=optional

COPY . .

RUN npm run build

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]

