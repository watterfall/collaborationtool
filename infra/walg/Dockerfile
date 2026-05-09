# Phase 1.5 #7 — Postgres 16 + WAL-G base image (ADR-0004 §2.6).
#
# Adds a precompiled WAL-G binary so postgresql.conf's archive_command
# can call `wal-g wal-push` against any S3-compatible bucket (R2 /
# Tigris / AWS S3 / MinIO). Keeps the postgres-bullseye flavour (not
# alpine) because the official WAL-G release builds against glibc.
#
# Build:
#   docker build -f infra/walg/Dockerfile -t collaborationtool-pg-walg infra/walg
#
# Use this image instead of `postgres:16-alpine` in prod docker-compose
# (see infra/docker/docker-compose.walg.yml overlay).

FROM postgres:16-bookworm

ARG WALG_VERSION=v3.0.5

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      xz-utils; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) walg_arch=amd64 ;; \
      arm64) walg_arch=aarch64 ;; \
      *) echo "unsupported arch $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/wal-g.tar.gz \
      "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-ubuntu-22.04-${walg_arch}.tar.gz"; \
    tar -xzf /tmp/wal-g.tar.gz -C /tmp; \
    install -m 0755 /tmp/wal-g-pg-ubuntu-22.04-${walg_arch} /usr/local/bin/wal-g; \
    rm -rf /tmp/wal-g*; \
    apt-get purge -y curl xz-utils; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*; \
    wal-g --version

# Mounted by docker-compose.walg.yml so postgresql.conf includes our
# archiving stanza on first init.
COPY postgres.archive.conf /etc/postgresql/conf.d/10-archive.conf

# This snippet is appended to the auto-generated postgresql.conf via the
# `include_dir` directive. It enables WAL archiving + sets the command
# to wal-g. The actual wal-g.json (creds, prefix) is mounted at
# /etc/wal-g/wal-g.json by the compose file — keeps secrets out of the
# image.
ENV WALG_CONFIG_FILE=/etc/wal-g/wal-g.json

# Re-export the postgres entrypoint unchanged. Operators set
# `archive_mode = on` via the conf snippet; pg_basebackup / cron-style
# backup-push runs from the wal-g sidecar service (see compose).
