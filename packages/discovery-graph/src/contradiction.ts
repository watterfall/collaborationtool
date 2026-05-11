// Contradiction — Night atomic unit, mode-B representative.
//
// Source: jili's Night_Science_Cases_Revised.md mode B — 矛盾触发.
// Examples: Griffith 转化 (death-to-life transformation), 端粒 (Hayflick
// limit), 跳跃基因 (McClintock — 30 年后诺奖), 水平基因转移, 抗生素
// 耐药, 类星体能量, 冰期理论.
//
// Per plan §2.1 Pattern 3 "Contradiction as Generative Engine":
//   "disagreement is fuel, not noise; contradiction detection +
//    resolution is the metabolic loop of science."
// 7 大原则 #3 "矛盾视作机遇" (Night_Science_Complete.md).
// Future House ContraCrow data: 2.34 contradictions/paper (70%
// validated as real).

import type { NightArtifactBase } from './_shared';

// Two-sided tension. Multi-pole contradictions decompose into pairs;
// keeps the schema simple per ADR-0020 §1.5 (start small enum, grow via
// plugin tag, not migration).
export interface ContradictionPole {
  // Free-form prose describing one side of the contradiction.
  description: string;
  // Optional references (URL / DOI / internal artifact ID) supporting
  // this pole.
  supportingReferences?: readonly string[];
}

export type ContradictionType =
  | 'data-vs-theory' // 数据与理论冲突 (Griffith / 端粒)
  | 'theory-vs-theory' // 两个理论冲突 (matrix mechanics vs wave mechanics)
  | 'expert-vs-expert' // 不同专家意见相左
  | 'observation-vs-observation' // 两组观测互不相容
  | 'principle-vs-result'; // 一般原则与具体结果冲突

export type ContradictionResolutionStatus =
  | 'open' // 未解决 — 仍然是 generative engine
  | 'partially-resolved' // 部分调和 (e.g. 不同 regime 各自适用)
  | 'resolved'; // 完全解决 — 通常意味着 paradigm shift

export interface Contradiction extends NightArtifactBase {
  kind: 'contradiction';
  contradictionType: ContradictionType;
  poleA: ContradictionPole;
  poleB: ContradictionPole;
  // Why this contradiction matters / what's at stake. The "tension
  // significance" — required for the contradiction to be productive
  // rather than noise.
  significance: string;
  resolutionStatus: ContradictionResolutionStatus;
}
