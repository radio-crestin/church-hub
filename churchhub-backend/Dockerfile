# churchhub-backend on Node (src/node/server.ts), as a container.
# Build: docker buildx build --platform linux/amd64 -t <image> churchhub-backend
# The runtime stage only copies files (no RUN), so an arm64 host builds the
# amd64 image without emulation; the bundle is plain JavaScript.

# Bundle the server into one ESM file, on the build machine's own platform.
FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.node.json ./
COPY src ./src
RUN npm run build:node

# Distroless Node 24: no shell, no package manager, runs as nonroot (65532).
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:675c532423b908f9e56f9d60a4e62309b63cd2a3175acb90a46b96f7ee68e121
WORKDIR /app
COPY --from=build /src/dist/server.mjs ./server.mjs
USER 65532:65532
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0
EXPOSE 8787
CMD ["server.mjs"]
