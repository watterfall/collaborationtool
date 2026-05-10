// Phase 4 W9 ADR-0014 §5 — cross-ref-sync.
//
// dual-write owner = `apps/snapshot-worker`. Y.Map (`crossRefs` on the
// root Y.Doc) is authoritative; PG `crossref_index` is the searchable
// mirror. This module:
//
//   1. Subscribes to a root Y.Doc's `crossRefs` Y.Map via Y.Map.observe.
//   2. Translates each Y event (add / update / delete) into PG row
//      changes against `crossref_index`.
//   3. Idempotent re-run: a freshly opened doc + observe replays the
//      current Y.Map state into PG via `syncSnapshot()` so we always
//      converge after a worker restart.
//
// Phase 4 W9 dogfood-gate scope (sandbox subset):
//   - Y.Map → PG translation + idempotent replay are unit-tested here.
//   - The real multi-client convergence (50 client stress) is the
//     Phase 4 W5/W6 dogfood gate; depends on sync-gateway multi-subdoc
//     routing landing.
//
// Consistency window: snapshot-worker tick (default 5s). Maintenance
// scan broken-citation cross-subdoc check tolerates this false-negative
// window per ADR-0014 §5.
//
// Y.Map shape (canonical, see ADR-0014 §3):
//   crossRefs: Y.Map<{ refKind, refTargetId, sourceSubdocumentId | null,
//                       sourceBlockId }>
// Map key = stable cross-ref id (uuidv7); value = the entry above.

import { and, eq, sql } from 'drizzle-orm';
import type * as Y from 'yjs';

import { schema, type DbExecutor } from '@collaborationtool/drizzle';

/** Canonical Y.Map<CrossRefEntry> value shape. ADR-0014 §3. */
export interface CrossRefEntry {
  /** 'figure' | 'citation' | 'claim' | 'evidence' (string, not enum;
   * Phase 5 may add 'dataset' / 'computational-output'). */
  refKind: string;
  refTargetId: string;
  /** Null when the ref originates from the root document body. */
  sourceSubdocumentId: string | null;
  sourceBlockId: string;
}

/** Validates a value extracted from the Y.Map before upserting. Filters
 * out partial / malformed entries that other call-sites may have
 * written (defensive — Y.Map allows any JSON). */
export function isValidCrossRefEntry(value: unknown): value is CrossRefEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['refKind'] === 'string' &&
    v['refKind'].length > 0 &&
    typeof v['refTargetId'] === 'string' &&
    v['refTargetId'].length > 0 &&
    typeof v['sourceBlockId'] === 'string' &&
    v['sourceBlockId'].length > 0 &&
    (v['sourceSubdocumentId'] === null ||
      typeof v['sourceSubdocumentId'] === 'string')
  );
}

export interface CrossRefSyncOptions {
  rootDocumentId: string;
  /** PG executor (Drizzle handle.db). */
  db: DbExecutor;
  /** Y.Map<CrossRefEntry> — typically `rootDoc.getMap('crossRefs')`. */
  crossRefMap: Y.Map<CrossRefEntry>;
}

export interface CrossRefSyncHandle {
  /** Stop observing. After dispose(), no further Y events are mirrored. */
  dispose(): void;
  /** Force a full reconciliation of current Y.Map state into PG. Useful
   * for startup convergence + idempotent re-run. */
  syncSnapshot(): Promise<{ upserted: number; deleted: number }>;
}

/**
 * Start mirroring `crossRefMap` into `crossref_index`. Returns a handle
 * that owns the observer subscription.
 */
