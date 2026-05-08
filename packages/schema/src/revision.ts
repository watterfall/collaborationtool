// Revision = a proposed change that may be rejected. Once `accepted`,
// it materializes into a Contribution.

import type {
  ContributionId, DocumentId, IsoDateTime,
  PrincipalId, ProvenanceId, RevisionId,
} from './_shared';

export type RevisionStatus =
  | 'draft'        // agent / 协作者还在打磨
  | 'proposed'     // 提交评审
  | 'accepted'     // 已并入主线（→ Contribution）
  | 'rejected'     // 拒绝
  | 'superseded';  // 被另一 revision 覆盖

export interface Revision {
  id: RevisionId;                       // [PG]
  documentId: DocumentId;               // [PG]
  proposedBy: PrincipalId;              // [PG] user or agent
  status: RevisionStatus;               // [PG]
  // diff payload: PM steps + matching Yjs update; both stored so non-PM clients can apply
  pmStepsBinary: Uint8Array;            // [PG] prosemirror-transform steps, serialized
  yjsUpdateBinary: Uint8Array;          // [PG] equivalent Yjs update binary
  baseStateVector: Uint8Array;          // [PG] doc state this revision was based on
  rationale?: string;                   // [PG] optional markdown
  provenanceId?: ProvenanceId;          // [PG] required when proposedBy is an agent
  createdAt: IsoDateTime;               // [PG]
  decidedAt?: IsoDateTime;              // [PG]
  decidedBy?: PrincipalId;              // [PG]
  contributionId?: ContributionId;      // [PG] populated when status='accepted'
}
