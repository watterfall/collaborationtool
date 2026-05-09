# @collaborationtool/snapshot-worker

Phase 1 D10 + D11 — periodic Y.Doc snapshot service.

## What it does

Walks `document` rows whose `last_snapshot_at` is older than
`SNAPSHOT_STALE_AFTER_MS` (or null) AND whose `updated_at` is newer than
the last snapshot. For each, fetches the current Yjs binary from the
source-of-truth and writes to `document.yjs_doc_binary` +
`yjs_state_vector_snapshot` + `last_snapshot_at`.

## Sources

| Source | Selected when | Notes |
|---|---|---|
| `createYSweetFetcher` | `YSWEET_URL` + `YSWEET_AUTH` set | calls y-sweet's `/api/docs/:id/as-update` |
| stub (returns null) | otherwise | loop runs but no snapshot is taken; useful for dev with InMemory gateway backend |

## Env

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://collab:collab@localhost:5432/collaborationtool` | |
| `SNAPSHOT_INTERVAL_MS` | `300000` (5 min) | Tick interval |
| `SNAPSHOT_STALE_AFTER_MS` | `3600000` (60 min) | Max age before re-snapshot |
| `SNAPSHOT_MAX_PER_TICK` | `100` | Cap per tick |
| `YSWEET_URL` | — | y-sweet base URL (e.g. `http://ysweet:8080`) |
| `YSWEET_AUTH` | — | y-sweet bearer token (matches `Y_SWEET_AUTH` on y-sweet) |
| `YSWEET_TIMEOUT_MS` | `10000` | per-request timeout |

## Run

```bash
pnpm snapshot:start    # daemon
pnpm snapshot:tick     # one-shot (useful in dev / CI)
pnpm snapshot:test     # 11 unit + integration tests
```

## Manual verification (D11 path)

```bash
# 0. start docker stack
docker compose -f infra/docker/docker-compose.yml up -d

# 1. ensure schema is up
pnpm db:migrate && pnpm db:seed

# 2. write something to a doc through the gateway + editor (manual)
# 3. tick the snapshot worker:
DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool \
YSWEET_URL=http://localhost:8080 \
YSWEET_AUTH=dev-y-sweet-auth-token-replace-in-prod \
  pnpm snapshot:tick

# 4. verify PG bytea got populated:
PGPASSWORD=collab psql -h localhost -U collab -d collaborationtool \
  -c "SELECT id, length(yjs_doc_binary), last_snapshot_at FROM document WHERE last_snapshot_at IS NOT NULL;"
```
