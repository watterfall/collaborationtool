// ThoughtExperiment — Night atomic unit, mode-E representative.
//
// Source: jili's Night_Science_Cases_Revised.md mode E — 思想实验
// (20+ canonical cases): 薛定谔的猫 → 量子退相干; 麦克斯韦妖 → 信息
// 热力学 Landauer 原理; EPR 悖论 → 贝尔实验 → 2022 诺奖; 孪生子悖论 →
// GPS 相对论校正; 黑洞火墙 (AMPS) → ER=EPR 猜想; 全息原理 → AdS/CFT;
// 费米悖论 / 奥尔伯斯佯谬 / 人择原理 / 中文房间 / 缸中之脑 / 智能爆炸
// / 芝诺悖论 / 罗素悖论 / 哥德尔不完备 / Banach-Tarski.
//
// Per Einstein: thought experiments are sometimes more powerful than
// physical experiments — they expose hidden contradictions in our
// concepts.

import type { NightArtifactBase } from './_shared';

export interface ThoughtExperimentOutcome {
  // Brief label ("the cat is alive" / "the cat is dead and alive").
  label: string;
  // Reasoning chain leading to this outcome.
  reasoning: string;
  // What does this outcome reveal / imply about the underlying system?
  interpretation: string;
}

export interface ThoughtExperiment extends NightArtifactBase {
  kind: 'thought-experiment';
  // The hypothetical setup ("Imagine a cat in a sealed box with a
  // radioactive atom...").
  premise: string;
  // Branches / outcomes explored under the premise.
  outcomes: readonly ThoughtExperimentOutcome[];
  // What real-world implication does this thought experiment have?
  realWorldImplication?: string;
  // If a real experiment has tested any branch, link it (e.g. EPR →
  // Bell test → 2022 Nobel).
  empiricalFollowUp?: string;
}
