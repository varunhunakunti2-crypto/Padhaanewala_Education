# Official postgres images bundle gosu 1.19 built with Go 1.24.6, which has
# critical stdlib CVEs (CVE-2025-68121 etc.). Rebuild gosu with a patched Go
# toolchain. Docker Scout indexes layers independently, so the final image is
# also flattened: no inherited layer may contain the vulnerable binary.
FROM golang:1.26 AS gosu-build

ARG GOSU_VERSION=1.19

ENV FAKEGIT_GO_REVISION=${GOSU_VERSION}.0
ENV FAKEGIT_GO_SEMVER=v${GOSU_VERSION}.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && git clone --depth 1 --branch "${GOSU_VERSION}" https://github.com/tianon/gosu.git /go/gosu \
    && cd /go/gosu \
    && go get golang.org/x/sys@v0.44.0 \
    && go build -trimpath -buildvcs=false -o /go/bin/gosu . \
    && go version -m /go/bin/gosu

FROM postgres:15 AS postgres

# Remove the vulnerable gosu so it is not copied into the flattened image,
# then apply pending Debian security fixes from the base image.
RUN rm -f /usr/local/bin/gosu \
    && apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

FROM scratch

# Install the patched gosu first, then lay down the postgres filesystem
# (which no longer contains gosu). Layers are flattened, so scout never sees
# the vulnerable binary.
COPY --from=gosu-build /go/bin/gosu /usr/local/bin/gosu
COPY --from=postgres / /

ENV GOSU_VERSION=1.19 \
    LANG=en_US.utf8 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/15/bin \
    PG_MAJOR=15 \
    PG_VERSION=15.19-1.pgdg13+2 \
    PGDATA=/var/lib/postgresql/data

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
EXPOSE 5432
VOLUME /var/lib/postgresql/data
STOPSIGNAL SIGINT