// Metaphor — Night atomic unit, mode-A representative.
//
// Source: jili's Night_Science_Cases_Revised.md mode A — 隐喻重塑.
// Examples: 相分离液滴 (phase-separation droplets / Brangwynne 2009),
// 红皇后假说 (Red Queen hypothesis), 系统一 & 二 (Kahneman dual-process),
// 表观遗传景观 (epigenetic landscape), 微生物组器官 (microbiome-as-organ).
//
// A metaphor maps structure from a source domain to a target domain
// per Gentner SME (structural alignment) and Koestler bisociation. The
// systematic causal relations transfer; surface features do not.
// (See plan §F.4 BB1 Relational Scaffold + BB5 Bisociation Collision.)

import type { NightArtifactBase } from './_shared';

export interface Metaphor extends NightArtifactBase {
  kind: 'metaphor';
  // Source domain — where the structural pattern comes from
  // (e.g. "liquid droplets" / "chess game" / "computer hardware").
  sourceDomain: string;
  // Target domain — the scientific object the metaphor illuminates
  // (e.g. "intracellular condensates" / "co-evolution dynamics").
  targetDomain: string;
  // The structural mapping itself — free-form prose explaining which
  // relations carry over.
  mappingDescription: string;
  // Known disanalogies — important per Gentner: only systematic causal
  // relations transfer; surface features do not. Tracking known
  // breakdowns prevents over-extension of the metaphor.
  knownDisanalogies?: string;
}
