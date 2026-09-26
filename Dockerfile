# syntax=docker/dockerfile:1
# Stewardle production image.
#
# Stage 1 installs dev dependencies and builds; stage 2 is just Node and
# dist/ (the server bundle includes its dependencies, so no node_modules).
# Runtime contract: docs/runtime.md.

# Build on the native platform: the output is plain JavaScript, so one build
# serves every target architecture without emulating npm under QEMU.
FROM --platform=$BUILDPLATFORM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Behind a TLS-inspecting proxy, pass its CA bundle as a build secret:
#   docker build --secret id=extra_ca,src=/path/to/ca.pem .
# Without the secret this is a plain `npm ci`.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/dist ./dist
# The data directory must survive container restarts: mount a volume here.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5m \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/server/main.js"]
