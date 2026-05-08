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
import * as Y from 'yjs';

export interface CommitPayload {
  pmStepsBinary: Uint8Array;
  yjsUpdateBinary: Uint8Array;
  baseStateVector: Uint8Array;
}

export interface SerializeStepsArgs {
  /** Steps that the proposer's PM transactions accumulated. */
  steps: ReadonlyArray<Step>;
  /** The base Y.Doc (state vector from which the steps applied). */
  baseDoc: Y.Doc;
  /** The Y.Doc after the steps were applied (used to compute diff). */
  resultDoc: Y.Doc;
}

export function buildCommitPayload(args: SerializeStepsArgs): CommitPayload {
  const stepsJson = args.steps.map((s) => s.toJSON());
  const pmStepsBinary = new TextEncoder().encode(JSON.stringify(stepsJson));

  const baseStateVector = Y.encodeStateVector(args.baseDoc);
  const yjsUpdateBinary = Y.encodeStateAsUpdate(args.resultDoc, baseStateVector);

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
  /** A fresh Y.Doc with the base state already applied. */
  doc: Y.Doc;
  /** The yjsUpdateBinary produced by buildCommitPayload. */
  yjsUpdateBinary: Uint8Array;
}

/**
 * Apply a previously-encoded Yjs binary delta to a doc. Mutates doc in
 * place; round-trip with `Y.encodeStateAsUpdate(doc)` should yield the
 * original update bytes (modulo Yjs's natural compression).
 */
export function applyYjsUpdate(args: ApplyYjsUpdateArgs): void {
  Y.applyUpdate(args.doc, args.yjsUpdateBinary);
}

/**
 * Compute the state vector the receiver would need to advance from
 * (baseDoc -> baseDoc + this update). Useful for the gateway snapshot
 * worker (D11) when reconciling drafts against a moving body state.
 */
export function nextStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}
