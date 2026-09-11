# syntax=docker/dockerfile:1

############################
# Stage 1 — builder
############################
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install ALL deps (incl. esbuild devDependency) for the build
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# Copy source and build the bundle (esbuild -> dist/index.js, +config +data)
COPY . .
RUN npm run build

# Now install ONLY production deps into a clean node_modules for the runtime.
# esbuild marks all deps external, so the runtime needs them present.
RUN rm -rf node_modules && npm ci --omit=dev

############################
# Stage 2 — runtime (distroless, no npm / no shell / no apt)
############################
FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

ENV NODE_ENV=production

# Only what the server needs at runtime: the built bundle + prod node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# distroless nodejs image's entrypoint is already "node"
CMD ["dist/index.js"]
