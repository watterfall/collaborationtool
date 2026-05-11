// HypothesisFormalization — Bridge atomic unit (ADR-0020 §2.1).
//
// The act of taking an informal Night-layer idea (a hunch, metaphor,
// contradiction-driven question) and turning it into a testable claim:
// declaring the dependent / independent variables, the prediction's
// directionality, the operationalization, and the success / null
// conditions. Crucially this is a Bridge artifact in its own right —
// not just a step on the way to a Day paper. Failed formalizations
// (where the informal idea cannot be operationalized) are themselves
// valuable outputs, and are first-class here.
//
// Source: jili's Night_Science_expanded.md "Bridge 工具矩阵" + plan
// Appendix B (Yanai-Lercher 2020 "Two languages": this is the
// translation between languages).
//
// Examples: turning "phase-separation droplets" (Brangwynne 2009
// metaphor) into "membrane-less organelles exhibit measurable surface
// tension consistent with liquid droplet model X under conditions Y".

import type { BridgeArtifactBase, NightArtifactId } from './_shared';

export type FormalizationOutcome =
  | 'formalizable' // 成功落到 testable claim
  | 'requires-new-method' // 思路 valid 但缺合适测量手段
  | 'underdetermined' // 信息不足以约束 hypothesis
  | 'not-formalizable'; // 本质 untestable（标记为有价值的"边界"发现）

// A measurable variable in the testable claim.
export interface FormalizedVariable {
  name: string;
  // Role in the prediction.
  role: 'independent' | 'dependent' | 'covariate' | 'control';
  // How to measure it operationally (instrument, scale, threshold).
  operationalization: string;
}

export interface HypothesisFormalization extends BridgeArtifactBase {
  kind: 'hypothesis-formalization';
  // The Night artifact that this formalizes. Strongly typed so the
  // lineage edge is enforced by schema. (Wave D-3 will upgrade this
  // to a typed cross-layer reference with interaction-mode 'hypothesis-
  // output' or 'metaphor-bridge'.)
  sourceNightArtifactId: NightArtifactId;
  // The informal idea, restated in night-language for grounding.
  informalIdea: string;
  // The testable claim — must contain a directional prediction.
  testableClaim: string;
  // Variables involved.
  variables: readonly FormalizedVariable[];
  // What outcome would falsify the claim (Popper-style).
  falsificationCondition: string;
  // Was the formalization itself successful?
  outcome: FormalizationOutcome;
  // If outcome !== 'formalizable', explain what blocks it. Anti-
  // publication-bias: failed formalizations are recorded openly.
  blockingNote?: string;
}