export function startCrossRefSync(
  options: CrossRefSyncOptions,
): CrossRefSyncHandle {
  const { rootDocumentId, db, crossRefMap } = options;

  // Best-effort handler. We swallow PG errors back to console so a
  // single failed mirror doesn't kill the worker; the next snapshot
  // tick / restart will re-converge via syncSnapshot().
  const handler = async (
    event: Y.YMapEvent<CrossRefEntry>,
  ): Promise<void> => {
    for (const [key, change] of event.changes.keys) {
      try {
        if (change.action === 'delete') {
          await deleteOne(db, rootDocumentId, key);
          continue;
        }
        // 'add' | 'update'
        const value = crossRefMap.get(key);
        if (!isValidCrossRefEntry(value)) continue;
        await upsertOne(db, rootDocumentId, key, value);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[cross-ref-sync] mirror failed', { key, err });
      }
    }
  };

  // y-types: observe gives `(event, transaction) => void`, sync.
  // We adapt the async handler into a fire-and-forget bridge.
  const wrapped = (event: Y.YMapEvent<CrossRefEntry>): void => {
    void handler(event);
  };

  crossRefMap.observe(wrapped);

  return {
    dispose: () => crossRefMap.unobserve(wrapped),
    syncSnapshot: () =>
      reconcile({
        db,
        rootDocumentId,
        crossRefMap,
      }),
  };
}

interface ReconcileInput {
  db: DbExecutor;
  rootDocumentId: string;
  crossRefMap: Y.Map<CrossRefEntry>;
}

/**
 * Idempotent full reconciliation. Used at worker startup to bring PG
 * back in line with the authoritative Y.Map (covers any Y events that
 * fired while the worker was offline).
 *
 * Algorithm:
 *   1. Read current PG rows for this rootDocumentId.
 *   2. For each Y.Map entry: upsert.
 *   3. For each PG row whose id is no longer in the Y.Map: delete.
 *
 * Returns counters for logging.
 */
export async function reconcile(
  input: ReconcileInput,
): Promise<{ upserted: number; deleted: number }> {
  const { db, rootDocumentId, crossRefMap } = input;

  // Snapshot of current Y.Map state.
  const ySnapshot: Array<[string, CrossRefEntry]> = [];
  crossRefMap.forEach((value, key) => {
    if (isValidCrossRefEntry(value)) {
      ySnapshot.push([key, value]);
    }
  });

  // Bulk upsert the Y state into PG.
  let upserted = 0;
  for (const [key, value] of ySnapshot) {
    await upsertOne(db, rootDocumentId, key, value);
    upserted += 1;
  }

  // Delete PG rows whose id is no longer in the Y.Map.
  const liveIds = new Set(ySnapshot.map(([k]) => k));
  const pgRows = await db
    .select({ id: schema.crossrefIndex.id })
    .from(schema.crossrefIndex)
    .where(eq(schema.crossrefIndex.rootDocumentId, rootDocumentId));
  let deleted = 0;
  for (const row of pgRows) {
    if (!liveIds.has(row.id)) {
      await deleteOne(db, rootDocumentId, row.id);
      deleted += 1;
    }
  }

  return { upserted, deleted };
}

/** INSERT / UPDATE one mirror row. Composite uniqueness handled via
 * `crossref_index_uniq` so concurrent worker instances don't double-insert. */
async function upsertOne(
  db: DbExecutor,
  rootDocumentId: string,
  id: string,
  entry: CrossRefEntry,
): Promise<void> {
  await db
    .insert(schema.crossrefIndex)
    .values({
      id,
      rootDocumentId,
      refKind: entry.refKind,
      refTargetId: entry.refTargetId,
      sourceSubdocumentId: entry.sourceSubdocumentId,
      sourceBlockId: entry.sourceBlockId,
    })
    .onConflictDoUpdate({
      target: schema.crossrefIndex.id,
      set: {
        refKind: entry.refKind,
        refTargetId: entry.refTargetId,
        sourceSubdocumentId: entry.sourceSubdocumentId,
        sourceBlockId: entry.sourceBlockId,
        updatedAt: sql`now()`,
      },
    });
}

async function deleteOne(
  db: DbExecutor,
  rootDocumentId: string,
  id: string,
): Promise<void> {
  await db
    .delete(schema.crossrefIndex)
    .where(
      and(
        eq(schema.crossrefIndex.id, id),
        eq(schema.crossrefIndex.rootDocumentId, rootDocumentId),
      ),
    );
}
