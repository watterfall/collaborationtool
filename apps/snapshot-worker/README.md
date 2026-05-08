# @collaborationtool/snapshot-worker

Phase 1 D10 — periodic Y.Doc snapshot service.

## What it does

Walks `document` rows whose `last_snapshot_at` is older than
`SNAPSHOT_STALE_AFTER_MS` (or null) AND whose `updated_at` is newer than
the last snapshot. For each, fetches the current Yjs binary from the
source-of-truth and writes to `document.yjs_doc_binary` +
`yjs_state_vector_snapshot` + `last_snapshot_at`.

## Phase 1 D10 limitation (deliberate)

The `fetchYjsBinary` source is a **stub** until D11 wires y-sweet (or
the gateway's state HTTP endpoint). Today it always returns null, which
exercises the loop's "no-source" path — all the schedule + DB plumbing
runs but no snapshot is taken. D11 swaps in the real fetcher; the
worker code doesn't change.

## Env

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://collab:collab@localhost:5432/collaborationtool` | |
| `SNAPSHOT_INTERVAL_MS` | `300000` (5 min) | Tick interval |
| `SNAPSHOT_STALE_AFTER_MS` | `3600000` (60 min) | Max age before re-snapshot |
| `SNAPSHOT_MAX_PER_TICK` | `100` | Cap per tick |
| `GATEWAY_STATE_URL` | (D11) | Where to fetch Yjs binary |

## Run

```bash
pnpm snapshot:start    # daemon
pnpm snapshot:tick     # one-shot (useful in dev / CI)
pnpm snapshot:test     # 5 integration tests against PG
```

Inside docker-compose:

```yaml
# infra/docker/docker-compose.yml — Phase 1.5 will add this service
# block; D10 keeps it manual.
```
