# syntax=docker/dockerfile:1
#
# Padhaanewala web frontend (Next.js, standalone output).
#
# Three stages, and the boundary between them is the point of the file: the
# builder needs TypeScript, ESLint, Tailwind and the full source tree, and the
# runtime needs none of it. Shipping `next start` instead would mean copying
# `node_modules` (~500 MB, including ESLint and the TypeScript compiler) and
# the entire source tree into the image that runs in production.
#
# `output: "standalone"` in next.config.ts is what makes the last stage
# possible: Next traces the runtime imports and emits a self-contained server
# plus a minimal `node_modules`.

# Pinned by digest for the same reason as the backend: an unpinned base means
# the same commit does not reliably produce the same image. Digest is the
# linux/amd64 manifest.
FROM node:24-alpine@sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a AS deps

WORKDIR /app

# `npm ci` rather than `npm install`: it installs exactly the lockfile, and
# fails when package.json and package-lock.json disagree. `npm install` would
# quietly resolve a newer transitive version and produce an image that does not
# match the reviewed one.
#
# The `node_modules` cache mount is keyed on the lockfile so it survives source
# edits — a code change should not re-download 373 packages.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci


# --------------------------------------------------------------------------- #
# Build
# --------------------------------------------------------------------------- #
FROM deps AS builder

# NEXT_TELEMETRY_DISABLED stops the build phoning home. It also stops the build
# failing on a machine that cannot reach telemetry, which is the normal condition
# inside a build sandbox.
ENV NEXT_TELEMETRY_DISABLED=1

# APP_ENV defaults to `production` *in the builder*, so the launch-blocker guard
# in next.config.ts fires while the image is being built rather than after it is
# deployed. This is the whole reason it is a build-time check: a
# `NEXT_PUBLIC_*` value is inlined into the bundle, so the only moment a
# production deployment can learn that the grievance officer is undesignated is
# here, before an image exists to ship.
ARG APP_ENV=production
# Statutory publication duty (IT Rules 2021 r.3(2)(g), Consumer Protection Act
# 2019). Compiled into the bundle, so it must arrive as a build arg — passing it
# as a runtime environment variable in docker-compose.prod.yml would have no
# effect at all on the served page.
ARG NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME
ARG NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE
# The canonical origin, used by metadataBase, JSON-LD and the sitemap. Left empty
# in the builder it falls back to https://padhaanewala.in, which is correct for
# this deployment and wrong for a staging host — hence the build arg.
ARG NEXT_PUBLIC_SITE_URL
ENV APP_ENV=${APP_ENV} \
    NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME=${NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME} \
    NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE=${NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

COPY . .

# `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so
# they cannot come from a runtime environment. These two are what the app
# actually reads; see docs/Pending-phases.md Phase 0.3 for why the shape matters.
#
#   NEXT_PUBLIC_API_URL is deliberately unset.
#   `lib/api.ts` uses it verbatim, while `next.config.ts` *strips* a trailing
#   /api/v1 before proxying, so the two consumers want opposite forms. Leaving
#   it unset makes `lib/api.ts` fall back to the relative "/api/v1", which is
#   same-origin and therefore what makes the HttpOnly refresh cookie work
#   without `credentials` gymnastics.
#
#   BACKEND_URL is server-side only and is read by the rewrite in
#   next.config.ts. It must NOT be the public address of this container: it is
#   the internal Compose service name.
ENV BACKEND_URL=http://backend:8000

RUN npm run build


# --------------------------------------------------------------------------- #
# Runtime
# --------------------------------------------------------------------------- #
FROM node:24-alpine@sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# `HOSTNAME` is deliberately NOT set here. Next's standalone `server.js` binds to
# `process.env.HOSTNAME || '0.0.0.0'`, and Docker injects HOSTNAME into every
# container — set to the container's own hostname — which overrides any `ENV` in
# this file. Setting it here would be silently discarded while looking like the
# thing that makes the container reachable. The value that does take effect is
# supplied at runtime in docker-compose.prod.yml.

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

WORKDIR /app

# `server.js` and the traced `node_modules` come from the standalone output.
# `--chown=root:root` and read-only-by-default: a compromised process should not
# be able to rewrite its own server.
COPY --from=builder --chown=root:root /app/.next/standalone ./

# `standalone` deliberately omits these two, and omitting them produces a site
# that serves HTML with every stylesheet and script 404ing. They are build
# output, not source, so copying them does not reintroduce the source tree.
COPY --from=builder --chown=root:root /app/.next/static ./.next/static
COPY --from=builder --chown=root:root /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
