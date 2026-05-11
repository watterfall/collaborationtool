// Discriminated union of all 4 Bridge atomic unit types (ADR-0020 §2.1).
//
// Use this when handling Bridge artifacts polymorphically: fetching by
// id, rendering in a feed, exporting to JSON, etc. TypeScript narrows
// the union via the `kind` discriminator field.

import type { ConceptPrototype } from './concept-prototype';
import type { DesignFiction } from './design-fiction';
import type { HypothesisFormalization } from './hypothesis-formalization';
import type { AnalogyMapping } from './analogy-mapping';

export type BridgeArtifact =
  | ConceptPrototype
  | DesignFiction
  | HypothesisFormalization
  | AnalogyMapping;

export type BridgeArtifactKind = BridgeArtifact['kind'];

export const BRIDGE_ARTIFACT_KINDS: readonly BridgeArtifactKind[] = [
  'concept-prototype',
  'design-fiction',
  'hypothesis-formalization',
  'analogy-mapping',
] as const;

const KIND_SET: ReadonlySet<string> = new Set<string>(BRIDGE_ARTIFACT_KINDS);

export function isBridgeArtifactKind(value: unknown): value is BridgeArtifactKind {
  return typeof value === 'string' && KIND_SET.has(value);
}

// Type narrowing helpers for downstream code.

export function isConceptPrototype(
  artifact: BridgeArtifact,
): artifact is ConceptPrototype {
  return artifact.kind === 'concept-prototype';
}

export function isDesignFiction(
  artifact: BridgeArtifact,
): artifact is DesignFiction {
  return artifact.kind === 'design-fiction';
}

export function isHypothesisFormalization(
  artifact: BridgeArtifact,
): artifact is HypothesisFormalization {
  return artifact.kind === 'hypothesis-formalization';
}

export function isAnalogyMapping(
  artifact: BridgeArtifact,
): artifact is AnalogyMapping {
  return artifact.kind === 'analogy-mapping';
}
