// Public API of @collaborationtool/editor-core.
//
// The Editor React component is the primary export for apps/web. Schema
// + commit helpers are headless and used by tests / snapshot worker /
// future render packages.

export { Editor, type EditorProps } from './Editor';
export type { Editor as TipTapEditor } from '@tiptap/core';
export { paperSchema, freshPaperSchema } from './schema';
export {
  PAPER_SCHEMA_EXTENSIONS,
  AgentTrigger,
  AnnotationAnchor,
  CitationPasteHandler,
  CitationRef,
  Claim,
  ClaimReviewAnchor,
  ComputationalCell,
  DatasetRef,
  Equation,
  Evidence,
  Figure,
  FigureCaption,
  FootnoteRef,
  InlineEquation,
} from './extensions/all';
export {
  DOI_PATTERN,
  extractDoi,
  citationPasteHandlerPluginKey,
  CITATION_LOOKUP_START_EVENT,
  CITATION_LOOKUP_DONE_EVENT,
  CITATION_LOOKUP_FAIL_EVENT,
  type CitationLookupFn,
  type CitationLookupResult,
  type CitationPasteHandlerOptions,
} from './extensions/citation-paste-handler';
export {
  getActiveSelectionContext,
  findEnclosingBlock,
  chipRelevance,
  AGENT_MENU_OPEN_EVENT,
  AGENT_MENU_CLOSE_EVENT,
  AGENT_INVOKE_EVENT,
  type AgentKind,
  type AgentSelectionContext,
  type AgentInvokeRequest,
  type AgentMenuOpenDetail,
  type AgentTriggerOptions,
} from './extensions/agent-trigger';
export type { ComputationalKernel } from './extensions/computational-cell';
export type {
  ClaimType,
  ClaimStatus,
  ClaimConfidence,
} from './extensions/claim';
export type { EvidenceRelation } from './extensions/evidence';
export {
  dominantVerdict,
  anchorAccentClass,
  type DominantVerdict,
  type VerdictBuckets,
} from './extensions/claim-review-anchor';
export {
  buildCommitPayload,
  deserializeSteps,
  applyYjsUpdate,
  nextStateVector,
  type CommitPayload,
  type SerializeStepsArgs,
  type DeserializeStepsArgs,
  type ApplyYjsUpdateArgs,
} from './commit';
export {
  setupSync,
  SyncGatewayTransport,
  type SyncBundle,
  type SetupSyncOptions,
  type SyncGatewayTransportOptions,
  type TransportEvent,
  type TransportListener,
  type ConnectionMode,
  FRAME_KIND,
  encodeBodyFrame,
  encodeDraftFrame,
  encodePongFrame,
  decodeFrame,
  decodeDraftFrame,
  decodeModeFrame,
  decodeRejectFrame,
} from './sync';
export {
  newAnchorId,
  newBlockId,
  newCellId,
  newCitationId,
  newClaimId,
  newClaimLinkId,
  newEvidenceId,
  newFootnoteId,
  newProvenanceId,
  newRevisionId,
} from './util/ids';

// Phase 4 W5 ADR-0014: Yjs subdocument backend pure helpers.
export {
  detectSubdocBoundariesByH1,
  extractCrossRefs,
  type CrossRef,
  type CrossRefKind,
  type PmDocJson,
  type PmNodeJson,
  type SubdocBoundary,
} from './subdocument';

// Phase 4 W6.2: 新建文档模板首次播种 helpers (apps/web /docs/new).
// W7.1: API 改为 DocumentHandle；旧 Y.Doc-flavour 名字保持作 alias，apps/web
// 暂不动（属于 Phase 5 收口）。
export {
  seedDocumentFromPmJson,
  isDocumentFragmentEmpty,
} from './seed';
