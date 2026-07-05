import {
  assembleResearchReadiness,
  type ResearchReadinessSummary,
} from '@/lib/research-readiness';
import { readEvidenceSourceKind } from '@/lib/evidence-map';

export const AI_CONTEXT_PACK_SCHEMA =
  'https://collaborationtool.example.com/schema/ai-context-pack/v1';

export interface AiContextPackDocument {
  id: string;
  title: string;
  slug: string;
  primaryLanguage: string;
  bilingualMode?: string | null;
}

export interface AiContextPackClaimRow {
  id: string;
  text: string;
}

export interface AiContextPackEvidenceRow {
  supportsClaimId: string;
  citationId?: string | null;
}

export interface AiContextPackSourceRow {
  id: string;
  kind?: string | null;
  cslJson?: unknown;
}

export interface AiContextPackReviewRow {
  claimId: string;
  isAiVerdict: boolean;
  withdrawnAt: Date | null;
  reviewerOrcidId: string | null;
  orcidSignedAt: Date | null;
  signedPayloadJws: string | null;
}

export interface AiContextPackFindingRow {
  id: string;
  claimId: string | null;
  kind: string;
  severity: string;
  status: string;
  summary: string;
}

export interface AiContextPack<
  TClaim extends AiContextPackClaimRow,
  TEvidence extends AiContextPackEvidenceRow,
  TClaimLink,
  TSource extends AiContextPackSourceRow,
  TReview extends AiContextPackReviewRow,
  TFinding extends AiContextPackFindingRow,
> {
  $schema: string;
  doc: AiContextPackDocument;
  claims: TClaim[];
  evidences: TEvidence[];
  claimLinks: TClaimLink[];
  sources: TSource[];
  reviews: TReview[];
  maintenanceFindings: TFinding[];
  readiness: ResearchReadinessSummary;
  generatedAt: string;
}

export function buildAiContextPack<
  TClaim extends AiContextPackClaimRow,
  TEvidence extends AiContextPackEvidenceRow,
  TClaimLink,
  TSource extends AiContextPackSourceRow,
  TReview extends AiContextPackReviewRow,
  TFinding extends AiContextPackFindingRow,
>(args: {
  doc: AiContextPackDocument;
  claims: readonly TClaim[];
  evidences: readonly TEvidence[];
  claimLinks: readonly TClaimLink[];
  sources: readonly TSource[];
  reviews: readonly TReview[];
  maintenanceFindings: readonly TFinding[];
  generatedAt?: string;
}): AiContextPack<TClaim, TEvidence, TClaimLink, TSource, TReview, TFinding> {
  const sourceKindByCitationId = new Map(
    args.sources.map((source) => [
      source.id,
      readEvidenceSourceKind(source.kind, source.cslJson),
    ]),
  );
  return {
    $schema: AI_CONTEXT_PACK_SCHEMA,
    doc: args.doc,
    claims: [...args.claims],
    evidences: [...args.evidences],
    claimLinks: [...args.claimLinks],
    sources: [...args.sources],
    reviews: [...args.reviews],
    maintenanceFindings: [...args.maintenanceFindings],
    readiness: assembleResearchReadiness({
      claims: args.claims.map((claim) => ({
        claimId: claim.id,
        claimText: claim.text,
      })),
      evidences: args.evidences.map((evidence) => ({
        supportsClaimId: evidence.supportsClaimId,
        sourceKind: evidence.citationId
          ? (sourceKindByCitationId.get(evidence.citationId) ?? null)
          : null,
      })),
      reviews: args.reviews.map((review) => ({
        claimId: review.claimId,
        isAiVerdict: review.isAiVerdict,
        withdrawnAt: review.withdrawnAt,
        reviewerOrcidId: review.reviewerOrcidId,
        orcidSignedAt: review.orcidSignedAt,
        signedPayloadJws: review.signedPayloadJws,
      })),
      findings: args.maintenanceFindings.map((finding) => ({
        findingId: finding.id,
        claimId: finding.claimId,
        kind: finding.kind,
        severity: finding.severity,
        status: finding.status,
        summary: finding.summary,
      })),
    }),
    generatedAt: args.generatedAt ?? new Date().toISOString(),
  };
}
