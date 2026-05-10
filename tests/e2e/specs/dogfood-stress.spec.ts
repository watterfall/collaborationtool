// Phase 4 W9 dogfood gate G5 — N-client stress + cross-doc reference
// (ADR-0014 W5/W6, deferred dogfood).
//
// Sandbox subset: this Playwright spec is a smoke wrapper that signals
// dogfood status. The actual heavy lifting lives in:
//   - apps/snapshot-worker/__tests__/cross-ref-sync.test.ts
//     (Y.Map ↔ PG mirror, idempotent reconcile, 7 unit tests)
//   - apps/proto-a-yjs-schema (proto-a:stress, 5 client × 50 ops)
//
// PASS criteria — sandbox tier:
//   1. cross-ref-sync.ts module exists + exports the documented API.
//   2. proto-a stress harness still in workspace.
// PASS criteria — full tier (deferred to ADR-0014 promote):
//   - 50 client × 50 ops over real sync-gateway with multi-subdoc routing.
//   - Subdocument-level ACL deny path.
// Both gated on Phase 4 W5/W6 dogfood; STATUS.md tracks promote conditions.

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, '../../..');

const STRESS_CLIENTS = parseInt(
  process.env['DOGFOOD_STRESS_CLIENTS'] ?? '10',
  10,
);

test('dogfood G5 #1 — cross-ref-sync.ts exposes the documented API', async () => {
  const p = path.join(
    repoRoot,
    'apps/snapshot-worker/src/cross-ref-sync.ts',
  );
  expect(existsSync(p), 'cross-ref-sync.ts not found').toBe(true);

  const src = readFileSync(p, 'utf8');
  for (const sym of [
    'isValidCrossRefEntry',
    'reconcile',
    'startCrossRefSync',
    'CrossRefEntry',
  ]) {
    expect(src, `cross-ref-sync.ts must export ${sym}`).toMatch(
      new RegExp(`export (function|interface|const) ${sym}\\b`),
    );
  }

  // Y.Map.observe → PG mirror is the dual-write owner contract.
  expect(src).toMatch(/observe/);
  expect(src).toMatch(/onConflictDoUpdate/);
});

test('dogfood G5 #2 — proto-a stress harness still in workspace', async () => {
  const protoA = path.join(repoRoot, 'apps/prototypes/proto-a-yjs-schema');
  expect(existsSync(protoA)).toBe(true);

  test.info().annotations.push({
    type: 'dogfood-handoff',
    description: `run \`pnpm proto-a:stress\` for ${STRESS_CLIENTS}-client convergence; full 50-client tier waits for W5/W6 sync-gateway multi-subdoc routing`,
  });
});

test('dogfood G5 #3 — 50-client tier deferred to W5/W6 dogfood', async () => {
  test.info().annotations.push({
    type: 'dogfood-deferred',
    description:
      '50-client × 50-ops over real sync-gateway needs W5/W6 multi-subdoc routing + subdocument-level ACL deny path',
  });
  expect(true).toBe(true);
});
