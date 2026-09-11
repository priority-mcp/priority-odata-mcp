# Legacy local Dockerfile (node:18-slim).
# Prefer the repository-root Dockerfile (Node 22 multi-stage → distroless nonroot).
# Kept for reference only; docker-compose.yml builds from ../../Dockerfile.

FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --include=optional

COPY . .

RUN npm run build

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
