// ConceptPrototype — Bridge atomic unit (ADR-0020 §2.1).
//
// A minimum-viable demonstration of an idea: working code that proves a
// metaphor isn't just rhetoric, a small dataset that shows a method
// produces non-trivial output, a sketch that became a build-able
// schematic. Concept prototypes do not need to clear publication bars —
// they only need to be *handleable* by other people.
//
// Source: jili's Night_Science_expanded.md "Bridge 工具矩阵" — concept
// prototype is one of 4 Bridge产出.
//
// Examples: a Jupyter notebook reproducing a metaphor's prediction;
// a 5-minute video demo of an interaction pattern; a small open dataset
// that operationalizes a previously qualitative claim.

import type { BridgeArtifactBase } from './_shared';

export type PrototypeMaturity =
  | 'sketch' // 极初步，半成品
  | 'demo' // 可演示，但可能脆弱
  | 'reproducible' // 可被第三方复现
  | 'production-candidate'; // 已可考虑迁移到 Day-layer 代码库

export interface ConceptPrototype extends BridgeArtifactBase {
  kind: 'concept-prototype';
  maturity: PrototypeMaturity;
  // What this prototype demonstrates in one sentence. Should be testable
  // by a third party with the supplied artifactRef.
  demonstrationClaim: string;
  // Where the artifact lives — a repo URL, a notebook path, a binary
  // hash. Bridge layer does not host blobs; it points at them.
  artifactRef: string;
  // Optional reproduction instructions (env, commands, expected output).
  reproductionNotes?: string;
  // Known limitations / failure modes — Bridge artifacts must declare
  // their limits up-front (per Yanai-Lercher: anti-overclaiming).
  knownLimitations?: string;
}
