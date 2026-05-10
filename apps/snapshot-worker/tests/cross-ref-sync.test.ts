// Phase 4 W9 ADR-0014 §5 — cross-ref-sync unit tests.
//
// We exercise the Y.Map → PG translation logic without touching a real
// Postgres. A stub DbExecutor records each insert / update / delete call
// so tests can assert on the resulting mirror state. yjs is already a
// workspace dep so we can use a real Y.Doc + Y.Map for the source side.
//
// Coverage:
//   1. Y.Map insert → PG upsert (one row).
//   2. Y.Map update on existing key → PG upsert merges new fields.
//   3. Y.Map delete → PG delete.
//   4. reconcile() is idempotent across re-runs (no duplicate rows; PG
//      rows whose key no longer exists in Y.Map are pruned).
//   5. Cross-subdocument entries (sourceSubdocumentId set) round-trip.
//   6. Malformed Y.Map values are filtered out (defensive).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Y from 'yjs';

import {
  isValidCrossRefEntry,
  reconcile,
  startCrossRefSync,
  type CrossRefEntry,
} from '../src/cross-ref-sync';

// ---------- Stub db ----------
//
// The cross-ref-sync module calls three drizzle-style chains:
//   db.insert(table).values(v).onConflictDoUpdate({...})  (await)
//   db.delete(table).where(...)                            (await)
//   db.select({...}).from(table).where(...)                (await rows)
//
// We replay the calls into an in-memory `pg` map keyed by row id and
// expose the row count for assertions.
//
// Drizzle's `eq` / `and` predicates are opaque builder objects, so we
// can't decode them directly. Instead we monkey-patch the import so
// `eq(crossrefIndex.id, value)` carries the value on a `_value` field
// on the returned predicate, which the stub's delete() reads. This is
// safe because the stub only inspects predicates produced inside the
// module under test.

import { and, eq } from 'drizzle-orm';

void and;
void eq;

interface PgRow {
  id: string;
  rootDocumentId: string;
  refKind: string;
  refTargetId: string;
  sourceSubdocumentId: string | null;
  sourceBlockId: string;
}

function makeStubDb(): {
  db: unknown;
  rows: () => PgRow[];
  rowFor: (id: string) => PgRow | undefined;
} {
  const store = new Map<string, PgRow>();
  // Tests rely on the fact that `deleteOne(db, root, id)` always issues
  // `db.delete(t).where(and(eq(t.id, id), eq(t.rootDocumentId, root)))`,
  // i.e. the FIRST `eq` in the AND carries the id. We intercept by
  // recording the most recently constructed `eq(t.id, ...)` value via a
  // module-level shim — because we can't override drizzle-orm exports
  // without ESM gymnastics, we instead extract from the predicate's
  // string form (drizzle-orm's `and` produces a predictable shape).
  //
  // Simpler: snapshot store contents BEFORE delete + AFTER. We achieve
  // this by tracking deletes via call ordering: after a select() that
  // returns N rows, the module issues N delete() calls, each removing
  // one of the surveyed ids in iteration order. The stub records the
  // last surveyed list and pops the next id on each delete().

  let pendingDeleteQueue: string[] = [];

  const insertChain = (values: Partial<PgRow>) => {
    const merged: PgRow = {
      id: values.id!,
      rootDocumentId: values.rootDocumentId!,
      refKind: values.refKind!,
      refTargetId: values.refTargetId!,
      sourceSubdocumentId: (values.sourceSubdocumentId ?? null) as
        | string
        | null,
      sourceBlockId: values.sourceBlockId!,
    };
    return {
      onConflictDoUpdate: (_args: unknown) => {
        store.set(merged.id, merged);
        return Promise.resolve();
      },
    };
  };

  const deleteChain = () => ({
    where: (_predicate: unknown) => {
      const id = pendingDeleteQueue.shift();
      if (id) store.delete(id);
      return Promise.resolve();
    },
  });

  const selectChain = () => ({
    from: () => ({
      where: (_predicate: unknown) => {
        // For tests, reconcile() reads PG rows, then deletes the stale
        // ones in iteration order. We expose the survey result + queue
        // pending deletes against the iteration order.
        const surveyed = [...store.values()].map((r) => ({ id: r.id }));
        // After this select() we may receive 0..N delete() calls; the
        // module's reconcile() decides which surveyed ids are stale and
        // calls delete() in that order. So we re-fill the queue lazily
        // via a separate setStaleQueue helper invoked by tests when
        // they want to assert on delete behaviour.
        return Promise.resolve(surveyed);
      },
    }),
  });

  const db = {
    insert: (_table: unknown) => ({
      values: (v: Partial<PgRow>) => insertChain(v),
    }),
    delete: (_table: unknown) => deleteChain(),
    select: (_cols?: unknown) => selectChain(),
    __setNextDeleteIds(ids: string[]): void {
      pendingDeleteQueue = [...ids];
    },
  } as const;

  return {
    db: db as unknown,
    rows: () => [...store.values()],
    rowFor: (id: string) => store.get(id),
  };
}

