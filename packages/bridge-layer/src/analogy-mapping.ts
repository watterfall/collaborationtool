// AnalogyMapping — Bridge atomic unit (ADR-0020 §2.1).
//
// A structural alignment between a Night-layer Metaphor (source domain)
// and a target scientific object, made explicit enough that the mapping
// can be inspected, challenged, and reused. Where a Night Metaphor says
// "X is like Y", an AnalogyMapping enumerates which relations carry
// over, which break down, and which open new predictions.
//
// Theoretical basis: Gentner Structure-Mapping Engine (relations transfer,
// surface features don't) + Koestler bisociation + plan §F.4 BB1
// "Relational Scaffold". Distinct from HypothesisFormalization in that
// it preserves the analogical structure as a reusable artifact rather
// than collapsing into a single testable claim.
//
// Examples: explicitly mapping "ant colony foraging" → "load balancing
// in distributed systems" with 7 relations transferred and 2 known
// disanalogies; mapping "ecological succession" → "research-program
// life cycle" in studies of science itself.

import type { BridgeArtifactBase, NightArtifactId } from './_shared';

// A single relation that transfers between source and target.
export interface MappedRelation {
  // The relation as it exists in the source domain.
  sourceRelation: string;
  // Its analog in the target domain.
  targetRelation: string;
  // How confident is the mapping? Affects downstream consumers'
  // weighting when generating hypotheses from this analogy.
  confidence: 'strong' | 'plausible' | 'speculative';
  // Brief justification for why the relation transfers (or why this
  // mapping is contested).
  rationale?: string;
}

export type AnalogyValidationStatus =
  | 'proposed' // 刚 surface
  | 'reviewed' // 同行检视过
  | 'productive' // 已产出至少 1 个下游 hypothesis 或 prototype
  | 'broken'; // 检视后认定不能 transfer（仍保留为反例）

export interface AnalogyMapping extends BridgeArtifactBase {
  kind: 'analogy-mapping';
  // Upstream Night Metaphor (typed as NightArtifactId; consumers can
  // resolve via discovery-graph). Wave D-3 will upgrade to typed
  // cross-layer reference with interaction-mode 'metaphor-bridge'.
  sourceMetaphorId: NightArtifactId;
  // Restated source / target domains for self-containment (so the
  // AnalogyMapping is comprehensible without dereferencing).
  sourceDomain: string;
  targetDomain: string;
  // The set of structural relations that transfer.
  mappedRelations: readonly MappedRelation[];
  // Relations known NOT to transfer (essential per Gentner — without
  // this, the analogy is overclaimed).
  knownDisanalogies: readonly string[];
  // New predictions / hypotheses the analogy generates (free-form
  // pointers; full hypothesis formalization is a separate Bridge unit).
  generatedPredictions?: readonly string[];
  // Validation lifecycle.
  validationStatus: AnalogyValidationStatus;
}
