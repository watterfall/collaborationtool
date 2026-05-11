// CrossLayerReference — typed lineage edges between Night / Bridge / Day
// artifacts (ADR-0020 §2.3 + Wave D-3). Each edge:
//
//   1. names the source + target artifact (by id) AND the source +
//      target layer (cached for query without dereferencing);
//   2. tags itself with one of the 6 InteractionMode values;
//   3. carries the principal who recorded the edge and the timestamp;
//   4. supports an optional free-form note (why this edge exists).
//
// The edge is the unit of triadic provenance: every cross-layer move
// produces one of these. Wave D-4 will surface them as a graph in the
// triadic UI; Wave D-5 will use them as a dogfood metric (≥6 modes
// represented over 30 days = 三层联通真正打通).

import type {
  ArtifactLayer,
  NightArtifactId,
  BridgeArtifactId,
  DayArtifactId,
  IsoDateTime,
  PrincipalId,
} from './_shared';
import type { InteractionMode } from './interaction-mode';
import {
  INTERACTION_MODE_CANONICAL_FROM,
  INTERACTION_MODE_CANONICAL_TO,
} from './interaction-mode';

// Union of all cross-layer artifact IDs. Branded as `string` upstream,
// so consumers should validate the id+layer pair themselves.
export type AnyArtifactId = NightArtifactId | BridgeArtifactId | DayArtifactId;

export interface CrossLayerReference {
  id: string; // edge id (uuid)
  fromArtifactId: AnyArtifactId;
  fromLayer: ArtifactLayer;
  toArtifactId: AnyArtifactId;
  toLayer: ArtifactLayer;
  mode: InteractionMode;
  recordedBy: PrincipalId;
  recordedAt: IsoDateTime;
  note?: string;
}

export interface CreateCrossLayerReferenceInput {
  id: string;
  fromArtifactId: AnyArtifactId;
  fromLayer: ArtifactLayer;
  toArtifactId: AnyArtifactId;
  toLayer: ArtifactLayer;
  mode: InteractionMode;
  recordedBy: PrincipalId;
  recordedAt: IsoDateTime;
  note?: string;
}

export function createCrossLayerReference(
  input: CreateCrossLayerReferenceInput,
): CrossLayerReference {
  return { ...input };
}

export type CrossLayerValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Check that the edge's from/to layers are consistent with the mode's
 * canonical direction. `method-transfer` is bidirectional so any pair
 * of layers is allowed for it.
 *
 * The validator also rejects self-layer edges (Night→Night, Bridge→
 * Bridge, Day→Day) — those are intra-layer references, not Triadic
 * cross-layer references; they belong in their own layer's reference
 * model (e.g. Question.childQuestionIds), not here.
 */
export function validateCrossLayerReference(
  ref: CrossLayerReference,
): CrossLayerValidationResult {
  if (ref.fromLayer === ref.toLayer) {
    return {
      valid: false,
      reason: 'cross-layer-required: from-layer and to-layer must differ',
    };
  }

  const expectedFrom = INTERACTION_MODE_CANONICAL_FROM[ref.mode];
  const expectedTo = INTERACTION_MODE_CANONICAL_TO[ref.mode];

  // method-transfer is intrinsically bidirectional — any cross-layer
  // pair is allowed.
  if (expectedFrom === undefined && expectedTo === undefined) {
    return { valid: true };
  }

  // For the directional modes, the from/to layers must match the
  // canonical direction OR be its exact reverse (since modes describe
  // flows that can run either way in practice — e.g. anomaly-input
  // canonical = day→night but the same edge documented from the
  // Night-side reader's perspective could be recorded as night-source
  // anomaly-input. We enforce only that ONE end matches.)
  const matchesCanonical =
    ref.fromLayer === expectedFrom && ref.toLayer === expectedTo;
  const matchesReverse =
    ref.fromLayer === expectedTo && ref.toLayer === expectedFrom;

  if (!matchesCanonical && !matchesReverse) {
    return {
      valid: false,
      reason: `mode ${ref.mode} canonical direction is ${expectedFrom}→${expectedTo}; got ${ref.fromLayer}→${ref.toLayer}`,
    };
  }

  return { valid: true };
}

/**
 * Group references by InteractionMode — useful for Wave D-5 dogfood
 * metric "≥6 modes represented over 30 days".
 */
export function countReferencesByMode(
  refs: readonly CrossLayerReference[],
): ReadonlyMap<InteractionMode, number> {
  const counts = new Map<InteractionMode, number>();
  for (const r of refs) {
    counts.set(r.mode, (counts.get(r.mode) ?? 0) + 1);
  }
  return counts;
}
