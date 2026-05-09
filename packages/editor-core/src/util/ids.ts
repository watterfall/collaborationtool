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

// ADR-0011 (Phase 2 W5): claim/evidence/claim_link 全局唯一 ID。
// claim 跨文档复用 ⇒ ID 在编辑器侧分配（同 citation 模式）；W7 dogfood
// gate 实测后调整。
export function newClaimId(): string {
  return uuidv7();
}

export function newEvidenceId(): string {
  return uuidv7();
}

export function newClaimLinkId(): string {
  return uuidv7();
}