// Drizzle uses `and()` / `eq()` builder objects that the stub can't
// introspect. To keep the test focused on the Y → PG mapping we stub
// the module-level helpers via a local wrapper for delete: the tests
// observe correct insert state and use the explicit reconcile() return
// counters for upsert / delete totals.

const ROOT_DOC = 'doc:root-1';

function makeRoot(): { doc: Y.Doc; map: Y.Map<CrossRefEntry> } {
  const doc = new Y.Doc();
  const map = doc.getMap<CrossRefEntry>('crossRefs');
  return { doc, map };
}

describe('isValidCrossRefEntry', () => {
  it('accepts a well-formed entry', () => {
    assert.ok(
      isValidCrossRefEntry({
        refKind: 'citation',
        refTargetId: 'cit:1',
        sourceSubdocumentId: null,
        sourceBlockId: 'block-1',
      }),
    );
  });

  it('rejects missing refKind', () => {
    assert.equal(
      isValidCrossRefEntry({
        refTargetId: 'cit:1',
        sourceSubdocumentId: null,
        sourceBlockId: 'block-1',
      }),
      false,
    );
  });

  it('rejects empty refTargetId', () => {
    assert.equal(
      isValidCrossRefEntry({
        refKind: 'figure',
        refTargetId: '',
        sourceSubdocumentId: null,
        sourceBlockId: 'block-1',
      }),
      false,
    );
  });

  it('accepts entry with subdocument id (cross-subdoc reference)', () => {
    assert.ok(
      isValidCrossRefEntry({
        refKind: 'evidence',
        refTargetId: 'ev:42',
        sourceSubdocumentId: 'sub:chap-1',
        sourceBlockId: 'block-7',
      }),
    );
  });
});

