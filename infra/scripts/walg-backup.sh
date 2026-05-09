#!/usr/bin/env bash
# Phase 1.5 #7 — Take a WAL-G base backup + prune to the retention
# window (ADR-0004 §2.6: 7-day PITR).
#
# Run this from a cron / systemd timer (e.g. `0 4 * * *` daily at 04:00
# server local) or via the docker-compose.walg.yml `walg-backup`
# sidecar service. Writes to the bucket configured in
# /etc/wal-g/wal-g.json (WALG_S3_PREFIX).
#
# Idempotent: WAL-G itself dedupes WAL segments. Base-backup-push runs
# `pg_start_backup`/`pg_stop_backup` against the live DB.

set -euo pipefail

: "${WALG_CONFIG_FILE:=/etc/wal-g/wal-g.json}"
: "${RETAIN_BASE_BACKUPS:=7}"
: "${PGDATA:=/var/lib/postgresql/data}"

if [[ ! -r "$WALG_CONFIG_FILE" ]]; then
  echo "[walg-backup] config not readable: $WALG_CONFIG_FILE" >&2
  exit 2
fi
export WALG_CONFIG_FILE

echo "[walg-backup] $(date -Iseconds): backup-push $PGDATA"
wal-g backup-push "$PGDATA"

echo "[walg-backup] $(date -Iseconds): pruning, retain last $RETAIN_BASE_BACKUPS base backups"
wal-g delete retain FULL "$RETAIN_BASE_BACKUPS" --confirm

echo "[walg-backup] $(date -Iseconds): done"
