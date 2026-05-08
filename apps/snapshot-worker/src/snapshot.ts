// Snapshot logic — find documents whose `last_snapshot_at` is older
// than the threshold AND whose `updated_at` is newer than the
// `last_snapshot_at` (otherwise nothing changed since the last snapshot).
//
// Phase 1 D10 limitation: we don't have y-sweet yet (D11), so the
// `fetchYjsBinary` step returns null until D11 wires the source. The
// rest of the loop — query, persist, update timestamp — works today
// against PG and is testable without y-sweet.
//
// On D11 wire-up, replace `fetchYjsBinaryStub` with a real fetch from
// the gateway HTTP `/api/state/:docId` (or directly from y-sweet).

import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';

import {
  schema,
  type DbExecutor,
} from '@collaborationtool/drizzle';

export interface SnapshotCandidate {
  documentId: string;
  updatedAt: Date;
  lastSnapshotAt: Date | null;
}

export interface SnapshotResult {
  documentId: string;
  status: 'snapshotted' | 'no-change' | 'no-source';
}

/**
 * Find docs that need a snapshot. Phase 1 default: any doc updated since
 * its last snapshot AND last snapshot >= `staleAfterMs` ago (or never).
 */
export async function findCandidates(
  db: DbExecutor,
  staleAfterMs: number,
): Promise<SnapshotCandidate[]> {
  const cutoff = new Date(Date.now() - staleAfterMs);

  const rows = await db
    .select({
      id: schema.document.id,
      updatedAt: schema.document.updatedAt,
      lastSnapshotAt: schema.document.lastSnapshotAt,
    })
    .from(schema.document)
    .where(
      and(
        isNull(schema.document.deletedAt),
        or(
          isNull(schema.document.lastSnapshotAt),
          lt(schema.document.lastSnapshotAt, cutoff),
        ),
      ),
    );

  return rows
    .filter(
      (r) =>
        r.lastSnapshotAt === null ||
        r.updatedAt.getTime() > r.lastSnapshotAt.getTime(),
    )
    .map((r) => ({
      documentId: r.id,
      updatedAt: r.updatedAt,
      lastSnapshotAt: r.lastSnapshotAt,
    }));
}

export interface SnapshotOneOptions {
  /** Source-of-truth fetcher — Phase 1 D10 stub; D11 wires real fetcher. */
  fetchYjsBinary: (documentId: string) => Promise<Uint8Array | null>;
}

/**
 * Snapshot one document: fetch its current Yjs binary (if any), persist
 * to `document.yjs_doc_binary` + state vector + `last_snapshot_at`.
 *
 * Returns `{ status: 'no-source' }` when there's no in-memory state
 * (e.g. no clients connected, no D11 backend yet) — this is the Phase
 * 1 D10 default path.
 */
export async function snapshotOne(
  db: DbExecutor,
  documentId: string,
  options: SnapshotOneOptions,
): Promise<SnapshotResult> {
  const yjsBinary = await options.fetchYjsBinary(documentId);
  if (!yjsBinary) {
    return { documentId, status: 'no-source' };
  }

  // Phase 1 D11 will tighten this — we'll also write the state vector
  // separately so a fork operation can use it. For D10 we keep both
  // bytea columns to make the contract explicit.
  await db
    .update(schema.document)
    .set({
      yjsDocBinary: yjsBinary,
      yjsStateVectorSnapshot: yjsBinary, // Placeholder; D11 splits these.
      lastSnapshotAt: new Date(),
    })
    .where(eq(schema.document.id, documentId));

  return { documentId, status: 'snapshotted' };
}

export interface RunOnceOptions {
  staleAfterMs: number;
  fetchYjsBinary: SnapshotOneOptions['fetchYjsBinary'];
  /** Optional cap on how many docs to snapshot per tick. */
  maxPerTick?: number;
}

export interface RunOnceResult {
  candidates: number;
  results: SnapshotResult[];
}

export async function runOnce(
  db: DbExecutor,
  options: RunOnceOptions,
): Promise<RunOnceResult> {
  const candidates = await findCandidates(db, options.staleAfterMs);
  const slice = options.maxPerTick
    ? candidates.slice(0, options.maxPerTick)
    : candidates;

  const results: SnapshotResult[] = [];
  for (const c of slice) {
    results.push(
      await snapshotOne(db, c.documentId, {
        fetchYjsBinary: options.fetchYjsBinary,
      }),
    );
  }
  return { candidates: candidates.length, results };
}

// avoid drizzle-orm unused-import warning when types only.
void sql;
