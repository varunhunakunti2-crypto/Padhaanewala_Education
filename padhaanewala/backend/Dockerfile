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

FROM python:3.14-slim@sha256:7bf6c3111fe094f8ee1a1cbcdc63c4cfb345b0e3df42d5aa9a90b3b4b022ab6d AS base

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
# --forwarded-allow-ips "*" trusts X-Forwarded-For from *any* peer, which on its
# own is the hole Phase 1.5 closed: the header is client-controlled, and Phase 1
# introduced `TRUSTED_PROXY_HOPS` precisely so the topology, not the header,
# decides whether it is believed.
#
# It is safe here, but only because of the topology and not because of the flag.
# This container publishes no port, so the only thing that can reach it is
# another container on the private Compose network, and the only one that
# forwards a request is the frontend. That reasoning is load-bearing: if anyone
# ever adds a `ports:` mapping for the backend, this flag becomes an
# internet-reachable header-trust bypass and every rate-limit bucket and audit
# row can be forged by a caller who sets the header themselves.
#
# The coupling is worth knowing because it is invisible from either file alone.
# Verified while running the stack: with `--forwarded-allow-ips *`, `client_ip()`
# at `TRUSTED_PROXY_HOPS=0` still returns the forwarded client rather than the
# socket peer, because uvicorn's ProxyHeadersMiddleware has already rewritten
# `request.client` before any application code runs. Two independent
# implementations of "what is the client IP" are live in this process, and
# `app/routers/consent.py:49` reads `request.client.host` directly rather than
# going through `client_ip()`.
#
# Do not "tidy" the `*` into a subnet without also changing consent.py to use
# `client_ip()`; doing the first alone silently changes what an audit row records.
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--no-server-header", \
     "--workers", "1"]
