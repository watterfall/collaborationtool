// Headless ProseMirror Schema built from the same extensions the live
// editor uses. Needed by:
//   - commit.ts (PM step round-trip in tests / server-side)
//   - render-myst / render-typst (Phase 1 D12) — both walk the PM tree
//   - sync-gateway / snapshot-worker — server-side document inspection
//
// We use TipTap's `getSchema()` to reuse the extension definitions
// without spinning up an Editor instance.

import { getSchema } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';

import { PAPER_SCHEMA_EXTENSIONS } from './extensions/all';

let cached: Schema | null = null;

/**
 * Singleton paper schema. Same instance across calls so PM nodes from
 * one call validate against the schema of another.
 */
export function paperSchema(): Schema {
  if (!cached) {
    cached = getSchema(PAPER_SCHEMA_EXTENSIONS);
  }
  return cached;
}

/**
 * For tests that need a fresh schema (e.g. mutating extensions across
 * test files). Avoid in production — keeps memory bounded.
 */
export function freshPaperSchema(): Schema {
  return getSchema(PAPER_SCHEMA_EXTENSIONS);
}
