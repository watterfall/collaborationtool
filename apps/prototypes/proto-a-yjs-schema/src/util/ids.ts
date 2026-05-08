// uuidv7 wrappers used as stable atom-node IDs.
// Per ADR-0001 §2.2: client-id-prefixed UUIDs deduplicate concurrent atom inserts.

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
