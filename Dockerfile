FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/renderer/package.json packages/renderer/package.json
COPY packages/templates/package.json packages/templates/package.json
RUN npm ci

COPY tsconfig.json tsconfig.base.json tsconfig.typecheck.json ./
COPY apps/backend apps/backend
COPY packages packages
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_FILE_NAME=file:/data/takt.db \
    DEFAULT_TIMEZONE=Europe/Moscow

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates fontconfig fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data \
    && chown node:node /data

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build --chown=node:node /app/apps/backend/dist ./apps/backend/dist
COPY --from=build --chown=node:node /app/apps/backend/drizzle ./apps/backend/drizzle
COPY --from=build --chown=node:node /app/packages/ui/package.json ./packages/ui/package.json
COPY --from=build --chown=node:node /app/packages/ui/dist ./packages/ui/dist
COPY --from=build --chown=node:node /app/packages/renderer/package.json ./packages/renderer/package.json
COPY --from=build --chown=node:node /app/packages/renderer/dist ./packages/renderer/dist
COPY --from=build --chown=node:node /app/packages/templates/package.json ./packages/templates/package.json
COPY --from=build --chown=node:node /app/packages/templates/dist ./packages/templates/dist
COPY --from=build --chown=node:node /app/packages/templates/assets ./packages/templates/assets
COPY --chown=node:node docker/backend-entrypoint.sh /usr/local/bin/takt-entrypoint
RUN chmod +x /usr/local/bin/takt-entrypoint

USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["takt-entrypoint"]
CMD ["node", "--enable-source-maps", "/app/apps/backend/dist/main.js"]
