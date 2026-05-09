#!/usr/bin/env bash
# Phase 1.5 #7 — Restore a WAL-G base backup + replay WAL up to a
# target time (ADR-0004 §2.6 PITR).
#
# DANGEROUS: writes into PGDATA. Run against an EMPTY data directory
# only — typically inside a fresh container or on a recovery host.
#
# Usage:
#   PGDATA=/var/lib/postgresql/data \
#   WALG_CONFIG_FILE=/etc/wal-g/wal-g.json \
#   ./walg-restore.sh LATEST            # full restore to most recent base
#   ./walg-restore.sh base_000000010000000000000005   # specific base name
#
# After this script exits, start postgres; recovery.signal triggers WAL
# replay. To stop replay at a specific time, set RECOVERY_TARGET_TIME
# before starting postgres (it adds the directive to recovery.conf).

set -euo pipefail

: "${WALG_CONFIG_FILE:=/etc/wal-g/wal-g.json}"
: "${PGDATA:=/var/lib/postgresql/data}"
TARGET="${1:-LATEST}"

if [[ ! -r "$WALG_CONFIG_FILE" ]]; then
  echo "[walg-restore] config not readable: $WALG_CONFIG_FILE" >&2
  exit 2
fi
if [[ -d "$PGDATA" && -n "$(ls -A "$PGDATA" 2>/dev/null || true)" ]]; then
  echo "[walg-restore] PGDATA $PGDATA is not empty; refuse to overwrite" >&2
  echo "  (rm -rf the directory first, or pick an empty one)" >&2
  exit 2
fi
mkdir -p "$PGDATA"
chmod 700 "$PGDATA"
export WALG_CONFIG_FILE

echo "[walg-restore] $(date -Iseconds): backup-fetch $PGDATA <- $TARGET"
wal-g backup-fetch "$PGDATA" "$TARGET"

# Set up recovery so postgres replays WAL from S3 on boot.
touch "$PGDATA/recovery.signal"
{
  echo "restore_command = 'wal-g wal-fetch %f %p'"
  if [[ -n "${RECOVERY_TARGET_TIME:-}" ]]; then
    echo "recovery_target_time = '${RECOVERY_TARGET_TIME}'"
    echo "recovery_target_action = 'promote'"
  fi
} >> "$PGDATA/postgresql.auto.conf"

echo "[walg-restore] $(date -Iseconds): done. Start postgres to begin WAL replay."
