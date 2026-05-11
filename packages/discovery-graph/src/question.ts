// Question — Night atomic unit with a richer lifecycle.
//
// Per Night_Science_Complete.md 7 大原则 #1 "好问题胜过好答案" and
// plan §4.1 "questions live longer than any single paper". Questions
// are decomposable (Polymath-style), reopenable when new evidence
// arrives, and document dead-ends transparently (反 publication bias).

import type {
  NightArtifactBase,
  NightArtifactId,
  IsoDateTime,
  PrincipalId,
} from './_shared';

export type QuestionLifecycle =
  | 'open' // 未解决
  | 'contested' // 多假设竞争中
  | 'resolved' // 已有 accepted answer
  | 'reopened'; // 之前 resolved 但新 evidence 重启

export interface QuestionResolution {
  resolvedAt: IsoDateTime;
  resolvedBy: PrincipalId;
  resolutionNote: string;
  // Reference to the answer artifact (claim / manuscript / Bridge concept
  // prototype) once promotion happens. Wave D-3 will type this as a
  // proper cross-layer reference.
  answerArtifactId?: string;
}

export interface Question extends NightArtifactBase {
  kind: 'question';
  lifecycle: QuestionLifecycle;
  // Sub-questions (decomposition per Polymath, plan §F.2 Pattern 4).
  childQuestionIds?: readonly NightArtifactId[];
  // Parent question if this is itself a decomposition.
  parentQuestionId?: NightArtifactId;
  // Resolution data (populated only when lifecycle === 'resolved').
  resolution?: QuestionResolution;
  // Re-opens timeline: timestamps + reasons (lifecycle === 'reopened').
  reopenedAt?: readonly IsoDateTime[];
}
