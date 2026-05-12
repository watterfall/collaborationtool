// Stress harness — 5 client × 1000 op CRDT convergence test.
//
// Each client owns its own Y.Doc. Ops mutate a shared Y.Text inside the
// `prosemirror` XmlFragment's first paragraph (a Y.XmlElement). Periodic
// merge fans out updates between all clients. An "offline window" can be
// configured: between [startOp, endOp] one client (id 0) doesn't merge
// with others, then on `endOp` it catches up.
//
// Spike-2 invariant: at the end, all 5 docs must converge to identical
// state (encoded state vector equal) AND emitMarkdown must produce the
// same string. Phase 6 W3-W4 swaps to richer schema ops + assertion on
// markdown line count.

import * as Y from 'yjs';

import { emitMarkdown } from './ydoc-to-markdown';

export interface StressOpts {
  clientCount: number;
  opsPerClient: number;
  /** When set, client 0 stops merging during [startOp, endOp). */
  offlineRound?: { startOp: number; endOp: number };
  seed?: number;
}

export interface StressResult {
  converged: boolean;
  finalText: string;
  totalOps: number;
  /** Identical y-state encoded length across all clients (rough check). */
  stateLengths: number[];
}

// Mulberry32 — small deterministic PRNG so tests are reproducible.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ClientState {
  doc: Y.Doc;
  /** Y.XmlText inside doc's prosemirror fragment first paragraph. */
  text: Y.XmlText;
  /** Last seen state vector per other client; used for incremental sync. */
  knownVectors: Map<number, Uint8Array>;
}

function setupClient(seed?: Uint8Array): ClientState {
  const doc = new Y.Doc();
  if (seed) {
    Y.applyUpdate(doc, seed);
  } else {
    const fragment = doc.getXmlFragment('prosemirror');
    // Seed with a single paragraph containing a Y.XmlText we can mutate.
    // (y-prosemirror serializer expects Y.XmlElement / Y.XmlText children of
    // XmlFragment — plain Y.Text triggers "Unexpected case".)
    doc.transact(() => {
      const para = new Y.XmlElement('paragraph');
      const text = new Y.XmlText('');
      para.insert(0, [text]);
      fragment.insert(0, [para]);
    });
  }
  const fragment = doc.getXmlFragment('prosemirror');
  const para = fragment.get(0) as Y.XmlElement;
  const text = para.get(0) as Y.XmlText;
  return { doc, text, knownVectors: new Map() };
}

function syncPair(a: ClientState, b: ClientState, aId: number, bId: number): void {
  // Compute updates each side needs from the other.
  const aVec = a.knownVectors.get(bId) ?? Y.encodeStateVector(a.doc);
  const bVec = b.knownVectors.get(aId) ?? Y.encodeStateVector(b.doc);
  const updateForA = Y.encodeStateAsUpdate(b.doc, aVec);
  const updateForB = Y.encodeStateAsUpdate(a.doc, bVec);
  Y.applyUpdate(a.doc, updateForA);
  Y.applyUpdate(b.doc, updateForB);
  a.knownVectors.set(bId, Y.encodeStateVector(b.doc));
  b.knownVectors.set(aId, Y.encodeStateVector(a.doc));
}

// Module-level state for debug visibility on test failures.
let lastClients: ClientState[] = [];
export function debugClients(): { texts: string[]; markdowns: string[] } {
  return {
    texts: lastClients.map((c) => c.text.toString()),
    markdowns: lastClients.map((c) => emitMarkdown(c.doc)),
  };
}

export function runStress(opts: StressOpts): StressResult {
  const rng = makeRng(opts.seed ?? 42);
  // Client 0 seeds the initial doc (paragraph + XmlText). Others clone via
  // applyUpdate so all 5 share the same root paragraph identity — otherwise
  // each client's setup creates its own paragraph and sync would yield 5
  // paragraphs, with each client's cached `text` pointing only at its own.
  const initial = setupClient();
  const seedUpdate = Y.encodeStateAsUpdate(initial.doc);
  const clients: ClientState[] = [initial];
  for (let i = 1; i < opts.clientCount; i++) {
    clients.push(setupClient(seedUpdate));
  }
  lastClients = clients;

  // Each "global op" picks a random client + applies an insert.
  const totalOps = opts.clientCount * opts.opsPerClient;
  for (let op = 0; op < totalOps; op++) {
    const clientId = Math.floor(rng() * opts.clientCount);
    const client = clients[clientId]!;
    // Insert a small random fragment at a random pos.
    const pos = Math.floor(rng() * (client.text.length + 1));
    const ch = String.fromCharCode(97 + (op % 26)); // a–z cycling
    client.text.insert(pos, ch);

    // Periodic sync every 20 ops, except: if offlineRound active and
    // clientId === 0, do not sync 0 with others.
    if (op > 0 && op % 20 === 0) {
      const offline = opts.offlineRound;
      const isOfflineWindow =
        offline !== undefined && op >= offline.startOp && op < offline.endOp;
      for (let i = 0; i < clients.length; i++) {
        for (let j = i + 1; j < clients.length; j++) {
          if (isOfflineWindow && (i === 0 || j === 0)) continue;
          syncPair(clients[i]!, clients[j]!, i, j);
        }
      }
    }
  }

  // Final reconciliation pass (full mesh) — guarantees convergence.
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      syncPair(clients[i]!, clients[j]!, i, j);
    }
  }

  // Check convergence: all clients should have the same Y.Text content.
  const texts = clients.map((c) => c.text.toString());
  const allEqual = texts.every((t) => t === texts[0]);
  const markdowns = clients.map((c) => emitMarkdown(c.doc));
  const markdownEqual = markdowns.every((m) => m === markdowns[0]);

  return {
    converged: allEqual && markdownEqual,
    finalText: markdowns[0] ?? '',
    totalOps,
    stateLengths: clients.map((c) => Y.encodeStateAsUpdate(c.doc).length),
  };
}
