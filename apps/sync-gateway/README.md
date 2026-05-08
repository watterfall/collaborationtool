# @collaborationtool/sync-gateway

Phase 1 D8 — WebSocket gateway sitting in front of (D11) y-sweet, the
single chokepoint for capability checks on Yjs traffic. Connection-level
authorization in Phase 1; node-range upgrade arrives in Phase 3
(see ADR-0002 §2.4).

## Wire protocol (Phase 1)

```
client                                   gateway
   │                                        │
   │ GET /ws?docId=...&token=<JWT>          │
   ├───────────────────────────────────────►│
   │                                        │ verifySyncToken
   │                                        │ loadPrincipalContext (PG)
   │                                        │ classifyConnectionMode
   │ 401 / 400 (immediate close)            │
   │ ◄──────────── on auth failure ──────── │
   │                                        │
   │ 101 Switching Protocols                │
   │ ◄────────────────────────────────────  │
   │ 0x03 mode_set: "writer|proposer|reader"│
   │ ◄────────────────────────────────────  │
   │ 0x01 body_update (history replay)      │
   │ ◄────────────────────────────────────  │
   │ ...                                    │
   │                                        │
   │ 0x01 body_update                       │
   ├───────────────────────────────────────►│ gateUpdate()
   │                                        │  ├─ writer  → broadcast 0x01
   │                                        │  ├─ proposer→ broadcast 0x02 (draft)
   │                                        │  └─ reader  → reply 0x04 update_rejected
```

Frame kinds:

| Kind | Direction | Meaning |
|---|---|---|
| `0x01` | both | body update (Yjs binary, Phase 1 stub) |
| `0x02` | both | draft revision update (proposer ↔ writer) |
| `0x03` | server → client | `mode_set` payload = ASCII connection mode |
| `0x04` | server → client | `update_rejected` payload = reason |
| `0x05` | server → client | application-level ping |
| `0x06` | client → server | pong reply |

Close codes (RFC 6455 application range):

| Code | Meaning |
|---|---|
| `4400` | malformed URL / missing token |
| `4401` | invalid JWT signature / wrong issuer / wrong audience |
| `4402` | JWT expired |
| `4403` | no ACL row, or ACL row missing `document.read` |
| `4404` | URL `docId` ≠ JWT `doc` claim |
| `4405` | ACL row revoked mid-connection (heartbeat detected) |

## Env vars

| Variable | Default | Required |
|---|---|---|
| `SYNC_TOKEN_SECRET` | — | yes (≥32 chars; `openssl rand -base64 32`) |
| `DATABASE_URL` | `postgres://collab:collab@localhost:5432/collaborationtool` | no |
| `PORT` | `4321` | no |
| `HOST` | `127.0.0.1` | no |
| `SYNC_TOKEN_ISSUER` | `collaborationtool.web` | no |
| `SYNC_TOKEN_AUDIENCE` | `sync-gateway` | no |
| `HEARTBEAT_MS` | `60000` (ADR-0002 §4) | no |
| `MAX_FRAME_BYTES` | `1048576` (1 MiB) | no |
| `LOG_LEVEL` | `info` | no |

## Quick start

```bash
# 0. ensure D7 is up:
pnpm db:up && pnpm db:migrate && pnpm db:seed

# 1. start gateway:
SYNC_TOKEN_SECRET=$(openssl rand -base64 32) \
  pnpm --filter @collaborationtool/sync-gateway start

# 2. connect from a client (simplified — see tests/e2e.test.ts):
import { signSyncToken, syncTokenSecretFromString } from '@collaborationtool/permissions';
const secret = syncTokenSecretFromString(process.env.SYNC_TOKEN_SECRET);
const token = await signSyncToken(
  { sub: 'user:...', doc: 'doc-id' },
  secret,
  { issuer: 'collaborationtool.web', audience: 'sync-gateway' },
);
const ws = new WebSocket(`ws://localhost:4321/ws?docId=doc-id&token=${token}`);
```

## Body backend (D11)

The room's body persistence is pluggable via `BodyBackend`:

| Backend | When | Persistence | Cross-instance broadcast |
|---|---|---|---|
| `InMemoryBodyBackend` | default (no `YSWEET_URL`) | none — gateway process lifetime | no |
| `YSweetBackend` | `YSWEET_URL` + `YSWEET_AUTH` set | y-sweet → S3-compat (MinIO / R2) | yes (y-sweet broadcast) |

Selection happens per-room at first connection; the factory inspects
`env.ysweetUrl` and instantiates the appropriate backend (`server.ts`).

### Switching to y-sweet (local docker)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
# y-sweet at http://localhost:8080 backed by MinIO at http://localhost:9000

YSWEET_URL=http://localhost:8080 \
YSWEET_AUTH=dev-y-sweet-auth-token-replace-in-prod \
SYNC_TOKEN_SECRET=$(openssl rand -base64 32) \
  pnpm --filter @collaborationtool/sync-gateway start
```

### Manual integration verification (Phase 1 D11)

1. `docker compose up -d` — Postgres + MinIO + y-sweet healthy
2. start gateway with `YSWEET_URL` set — log shows
   `[y-sweet] { documentId, status: 'connected' }` on first room open
3. Open the editor in browser A; type a paragraph; close the tab
4. Open the editor in browser B; observe the paragraph appears (state
   replay through y-sweet, not in-memory)
5. Restart the gateway; reopen editor; paragraph still there
6. `pnpm snapshot:tick` writes the merged Yjs binary to PG bytea (verify
   with `\d document` + `SELECT length(yjs_doc_binary) FROM document`)

## Phase 1 limitations (deliberate; documented to revisit)

- **Connection-level mode only.** `proposer` writes go to a single draft
  buffer per doc, not per-section drafts; `block.review` capability is
  not yet enforced for who can pull drafts (Phase 1.5).
- **No real revision row creation.** `proposer` updates are stored in
  `DocRoom.drafts`; D14 wires this to the `revision` table with PG
  insert + Provenance.
- **No HEAD load balancing.** Single-process gateway. Phase 3 sticky
  routing.
- **TLS terminates at the reverse proxy.** Configure Caddy / Traefik /
  CF; ADR-0004 will record the production deployment topology.
- **JWT only.** No OAuth / mTLS. Sufficient for Phase 1's
  better-auth-issued sessions.
