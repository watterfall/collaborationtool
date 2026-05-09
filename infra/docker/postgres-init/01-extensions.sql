-- Postgres extensions required by Phase 1.
-- Mounted into /docker-entrypoint-initdb.d/ so Postgres runs this on
-- first container start (before any migrations).

-- btree_gin: needed for GIN index on text[] (contribution.affected_block_ids)
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- pgcrypto: provides gen_random_uuid() as a fallback if app-side uuidv7
-- is unavailable. Phase 1 generates IDs in TS (uuidv7), but this is a
-- safety net for ad-hoc psql work.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
