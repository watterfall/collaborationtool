// DesignFiction — Bridge atomic unit (ADR-0020 §2.1).
//
// A narrative artifact that depicts a future, counterfactual, or
// speculative scenario in concrete detail — used to surface implicit
// assumptions, probe stakeholder reactions, and stress-test research
// directions before committing to formal hypotheses.
//
// Source: jili's Night_Science_expanded.md "Bridge 工具矩阵" — design
// fiction is one of 4 Bridge产出. Tradition draws on speculative design
// (Dunne & Raby), narrative prototyping (Brian Merchant / Julian Bleecker),
// and the "design fiction as inquiry" methodology in HCI.
//
// Examples: "What does a research paper look like in 2035 if Bridge-
// layer is the default?"; "Imagine the day a critic publishes an
// open-source counter-prototype to your model"; "A user-facing onboarding
// for an LLM trained only on retracted papers".

import type { BridgeArtifactBase } from './_shared';

export type FictionStance =
  | 'aspirational' // 描绘期望的未来（推动方向）
  | 'cautionary' // 描绘负面未来（暴露风险）
  | 'parodic' // 戏仿当下，揭示荒谬
  | 'counterfactual'; // 改一个历史变量后会发生什么

export interface DesignFiction extends BridgeArtifactBase {
  kind: 'design-fiction';
  stance: FictionStance;
  // The scenario's anchor in time/space — e.g. "2031, a university
  // library", "an alternate timeline where preprints came in 1970".
  setting: string;
  // The implicit assumption(s) the fiction is designed to expose.
  // Crucial: design fiction without an identified assumption is just
  // sci-fi, not an inquiry tool.
  assumptionsToExpose: readonly string[];
  // Stakeholders / personas the fiction prompts to react. Bridge
  // artifacts get traction from real readers, not theoretical ones.
  intendedAudience?: string;
  // Optional companion artifact ref (storyboard, comic, video).
  companionArtifactRef?: string;
}
