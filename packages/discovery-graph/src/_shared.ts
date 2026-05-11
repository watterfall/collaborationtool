// Shared base types and ID brands for the discovery-graph package.
// See plan0/adr/0020-night-bridge-day-triadic-architecture.md §2.1
// for the Triadic Architecture rationale (Night / Bridge / Day three-
// layer equal-output system).

import type {
  PrincipalId,
  IsoDateTime,
  LanguageTag,
  ProvenanceId,
} from '@collaborationtool/schema';

export type { PrincipalId, IsoDateTime, LanguageTag, ProvenanceId };

// Branded IDs for the three layers. Bridge + Day artifact IDs are
// declared here (not yet implemented) to anchor cross-layer reference
// edges in Wave D-3.
export type NightArtifactId = string;
export type BridgeArtifactId = string;
export type DayArtifactId = string;
export type InteractionId = string;

// Layer discriminator (used in cross-layer references and search).
export type ArtifactLayer = 'night' | 'bridge' | 'day';

// Visibility tiers per ADR-0020 §2.1 + first principle #1
// (Night defaults private — "夜科学需要未被监视的空间";
//  Bridge defaults collaborator; Day selectable).
export type VisibilityTier =
  | 'private' // 仅作者
  | 'collaborator' // 同项目协作者
  | 'org' // 同组织
  | 'public'; // 公开

// Status lifecycle for Night artifacts. Some artifact types extend this
// with richer lifecycles (e.g. Question has open/contested/resolved/
// reopened).
export type ArtifactStatus =
  | 'draft' // 草稿，未提交
  | 'active' // 活跃中
  | 'archived' // 不再活跃但保留
  | 'superseded'; // 被另一 artifact 取代

// Base shape inherited by all Night artifact types. Body is free-form
// per Yanai-Lercher 2020 "两种语言" — night language permits anything
// goes (anthropomorphism, metaphor, sloppy reasoning).
export interface NightArtifactBase {
  id: NightArtifactId;
  authorPrincipalId: PrincipalId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  visibility: VisibilityTier;
  status: ArtifactStatus;
  language?: LanguageTag;
  // Provenance per first principle #11.
  provenanceId: ProvenanceId;
  // 5 创意触发模式 tags (0-N per artifact, not workflow-forced).
  modeTags: readonly import('./mode-tag').ModeTag[];
  title: string;
  bodyMarkdown: string;
}
