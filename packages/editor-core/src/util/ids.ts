// uuidv7 wrappers used as stable atom-node IDs.
// Per ADR-0001 §2.2: client-id-prefixed UUIDs deduplicate concurrent atom inserts.
// Phase 1 D10 promotion of proto-a/util/ids.ts; same shape, single source.

import { v7 as uuidv7 } from 'uuid';

export function newBlockId(): string {
  return uuidv7();
}

export function newAnchorId(): string {
  return uuidv7();
}

export function newCitationId(): string {
  return uuidv7();
}

export function newCellId(): string {
  return uuidv7();
}

export function newFootnoteId(): string {
  return uuidv7();
}

export function newRevisionId(): string {
  return uuidv7();
}

export function newProvenanceId(): string {
  return uuidv7();
}
