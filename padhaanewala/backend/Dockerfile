# syntax=docker/dockerfile:1
#
# Padhaanewala API.
#
# Pinned by digest, not tag. `python:3.14-slim` is a moving target, and an
# unpinned base is how the same commit produces two different images — which
# makes "it worked in staging" unreproducible. The tag is kept in the comment so
# a human can tell what the digest is.
#
# The digest is the linux/amd64 manifest. A multi-arch build targeting arm64
# needs that platform's digest instead; see the buildx note in
# docker-compose.prod.yml.

FROM python:3.14-slim@sha256:65a94bb37b630c482dfd31e5fb9b449cb26c31eab1b7a125cd6bd624acfe3b30 AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Reject any wheel without a manylinux cp314 build rather than silently
    # falling back to compiling from source. That fallback is what Phase 0 hit:
    # on Python 3.12, `cryptography==50.0.1` has no compatible wheel and pip
    # starts a Rust build that takes minutes and needs a toolchain the runtime
    # image deliberately does not have.
    PIP_ONLY_BINARY=:all:

WORKDIR /app


# --------------------------------------------------------------------------- #
# Dependencies, in their own layer.
#
# requirements.txt is a fully-pinned freeze including transitive dependencies
# (see .github/dependabot.yml, which treats the file as one unit for this
# reason). Pinning means this layer is cached until a pin actually changes,
# rather than on every rebuild.
# --------------------------------------------------------------------------- #
FROM base AS deps

RUN --mount=type=cache,target=/root/.cache/pip \
    python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt


# --------------------------------------------------------------------------- #
# Runtime
# --------------------------------------------------------------------------- #
FROM base AS runtime

# curl is here for the healthcheck below, and libpq is required by
# psycopg2-binary at import time even though the binary wheel bundles its own
# libpq — the loader still resolves the client library list. build-essential is
# NOT installed: the image must not be able to compile anything, which turns a
# missing wheel into a fast failure instead of a slow one.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Non-root, with no login shell and no home directory to write to. A compromised
# process should not find a writable ~, a writable /tmp that other users read,
# or a shell to escalate from.
RUN groupadd --system --gid 1001 appuser \
    && useradd --system --uid 1001 --gid 1001 \
       --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin appuser

# Application code is owned by root and only *readable* by appuser. An
# attacker who gains code execution cannot rewrite the application to persist
# across a restart.
COPY --chown=root:root app/ ./app/
COPY --chown=root:root alembic/ ./alembic/
COPY --chown=root:root alembic.ini ./

# Reference-data loaders. Needed because migrations create the schema but not the
# rows, and an app with no roles is up, healthy, and unable to register anyone.
# `.dockerignore` keeps these in while holding back `purge_demo_data.py`, which
# deletes rows and has no business being present in a deployed image.
COPY --chown=root:root scripts/ ./scripts/

COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

# Normalise CRLF -> LF, and do not let the build fail silently if it cannot.
#
# This is not defensive decoration. The script shipped with CRLF endings, which
# `core.autocrlf=true` reproduces on every checkout on a Windows machine, and a
# shebang with a trailing CR names an interpreter called `sh\r`. The kernel then
# fails with `ENOENT` — reported as "no such file or directory" for a file that
# is present, present and executable — and every container restart-loops:
#
#     exec /usr/local/bin/docker-entrypoint.sh: no such file or directory
#
# The build succeeded and `ls -l` showed the file, so neither the build output nor
# a casual inspection of the image would have caught it. `sed` in the same layer
# as the COPY is the only place that can: it makes the image correct regardless
# of how the working tree happens to be checked out, which is what a build server
# and a developer laptop will not agree about.
#
# The guard turns "the container silently restart-loops" into "the build stops
# with a message naming the file", which is the whole difference between a five
# minute diagnosis and a five hour one.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && if head -c 2 /usr/local/bin/docker-entrypoint.sh | od -An -c | grep -q '\\r'; then \
         echo "FATAL: docker-entrypoint.sh still has CRLF after normalisation." >&2; \
         exit 1; \
       fi \
    && head -n 1 /usr/local/bin/docker-entrypoint.sh | grep -q '^#!.*[^[:space:]]$' \
       || { echo "FATAL: docker-entrypoint.sh has no usable shebang." >&2; exit 1; }

# `/tmp` is world-writable by necessity, but made sticky so one process cannot
# read another's files through it.
RUN chmod 1777 /tmp

USER appuser

EXPOSE 8000

# `start_period` is deliberately generous. The app runs its production config
# validator at import time and refuses to boot on a misconfigured deployment, so
# a slow start here is a real configuration problem worth reporting rather than
# something to paper over with a tight timeout.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Runs `alembic upgrade head` first, so a deploy cannot serve against a schema
# that predates the code querying it.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# One worker on purpose. `SESSION_*` state is not shared between processes and
# the rate limiter's Redis client is a module-level singleton, so horizontal
# scaling has to go through the orchestrator (more replicas) rather than more
# workers in one container. See "Scaling" in docs/Pending-phases.md.
#
# The client IP is decided by `app/utils/client_ip.py`, and by nothing else.
# `--no-proxy-headers` is therefore passed explicitly, so that `request.client`
# is always the real socket peer.
#
# It has to be explicit. uvicorn 0.52 defaults `proxy_headers` to True and
# `forwarded_allow_ips` to `$FORWARDED_ALLOW_IPS` or `127.0.0.1`, so merely
# omitting the old flags would still let uvicorn's ProxyHeadersMiddleware rewrite
# `request.client` from the client-supplied `X-Forwarded-For` header — for *any*
# peer under the old `--forwarded-allow-ips "*"`, and for loopback peers under
# the default. Two independent implementations of "what is the client IP" were
# live in the process and the header always won, so at `TRUSTED_PROXY_HOPS=0`
# `client_ip()` still returned the forwarded value.
#
# `--forwarded-allow-ips "*"` was believed safe only because the backend
# published no port, so the sole reachable peer was another container on the
# private Compose network. That premise is simply false on a host like Render,
# where the container is directly reachable: any caller could forge their own
# address, and with it every rate-limit bucket and audit-log row.
#
# With rewriting off, `client_ip()` is the single authority. It reads
# `X-Forwarded-For` only when `TRUSTED_PROXY_HOPS` declares a real proxy
# topology, taking the entry that many positions from the right; otherwise it
# uses the socket peer. The Compose stack (one Caddy hop) and Render (one edge
# hop) both set that variable to 1 and get the real client, while a forged
# header is ignored. The last consumer that read `request.client` directly,
# `app/routers/consent.py`, now calls `client_ip()` too. The dev command in the
# README carries `--no-proxy-headers` for the same reason.
#
# One consequence to know: `request.url.scheme` follows the socket, so it is
# `http` between TLS-terminating proxies. Nothing here branches on the scheme -
# the refresh cookie's `secure` flag comes from APP_ENV, not the request - so it
# is inert. If something ever does depend on the scheme, re-add `--proxy-headers`
# but pin `--forwarded-allow-ips` to the proxy's own range, never "*".
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--no-proxy-headers", \
     "--no-server-header", \
     "--workers", "1"]
