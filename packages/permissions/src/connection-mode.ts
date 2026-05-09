// Connection mode = the Phase 1 gateway's coarse-grained classification
// of an authenticated principal on a single document. ADR-0002 §2.4
// pseudocode:
//
//   if has block.commit  → "writer"
//   if has block.propose → "proposer"
//   else                 → "reader"
//
// This is the Phase 1 simplification — the entire connection picks one
// mode at handshake time. Phase 3 will switch to per-frame node-range
// checks (Yjs subdocument per section), at which point this function
// disappears in favour of `canApplyUpdate(principalId, documentId, update)`
// inspecting the update payload.

import type { Capability } from './capabilities';

export const CONNECTION_MODES = ['reader', 'proposer', 'writer'] as const;
export type ConnectionMode = (typeof CONNECTION_MODES)[number];

export interface ClassifyResult {
  /** null = principal not authorised on this document at all (deny connection) */
  mode: ConnectionMode | null;
  /** Why this mode was chosen — used for logging and debugging. */
  reason: string;
}

export function classifyConnectionMode(
  capabilities: ReadonlySet<Capability>,
): ClassifyResult {
  if (!capabilities.has('document.read')) {
    return { mode: null, reason: 'missing-document.read' };
  }
  if (capabilities.has('block.commit')) {
    return { mode: 'writer', reason: 'has-block.commit' };
  }
  if (capabilities.has('block.propose')) {
    return { mode: 'proposer', reason: 'has-block.propose-not-commit' };
  }
  return { mode: 'reader', reason: 'no-write-capability' };
}
