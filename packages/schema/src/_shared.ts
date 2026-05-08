// Shared base types and ID brands used across the 8 core entities.
// See plan0/adr/0001-data-model-and-crdt-split.md for full rationale.

export type DocumentId = string;
export type BlockId = string;
export type CitationId = string;
export type AnchorId = string;
export type ThreadId = string;
export type CommentId = string;
export type RevisionId = string;
export type ContributionId = string;
export type ProvenanceId = string;
export type AgentId = string;
export type PrincipalId = string;

export type LanguageTag = 'zh-Hans' | 'zh-Hant' | 'en' | string;

export type IsoDateTime = string;
