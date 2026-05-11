// Commit boundary serialiser. Builds a Revision-payload-shaped object
// from an in-memory PM state + Y.Doc state, deterministically:
//
//   pmStepsBinary    = JSON-encoded prosemirror Step array (serialised
//                      to bytes; readable in PG bytea column from D7)
//   yjsUpdateBinary  = Y.encodeStateAsUpdate(ydoc, baseStateVector)
//                      so the receiver can apply just the delta
//   baseStateVector  = Y.encodeStateVector(baseDoc) — what the proposer
//                      forked from
//
// All three round-trip byte-identically, which is what proto-c findings
// §1 demanded for Phase 1: real PM steps replace the placeholder.
//
// Where this is called:
//   - apps/web /api/revision (server side of D14 approval flow)
//   - tests in commit.test.ts (round-trip assertion)
// Both server and client can call this; the function is pure.

import type { Step } from '@tiptap/pm/transform';
import type { Schema } from '@tiptap/pm/model';

import {
  type DocumentHandle,
  yApplyUpdate,
  yEncodeStateAsUpdate,
  yEncodeStateVector,
  type YDoc,
} from '@collaborationtool/doc-store';

/**
 * Phase 4 W7.1: API accepts DocumentHandle.
 * Phase 4.5 W1.1 (codex review 2026-05-11 follow-up): byte-level
 * encoding now dispatches through the handle's abstract methods
 * (`encodeStateVector` / `encodeDelta` / `applyUpdate`). Raw Y.Doc
 * callers (legacy tests) keep working via the module-level Yjs
 * primitives. **No `.yDoc` reach-through in this file.**
 */
type DocLike = DocumentHandle | YDoc;

function isHandle(d: DocLike): d is DocumentHandle {
  // Discriminator: DocumentHandle defines `encodeStateAsUpdate()` as
  // an instance method; raw Y.Doc does not (Yjs provides
  // `Y.encodeStateAsUpdate(doc)` as a module function only).
  return typeof (d as DocumentHandle).encodeStateAsUpdate === 'function';
}

function encodeStateVectorOf(d: DocLike): Uint8Array {
  return isHandle(d) ? d.encodeStateVector() : yEncodeStateVector(d);
}

function encodeDeltaOf(d: DocLike, baseStateVector: Uint8Array): Uint8Array {
  return isHandle(d)
    ? d.encodeDelta(baseStateVector)
    : yEncodeStateAsUpdate(d, baseStateVector);
}

function applyUpdateTo(d: DocLike, update: Uint8Array): void {
  if (isHandle(d)) {
    d.applyUpdate(update);
    return;
  }
  yApplyUpdate(d, update);
}

export interface CommitPayload {
  pmStepsBinary: Uint8Array;
  yjsUpdateBinary: Uint8Array;
  baseStateVector: Uint8Array;
}

export interface SerializeStepsArgs {
  /** Steps that the proposer's PM transactions accumulated. */
  steps: ReadonlyArray<Step>;
  /** The base document (state vector from which the steps applied). */
  baseDoc: DocLike;
  /** The document after the steps were applied (used to compute diff). */
  resultDoc: DocLike;
}

export function buildCommitPayload(args: SerializeStepsArgs): CommitPayload {
  const stepsJson = args.steps.map((s) => s.toJSON());
  const pmStepsBinary = new TextEncoder().encode(JSON.stringify(stepsJson));

  const baseStateVector = encodeStateVectorOf(args.baseDoc);
  const yjsUpdateBinary = encodeDeltaOf(args.resultDoc, baseStateVector);

  return { pmStepsBinary, yjsUpdateBinary, baseStateVector };
}

export interface DeserializeStepsArgs {
  pmStepsBinary: Uint8Array;
  schema: Schema;
}

/**
 * Reverse of buildCommitPayload (PM steps only). Used by:
 *   - approval-flow apply on accept
 *   - render-myst / render-typst replaying steps for change-tracked exports
 *   - D15 e2e test asserting byte-stability
 */
export async function deserializeSteps(
  args: DeserializeStepsArgs,
): Promise<Step[]> {
  // TipTap re-exports the prosemirror-transform Step factory; importing
  // through @tiptap/pm/transform dodges Vite/SSR module-resolution loops.
  const { Step: StepCtor } = await import('@tiptap/pm/transform');

  const json = JSON.parse(new TextDecoder().decode(args.pmStepsBinary)) as unknown[];
  if (!Array.isArray(json)) {
    throw new Error('pmStepsBinary did not decode to a JSON array');
  }
  return json.map((stepJson) => StepCtor.fromJSON(args.schema, stepJson));
}

export interface ApplyYjsUpdateArgs {
  /** A fresh document handle with the base state already applied. */
  doc: DocLike;
  /** The yjsUpdateBinary produced by buildCommitPayload. */
  yjsUpdateBinary: Uint8Array;
}

/**
 * Apply a previously-encoded Yjs binary delta to a doc. Mutates doc in
 * place; round-trip with `encodeStateAsUpdate(doc)` should yield the
 * original update bytes (modulo Yjs's natural compression).
 */
export function applyYjsUpdate(args: ApplyYjsUpdateArgs): void {
  applyUpdateTo(args.doc, args.yjsUpdateBinary);
}

/**
 * Compute the state vector the receiver would need to advance from
 * (baseDoc -> baseDoc + this update). Useful for the gateway snapshot
 * worker (D11) when reconciling drafts against a moving body state.
 */
export function nextStateVector(doc: DocLike): Uint8Array {
  return encodeStateVectorOf(doc);
}
