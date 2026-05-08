// Annotation = structured discussion graph (NOT a comment box).
// Anchor lives in Y (so it tracks text edits via PM mark CRDT).
// Thread + Comment are append-only in PG (cross-document queries, exportable).

import type {
  AnchorId, CommentId, ContributionId, DocumentId,
  IsoDateTime, PrincipalId, ThreadId,
} from './_shared';

export type AnnotationKind =
  | 'comment'         // 普通讨论
  | 'suggestion'      // 提议改写（产出 Revision）
  | 'reviewer-note'   // 评审正式意见
  | 'agent-flag'      // AI agent 标记（如"DOI 可能错误"）
  | 'task';           // 派给某 principal 的待办

export interface AnnotationAnchor {
  anchorId: AnchorId;            // [Y, PG] PM mark attrs.anchorId / PG PK
  documentId: DocumentId;        // [PG]
  threadId: ThreadId;            // [PG]
  createdAt: IsoDateTime;        // [PG]
  resolvedAt?: IsoDateTime;      // [PG]
}

export interface AnnotationThread {
  id: ThreadId;                                   // [PG]
  documentId: DocumentId;                         // [PG]
  anchorId: AnchorId;                             // [PG]
  kind: AnnotationKind;                           // [PG]
  status: 'open' | 'resolved' | 'archived';       // [PG]
  createdBy: PrincipalId;                         // [PG]
  createdAt: IsoDateTime;                         // [PG]
  resolvedBy?: PrincipalId;                       // [PG]
  resolvedAt?: IsoDateTime;                       // [PG]
}

export interface AnnotationComment {
  id: CommentId;                       // [PG]
  threadId: ThreadId;                  // [PG]
  authorPrincipalId: PrincipalId;      // [PG]
  bodyMarkdown: string;                // [PG] append-only; never mutated
  createdAt: IsoDateTime;              // [PG]
  markedDeletedAt?: IsoDateTime;       // [PG] soft tombstone, content stays for audit
  contributionId: ContributionId;      // [PG] every comment is also a Contribution
}
