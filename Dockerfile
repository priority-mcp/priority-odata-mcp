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
# Debian 13 base: ships OpenSSL 3.5.x / glibc 2.41 (the debian12 image is stuck on vulnerable
# libssl3 3.0.18 / libc6 2.36-9+deb12u13). Pinned by digest; bump deliberately (see #3).
############################
FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:4e4fb0ce55fd73901600796ef079a9490369d2515d7da31633a91608c82ca13b

WORKDIR /app

ENV NODE_ENV=production

# Only what the server needs at runtime: the built bundle + prod node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Distroless nonroot image defaults to uid 65532; make USER explicit for scanners (DS-0002).
USER nonroot

# distroless nodejs image's entrypoint is already "node"
CMD ["dist/index.js"]