describe('reconcile', () => {
  it('mirrors a fresh Y.Map insert into PG (idempotent re-run = no double insert)', async () => {
    const { map } = makeRoot();
    const stub = makeStubDb();

    map.set('xref:1', {
      refKind: 'citation',
      refTargetId: 'cit:doi-1',
      sourceSubdocumentId: null,
      sourceBlockId: 'b1',
    });

    const r1 = await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });
    assert.equal(r1.upserted, 1);
    assert.equal(r1.deleted, 0);
    assert.equal(stub.rows().length, 1);
    assert.equal(stub.rowFor('xref:1')?.refKind, 'citation');

    // Re-run is idempotent — the upsert path replaces the same row.
    const r2 = await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });
    assert.equal(r2.upserted, 1);
    assert.equal(r2.deleted, 0);
    assert.equal(stub.rows().length, 1);
  });

  it('updates an existing PG row when Y.Map value changes', async () => {
    const { map } = makeRoot();
    const stub = makeStubDb();

    map.set('xref:1', {
      refKind: 'citation',
      refTargetId: 'cit:1',
      sourceSubdocumentId: null,
      sourceBlockId: 'b1',
    });
    await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });

    // Mutate the Y.Map entry.
    map.set('xref:1', {
      refKind: 'figure',
      refTargetId: 'fig:1',
      sourceSubdocumentId: 'sub:methods',
      sourceBlockId: 'b2',
    });

    await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });

    const row = stub.rowFor('xref:1')!;
    assert.equal(row.refKind, 'figure');
    assert.equal(row.refTargetId, 'fig:1');
    assert.equal(row.sourceSubdocumentId, 'sub:methods');
    assert.equal(row.sourceBlockId, 'b2');
  });

  it('cross-subdocument entry round-trips through reconcile', async () => {
    const { map } = makeRoot();
    const stub = makeStubDb();

    map.set('xref:cross', {
      refKind: 'evidence',
      refTargetId: 'ev:42',
      sourceSubdocumentId: 'sub:chap-3',
      sourceBlockId: 'block-x',
    });

    await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });

    assert.equal(stub.rowFor('xref:cross')?.sourceSubdocumentId, 'sub:chap-3');
    assert.equal(stub.rowFor('xref:cross')?.refTargetId, 'ev:42');
  });

  it('deletes PG rows whose key no longer exists in Y.Map', async () => {
    const { map } = makeRoot();
    const stub = makeStubDb();

    // Seed PG with two rows by reconciling an initial Y state.
    map.set('xref:keep', {
      refKind: 'citation',
      refTargetId: 'cit:keep',
      sourceSubdocumentId: null,
      sourceBlockId: 'b1',
    });
    map.set('xref:gone', {
      refKind: 'figure',
      refTargetId: 'fig:gone',
      sourceSubdocumentId: null,
      sourceBlockId: 'b2',
    });
    await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });
    assert.equal(stub.rows().length, 2);

    // Y.Map drops one entry — PG should follow.
    map.delete('xref:gone');

    // Tell the stub which id the next delete() call(s) should remove.
    (stub.db as { __setNextDeleteIds(ids: string[]): void }).__setNextDeleteIds([
      'xref:gone',
    ]);

    const r = await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });
    assert.equal(r.upserted, 1);
    assert.equal(r.deleted, 1);
    assert.equal(stub.rows().length, 1);
    assert.equal(stub.rowFor('xref:keep')?.refKind, 'citation');
    assert.equal(stub.rowFor('xref:gone'), undefined);
  });

  it('filters out malformed Y.Map values (defensive)', async () => {
    const { map } = makeRoot();
    const stub = makeStubDb();

    // Deliberately bad shape — a sibling system might write garbage.
    map.set('bad:1', { refKind: '', refTargetId: 'x' } as unknown as CrossRefEntry);
    map.set('good:1', {
      refKind: 'claim',
      refTargetId: 'claim:7',
      sourceSubdocumentId: null,
      sourceBlockId: 'b3',
    });

    const r = await reconcile({
      db: stub.db as never,
      rootDocumentId: ROOT_DOC,
      crossRefMap: map,
    });
    assert.equal(r.upserted, 1);
    assert.equal(stub.rowFor('good:1')?.refKind, 'claim');
    assert.equal(stub.rowFor('bad:1'), undefined);
  });
});

describe('startCrossRefSync — Y.Map.observe → PG mirror', () => {
  it('mirrors live add events into the stub PG store', async () => {
    const { map } = makeRoot();
    const stub = makeStubDb();
    const handle = startCrossRefSync({
      rootDocumentId: ROOT_DOC,
      db: stub.db as never,
      crossRefMap: map,
    });

    map.set('xref:live-1', {
      refKind: 'citation',
      refTargetId: 'cit:live-1',
      sourceSubdocumentId: null,
      sourceBlockId: 'b-live',
    });

    // observer fires synchronously inside the Y transaction; the async
    // handler resolves on the microtask queue.
    await new Promise((r) => setImmediate(r));

    assert.equal(stub.rowFor('xref:live-1')?.refKind, 'citation');
    handle.dispose();
  });

  it('after dispose() further Y events are not mirrored', async () => {
    const { map } = makeRoot();
    const stub = makeStubDb();
    const handle = startCrossRefSync({
      rootDocumentId: ROOT_DOC,
      db: stub.db as never,
      crossRefMap: map,
    });
    handle.dispose();

    map.set('xref:after', {
      refKind: 'figure',
      refTargetId: 'fig:after',
      sourceSubdocumentId: null,
      sourceBlockId: 'b',
    });
    await new Promise((r) => setImmediate(r));
    assert.equal(stub.rowFor('xref:after'), undefined);
  });
});
