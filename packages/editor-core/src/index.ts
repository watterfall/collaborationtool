// Public API of @collaborationtool/editor-core.
//
// The Editor React component is the primary export for apps/web. Schema
// + commit helpers are headless and used by tests / snapshot worker /
// future render packages.

export { Editor, type EditorProps } from './Editor';
export { paperSchema, freshPaperSchema } from './schema';
export {
  PAPER_SCHEMA_EXTENSIONS,
  AnnotationAnchor,
  CitationRef,
  Claim,
  ComputationalCell,
  DatasetRef,
  Equation,
  Evidence,
  Figure,
  FigureCaption,
  FootnoteRef,
  InlineEquation,
} from './extensions/all';
export type { ComputationalKernel } from './extensions/computational-cell';
export type {
  ClaimType,
  ClaimStatus,
  ClaimConfidence,
} from './extensions/claim';
export type { EvidenceRelation } from './extensions/evidence';
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
