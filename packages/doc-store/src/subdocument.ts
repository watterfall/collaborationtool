// Phase 4 W7.1 — Subdocument helpers.
//
// `DocumentHandle.getSubdocument(name)` is the primary entry; this
// module provides a couple of convenience functions for ADR-0014 W5
// callers that previously reached into Y.Doc directly.

import type { DocumentHandle } from './types';

/**
 * Convenience: open or create a subdocument by name and apply a remote
 * update if provided. Mirrors the parent.getSubdocument(name) +
 * applyUpdate pattern used by snapshot replay.
 */
export function openSubdocument(
  parent: DocumentHandle,
  name: string,
  update?: Uint8Array,
): DocumentHandle {
  const child = parent.getSubdocument(name);
  if (update && update.byteLength > 0) {
    child.applyUpdate(update);
  }
  return child;
}

/**
 * Convenience: encode a subdocument's full state for transport. Used by
 * the snapshot worker when persisting subdoc bodies separately from the
 * root document binary.
 */
export function encodeSubdocumentState(
  parent: DocumentHandle,
  name: string,
): Uint8Array {
  return parent.getSubdocument(name).encodeStateAsUpdate();
}
