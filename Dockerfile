# syntax=docker/dockerfile:1.7
# Northstar web (Next.js 16, App Router). Builds with output: "standalone" (enabled by NEXT_OUTPUT=standalone in
# next.config.mjs) so the runtime image holds server.js + traced node_modules only. src/proxy.ts (per-request CSP nonce,
# brand subdomain routing) runs unchanged in standalone mode.
#   docker build -f Dockerfile.web \
#     --build-arg NEXT_PUBLIC_PLATFORM_API_URL=https://api.people.example.in \
#     --build-arg NEXT_PUBLIC_APP_DOMAIN=people.example.in \
#     --build-arg NEXT_PUBLIC_OIDC_ISSUER=https://login.example.in \
#     -t northstar-web .
# NEXT_PUBLIC_* values are compiled into the browser bundle: build one image per environment (staging / production).
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV CI=true NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM deps AS build
ARG NEXT_PUBLIC_PLATFORM_API_URL
ARG NEXT_PUBLIC_APP_DOMAIN
ARG NEXT_PUBLIC_OIDC_ISSUER
ARG NEXT_PUBLIC_ALLOW_DEMO_IDENTITY=false
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone \
    NEXT_PUBLIC_PLATFORM_API_URL=${NEXT_PUBLIC_PLATFORM_API_URL} \
    NEXT_PUBLIC_APP_DOMAIN=${NEXT_PUBLIC_APP_DOMAIN} \
    NEXT_PUBLIC_OIDC_ISSUER=${NEXT_PUBLIC_OIDC_ISSUER} \
    NEXT_PUBLIC_ALLOW_DEMO_IDENTITY=${NEXT_PUBLIC_ALLOW_DEMO_IDENTITY}
RUN test -n "$NEXT_PUBLIC_PLATFORM_API_URL" && test -n "$NEXT_PUBLIC_APP_DOMAIN" \
 || (echo "NEXT_PUBLIC_PLATFORM_API_URL and NEXT_PUBLIC_APP_DOMAIN build args are required" >&2; exit 1)
COPY next.config.mjs tsconfig.json next-env.d.ts ./
COPY src ./src
COPY public ./public
RUN npm run build && test -f .next/standalone/server.js

FROM ${NODE_IMAGE} AS web
WORKDIR /app
ARG APP_VERSION=0.0.0
ARG GIT_SHA=""
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 HOME=/tmp \
    APP_VERSION=${APP_VERSION} GIT_SHA=${GIT_SHA}
RUN apk add --no-cache tini && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn*
COPY --from=build --chown=root:root /app/.next/standalone ./
COPY --from=build --chown=root:root /app/.next/static ./.next/static
COPY --from=build --chown=root:root /app/public ./public
# Next writes its image/fetch cache here; with a read-only root FS mount a tmpfs at /app/.next/cache.
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"]
CMD ["node", "server.js"]
