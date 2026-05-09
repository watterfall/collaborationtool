# @collaborationtool/drizzle

Phase 1 D7 — Postgres schema, migrations, seed, and round-trip tests.

This package is the **single source of truth for the Postgres layout**.
All other apps/packages import either:
- `@collaborationtool/drizzle` for `db`, `schema`, types, `openDatabase`
- `@collaborationtool/drizzle/schema` for raw table refs (no client)

The TypeScript schema in `src/schema.ts` mirrors `@collaborationtool/schema`
(the conceptual entity shapes from ADR-0001) one-to-one. Each table also
appears in `migrations/0001_initial.sql` with the CHECK constraints and
DEFERRABLE FKs that drizzle-kit's snapshot diff can't yet emit cleanly.

---

## Tables (13)

| # | Name | Source | Notes |
|---|---|---|---|
| 1 | `principal` | ADR-0001 §2.3.9 | id prefix CHECK; identity-link CHECK |
| 2 | `agent` | ADR-0001 §2.3.8 | unique(principal_id) |
| 3 | `document` | ADR-0001 §2.3.1 | + Phase 1 fork columns |
| 4 | `block_metadata` | ADR-0001 §2.3.2 | per-block index, populated at commit |
| 5 | `citation` | ADR-0001 §2.3.3 | jsonb cslJson + externalIds |
| 6 | `annotation_thread` | ADR-0001 §2.3.4 | anchor_id (Y-side) + status |
| 7 | `annotation_comment` | ADR-0001 §2.3.4 | append-only; deferred FK to contribution |
| 8 | `revision` | ADR-0001 §2.3.5 | proposed change; bytea PM steps + Yjs |
| 9 | `contribution` | ADR-0001 §2.3.6 | append-only; provenance_id NOT NULL; GIN on affected_block_ids |
| 10 | `provenance` | ADR-0001 §2.3.7 | actor_kind=agent ⇒ agent_context NOT NULL CHECK |
| 11 | `capability_grant` | ADR-0002 §2.1 | resource_type=global ⇒ resource_id NULL CHECK |
| 12 | `document_acl` | ADR-0002 §2.5 | Phase 1 materialised view |
| 13 | `prompt_template` | ADR-0003 §2.5 | immutable; (skill_id, version) unique |

---

## Quick start (local dev with docker)

```bash
# 1. start Postgres 16 (compose v2):
docker compose -f infra/docker/docker-compose.yml up -d

# 2. apply migrations:
DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool \
  pnpm db:migrate

# 3. seed the demo dataset:
DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool \
  pnpm db:seed

# 4. round-trip tests (18 cases, ~1s):
DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool \
  pnpm db:test
```

`pnpm db:up` / `db:down` / `db:logs` are wrappers around the compose
command in `package.json`.

---

## Quick start (local dev with system Postgres)

If you already have Postgres 16 on the box:

```bash
sudo -u postgres createuser --pwprompt --createdb collab     # password: collab
sudo -u postgres createdb -O collab collaborationtool
sudo -u postgres psql -d collaborationtool \
  -c "CREATE EXTENSION btree_gin; CREATE EXTENSION pgcrypto;"
```

Then the same `db:migrate` / `db:seed` / `db:test` commands.

---

## Idempotency

- `migrate.ts` tracks applied migrations in `_drizzle_migrations` (a
  ledger table created on first run). Re-running prints
  `[migrate] no new migrations`.
- `seed.ts` uses `ON CONFLICT DO NOTHING` on the stable demo IDs, so
  re-seeding is a no-op.
- `setupFreshSchema()` (test helper) drops everything and re-runs
  migrations, so test runs always start clean.

---

## Round-trip tests

`tests/roundtrip.test.ts` — 18 cases covering every table + every
non-trivial constraint. Highlights:

- Principal id-prefix CHECK rejects mismatched kind
- Provenance CHECK forbids `actor_kind=agent` without `agent_context`
- Bytea fields preserve byte sequence (PM steps / Yjs binary / state vector)
- Deferred FK cycle: contribution ↔ revision ↔ provenance can be
  inserted in any order in a single tx
- `contribution.provenance_id` NOT NULL enforced
- `capability_grant` global ⇔ null resource_id CHECK
- `document_acl` composite PK rejects duplicates
- `prompt_template` (skill_id, version) uniqueness
- GIN index on `contribution.affected_block_ids` (text[]) supports
  `WHERE affected_block_ids @> ARRAY[...]` queries
- Enum types reject unknown variants
- Timestamps round-trip with timezone

Tests `t.skip()` cleanly when `DATABASE_URL` is unset, so they're CI-safe
without a service container.

---

## Adding a new table / column

1. Edit `src/schema.ts` (the TS source of truth)
2. Either:
   - Run `pnpm drizzle:generate` to let drizzle-kit produce a new
     `migrations/000N_*.sql` file (preferred for additive changes)
   - Or hand-write `migrations/000N_*.sql` if the change needs CHECK
     constraints / DEFERRABLE FKs / triggers that drizzle-kit can't emit
3. Add round-trip test(s) in `tests/`
4. `DATABASE_URL=… pnpm db:migrate && pnpm db:test`
5. Commit schema.ts, migration SQL, and test together

**Never edit a migration that's been applied to production.** Always
write a new one.

---

## Production concerns (Phase 1.5 / Phase 2)

- Connection pooling: `openDatabase({ max: 10 })` is the dev default.
  Phase 2 evaluate PgBouncer / Drizzle's `withReplicas` for read scaling.
- Backups: `document.yjs_doc_binary` can grow large. Phase 1.5 set up
  WAL-G or pgBackRest for point-in-time recovery; large bytea blobs may
  need to move to S3-compat storage with a bytea pointer (TBD ADR-0004).
- Materialised view drift: `document_acl` is currently maintained by
  application code (D8). Phase 1.5 add a reconcile job (every hour,
  full rebuild from `capability_grant`) as a backstop.
- Migrations + zero-downtime: 0001 is greenfield. Once we have prod
  data, every future migration must be backward-compatible (add column
  with default, double-write, switch reads, drop) — see Stripe's
  rules-of-thumb post.
