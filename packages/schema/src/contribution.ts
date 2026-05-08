// Contribution is an append-only commit unit. The history DAG is formed
// by parentContributionId. Undo == reverse contribution, never UPDATE.

import type {
  BlockId, ContributionId, DocumentId, IsoDateTime,
  PrincipalId, ProvenanceId, RevisionId,
} from './_shared';

export interface Contribution {
  id: ContributionId;                       // [PG] uuidv7
  documentId: DocumentId;                   // [PG]
  parentContributionId?: ContributionId;    // [PG] history DAG parent
  fromRevisionId?: RevisionId;              // [PG] null = direct edit, not via revision
  contributorPrincipalId: PrincipalId;      // [PG] user / agent / shared-link / service
  pmStepsBinary: Uint8Array;                // [PG]
  yjsUpdateBinary: Uint8Array;              // [PG]
  affectedBlockIds: BlockId[];              // [PG] indexed for per-block history
  committedAt: IsoDateTime;                 // [PG]
  provenanceId: ProvenanceId;               // [PG] mandatory; provenance is first-class
}
