// Research readiness — pure document-level reproducibility/review summary.
//
// This is intentionally DB-agnostic. The editor page assembles slim rows
// from claim / evidence / claim_review / maintenance_finding, while tests
// lock the scientific product rules without needing Postgres.

export type ResearchReadinessStatus =
  | 'no-claims'
  | 'blocked'
  | 'needs-review'
  | 'needs-signature'
  | 'needs-assets'
  | 'ready';

export type ResearchReadinessCheckId =
  | 'claim-evidence'
  | 'reproducibility-assets'
  | 'human-review'
  | 'orcid-signature'
  | 'maintenance'
  | 'ai-audit';

export type ResearchReadinessCheckState =
  | 'complete'
  | 'attention'
  | 'blocked';

export type ResearchReadinessActionKind =
  | 'model-claims'
  | 'bind-evidence'
  | 'bind-reproducibility-asset'
  | 'request-human-review'
  | 'sign-human-review'
  | 'resolve-maintenance'
  | 'verify-ai-block';

export type ResearchReadinessActionSeverity = 'blocked' | 'attention';

export interface ResearchReadinessClaimRow {
  claimId: string;
  claimText: string;
}

export interface ResearchReadinessEvidenceRow {
  supportsClaimId: string;
  sourceKind?: string | null;
}

export interface ResearchReadinessReviewRow {
  claimId: string;
  isAiVerdict: boolean;
  withdrawnAt: Date | null;
  reviewerOrcidId: string | null;
  orcidSignedAt: Date | null;
  signedPayloadJws: string | null;
}

export interface ResearchReadinessFindingRow {
  findingId: string;
  claimId: string | null;
  kind: string;
  severity: string;
  status: string;
  summary: string;
}

export interface ResearchReadinessCheck {
  id: ResearchReadinessCheckId;
  state: ResearchReadinessCheckState;
  label: string;
  value: string;
  detail: string;
}

export interface ResearchReadinessAction {
  id: string;
  kind: ResearchReadinessActionKind;
  severity: ResearchReadinessActionSeverity;
  label: string;
  target: string;
  detail: string;
  claimId?: string;
  findingId?: string;
}

export interface ResearchReadinessSummary {
  status: ResearchReadinessStatus;
  totalClaims: number;
  evidencedClaims: number;
  unsupportedClaims: number;
  reproducibilityAssetClaims: number;
  claimsNeedingReproducibilityAsset: number;
  datasetSources: number;
  softwareSources: number;
  protocolSources: number;
  humanReviewedClaims: number;
  claimsNeedingHumanReview: number;
  orcidSignedReviews: number;
  orcidSignedClaims: number;
  claimsNeedingSignedReview: number;
  activeFindings: number;
  blockingFindings: number;
  unverifiedAiFindings: number;
  evidenceCoveragePct: number;
  reproducibilityAssetCoveragePct: number;
  humanReviewCoveragePct: number;
  signedReviewCoveragePct: number;
  checks: ResearchReadinessCheck[];
  actions: ResearchReadinessAction[];
}

export function assembleResearchReadiness(args: {
  claims: ResearchReadinessClaimRow[];
  evidences: ResearchReadinessEvidenceRow[];
  reviews: ResearchReadinessReviewRow[];
  findings: ResearchReadinessFindingRow[];
}): ResearchReadinessSummary {
  const claimIds = new Set(args.claims.map((c) => c.claimId));
  const claimsById = new Map(args.claims.map((c) => [c.claimId, c]));
  const evidencedClaimIds = new Set(
    args.evidences
      .map((e) => e.supportsClaimId)
      .filter((id) => claimIds.has(id)),
  );
  const reproducibilityAssetClaimIds = new Set(
    args.evidences
      .filter(
        (e) =>
          claimIds.has(e.supportsClaimId) &&
          isReproducibilityAssetKind(e.sourceKind),
      )
      .map((e) => e.supportsClaimId),
  );
  const humanReviewedClaimIds = new Set(
    args.reviews
      .filter((r) => !r.isAiVerdict && r.withdrawnAt === null)
      .map((r) => r.claimId)
      .filter((id) => claimIds.has(id)),
  );
  const orcidSignedReviews = args.reviews.filter(
    (r) =>
      !r.isAiVerdict &&
      r.withdrawnAt === null &&
      r.reviewerOrcidId !== null &&
      (r.orcidSignedAt !== null || hasText(r.signedPayloadJws)),
  ).length;
  const orcidSignedClaimIds = new Set(
    args.reviews
      .filter(
        (r) =>
          !r.isAiVerdict &&
          r.withdrawnAt === null &&
          r.reviewerOrcidId !== null &&
          (r.orcidSignedAt !== null || hasText(r.signedPayloadJws)),
      )
      .map((r) => r.claimId)
      .filter((id) => claimIds.has(id)),
  );

  const activeFindings = args.findings.filter(isActiveFinding);
  const blockingFindings = activeFindings.filter(
    (f) => f.severity === 'high' || f.severity === 'medium',
  );
  const unverifiedAiFindings = activeFindings.filter(
    (f) => f.kind === 'unverified-ai-block',
  );
  const unsupportedClaimRows = args.claims.filter(
    (c) => !evidencedClaimIds.has(c.claimId),
  );
  const claimsNeedingHumanReviewRows = args.claims.filter(
    (c) => !humanReviewedClaimIds.has(c.claimId),
  );
  const claimsNeedingSignedReviewRows = args.claims.filter(
    (c) =>
      humanReviewedClaimIds.has(c.claimId) &&
      !orcidSignedClaimIds.has(c.claimId),
  );
  const claimsNeedingReproducibilityAssetRows = args.claims.filter(
    (c) =>
      evidencedClaimIds.has(c.claimId) &&
      !reproducibilityAssetClaimIds.has(c.claimId),
  );

  const totalClaims = claimIds.size;
  const evidencedClaims = evidencedClaimIds.size;
  const unsupportedClaims = Math.max(0, totalClaims - evidencedClaims);
  const reproducibilityAssetClaims = reproducibilityAssetClaimIds.size;
  const claimsNeedingReproducibilityAsset =
    claimsNeedingReproducibilityAssetRows.length;
  const datasetSources = args.evidences.filter((e) => e.sourceKind === 'dataset')
    .length;
  const softwareSources = args.evidences.filter(
    (e) => e.sourceKind === 'software',
  ).length;
  const protocolSources = args.evidences.filter(
    (e) => e.sourceKind === 'protocol',
  ).length;
  const humanReviewedClaims = humanReviewedClaimIds.size;
  const orcidSignedClaims = orcidSignedClaimIds.size;
  const claimsNeedingHumanReview = Math.max(
    0,
    totalClaims - humanReviewedClaims,
  );
  const claimsNeedingSignedReview = claimsNeedingSignedReviewRows.length;
  const evidenceCoveragePct = pct(evidencedClaims, totalClaims);
  const reproducibilityAssetCoveragePct = pct(
    reproducibilityAssetClaims,
    totalClaims,
  );
  const humanReviewCoveragePct = pct(humanReviewedClaims, totalClaims);
  const signedReviewCoveragePct = pct(orcidSignedClaims, totalClaims);

  const status: ResearchReadinessStatus =
    totalClaims === 0
      ? 'no-claims'
      : unsupportedClaims > 0 ||
          blockingFindings.length > 0 ||
          unverifiedAiFindings.length > 0
        ? 'blocked'
        : claimsNeedingHumanReview > 0
          ? 'needs-review'
          : claimsNeedingSignedReview > 0
            ? 'needs-signature'
            : claimsNeedingReproducibilityAsset > 0
              ? 'needs-assets'
              : 'ready';

  return {
    status,
    totalClaims,
    evidencedClaims,
    unsupportedClaims,
    reproducibilityAssetClaims,
    claimsNeedingReproducibilityAsset,
    datasetSources,
    softwareSources,
    protocolSources,
    humanReviewedClaims,
    claimsNeedingHumanReview,
    orcidSignedReviews,
    orcidSignedClaims,
    claimsNeedingSignedReview,
    activeFindings: activeFindings.length,
    blockingFindings: blockingFindings.length,
    unverifiedAiFindings: unverifiedAiFindings.length,
    evidenceCoveragePct,
    reproducibilityAssetCoveragePct,
    humanReviewCoveragePct,
    signedReviewCoveragePct,
    checks: [
      {
        id: 'claim-evidence',
        state:
          totalClaims === 0
            ? 'attention'
            : unsupportedClaims === 0
              ? 'complete'
              : 'blocked',
        label: '证据绑定 · Evidence',
        value: `${evidencedClaims}/${totalClaims}`,
        detail:
          totalClaims === 0
            ? '先把论文里的关键判断标成 claim。'
            : unsupportedClaims === 0
              ? '每条 claim 至少有一条 evidence 记录。'
              : `${unsupportedClaims} 条 claim 还没有 evidence。`,
      },
      {
        id: 'reproducibility-assets',
        state:
          totalClaims === 0
            ? 'attention'
            : unsupportedClaims > 0
              ? 'attention'
              : claimsNeedingReproducibilityAsset === 0
                ? 'complete'
                : 'attention',
        label: '复现资产 · Data/code/protocol',
        value: `${reproducibilityAssetClaims}/${totalClaims}`,
        detail:
          totalClaims === 0
            ? '先建立 claim，再绑定 data、software 或 protocol。'
            : unsupportedClaims > 0
              ? '先补齐基础 evidence，再标注 data、software 或 protocol。'
              : claimsNeedingReproducibilityAsset === 0
                ? `已绑定 ${datasetSources} data · ${softwareSources} software · ${protocolSources} protocol source。`
                : `${claimsNeedingReproducibilityAsset} 条 evidenced claim 还缺 data、software 或 protocol source。`,
      },
      {
        id: 'human-review',
        state:
          totalClaims === 0
            ? 'attention'
            : claimsNeedingHumanReview === 0
              ? 'complete'
              : 'attention',
        label: '人类复核 · Human review',
        value: `${humanReviewedClaims}/${totalClaims}`,
        detail:
          claimsNeedingHumanReview === 0 && totalClaims > 0
            ? '每条 claim 至少有一条 active human verdict。'
            : `${claimsNeedingHumanReview} 条 claim 还没有 active human verdict。`,
      },
      {
        id: 'orcid-signature',
        state:
          totalClaims === 0
            ? 'attention'
            : claimsNeedingHumanReview > 0
              ? 'attention'
              : claimsNeedingSignedReview === 0
                ? 'complete'
                : 'attention',
        label: 'ORCID 签名 · Signed review',
        value: `${orcidSignedClaims}/${totalClaims}`,
        detail:
          totalClaims === 0
            ? '先建立 claim 与 human review，之后再签名。'
            : claimsNeedingHumanReview > 0
              ? '先补齐 human verdict，再做 ORCID 签名。'
              : claimsNeedingSignedReview === 0
                ? `${orcidSignedReviews} 条 active human verdict 已可携带验证。`
                : `${claimsNeedingSignedReview} 条 human-reviewed claim 还没有 ORCID-signed verdict。`,
      },
      {
        id: 'maintenance',
        state:
          blockingFindings.length > 0
            ? 'blocked'
            : activeFindings.length > 0
              ? 'attention'
              : 'complete',
        label: '巡检发现 · Maintenance',
        value: `${activeFindings.length}`,
        detail:
          activeFindings.length === 0
            ? '没有 active maintenance finding。'
            : `${blockingFindings.length} 条 high / medium finding 需要先处理。`,
      },
      {
        id: 'ai-audit',
        state: unverifiedAiFindings.length > 0 ? 'blocked' : 'complete',
        label: 'AI 可审计 · AI audit',
        value: `${unverifiedAiFindings.length}`,
        detail:
          unverifiedAiFindings.length === 0
            ? '没有未复核 AI block finding。'
            : `${unverifiedAiFindings.length} 个 AI 生成块仍待人类复核。`,
      },
    ],
    actions: buildActions({
      totalClaims,
      unsupportedClaimRows,
      claimsNeedingHumanReviewRows,
      blockingFindings,
      unverifiedAiFindings,
      claimsNeedingSignedReviewRows,
      claimsNeedingReproducibilityAssetRows,
      claimsById,
    }),
  };
}

export function buildResearchReadinessActionHref(
  documentId: string,
  action: ResearchReadinessAction,
): string | null {
  const encodedDocumentId = encodeURIComponent(documentId);
  if (action.kind === 'model-claims') return null;
  if (action.kind === 'bind-evidence') {
    const suffix = action.claimId
      ? `?claimId=${encodeURIComponent(action.claimId)}`
      : '';
    return `/editor/${encodedDocumentId}/evidence-map${suffix}`;
  }
  if (action.kind === 'bind-reproducibility-asset') {
    const suffix = action.claimId
      ? `?claimId=${encodeURIComponent(action.claimId)}`
      : '';
    return `/editor/${encodedDocumentId}/evidence-map${suffix}`;
  }
  if (action.kind === 'request-human-review' && action.claimId) {
    const params = new URLSearchParams({
      documentId,
      claimId: action.claimId,
    });
    return `/reviewer-inbox?${params.toString()}`;
  }
  if (action.kind === 'sign-human-review' && action.claimId) {
    return `/claim/${encodeURIComponent(action.claimId)}/lineage`;
  }
  if (
    (action.kind === 'resolve-maintenance' ||
      action.kind === 'verify-ai-block') &&
    action.findingId
  ) {
    const params = new URLSearchParams({ findingId: action.findingId });
    return `/maintenance?${params.toString()}`;
  }
  if (
    action.kind === 'resolve-maintenance' ||
    action.kind === 'verify-ai-block'
  ) {
    const params = new URLSearchParams({ documentId, status: 'open' });
    if (action.claimId) params.set('claimId', action.claimId);
    return `/maintenance?${params.toString()}`;
  }
  return null;
}

function buildActions(args: {
  totalClaims: number;
  unsupportedClaimRows: ResearchReadinessClaimRow[];
  claimsNeedingHumanReviewRows: ResearchReadinessClaimRow[];
  claimsNeedingSignedReviewRows: ResearchReadinessClaimRow[];
  claimsNeedingReproducibilityAssetRows: ResearchReadinessClaimRow[];
  blockingFindings: ResearchReadinessFindingRow[];
  unverifiedAiFindings: ResearchReadinessFindingRow[];
  claimsById: Map<string, ResearchReadinessClaimRow>;
}): ResearchReadinessAction[] {
  if (args.totalClaims === 0) {
    return [
      {
        id: 'model-claims',
        kind: 'model-claims',
        severity: 'attention',
        label: '先标出关键 claim',
        target: 'document',
        detail:
          '把结论、方法假设和关键比较标成 claim，后续 evidence / review 才能自动对齐。',
      },
    ];
  }

  const actions: ResearchReadinessAction[] = [];
  for (const claim of args.unsupportedClaimRows) {
    actions.push({
      id: `bind-evidence:${claim.claimId}`,
      kind: 'bind-evidence',
      severity: 'blocked',
      label: '绑定 evidence',
      target: truncate(claim.claimText),
      detail: '这条 claim 还没有 evidence；先补 citation、data、code 或 protocol。',
      claimId: claim.claimId,
    });
  }

  for (const finding of uniqueFindings([
    ...args.blockingFindings,
    ...args.unverifiedAiFindings,
  ])) {
    const relatedClaim = finding.claimId
      ? args.claimsById.get(finding.claimId)
      : undefined;
    const isAiBlock = finding.kind === 'unverified-ai-block';
    actions.push({
      id: `${isAiBlock ? 'verify-ai-block' : 'resolve-maintenance'}:${finding.findingId}`,
      kind: isAiBlock ? 'verify-ai-block' : 'resolve-maintenance',
      severity: 'blocked',
      label: isAiBlock ? '复核 AI 生成块' : '处理巡检发现',
      target: relatedClaim
        ? truncate(relatedClaim.claimText)
        : truncate(finding.summary),
      detail: finding.summary,
      claimId: finding.claimId ?? undefined,
      findingId: finding.findingId,
    });
  }

  for (const claim of args.claimsNeedingHumanReviewRows) {
    actions.push({
      id: `request-human-review:${claim.claimId}`,
      kind: 'request-human-review',
      severity: 'attention',
      label: '请求人类 verdict',
      target: truncate(claim.claimText),
      detail:
        'AI verdict 不能替代人类复核；把这条 claim 发到 reviewer inbox，最好由 ORCID 身份签名。',
      claimId: claim.claimId,
    });
  }

  for (const claim of args.claimsNeedingSignedReviewRows) {
    actions.push({
      id: `sign-human-review:${claim.claimId}`,
      kind: 'sign-human-review',
      severity: 'attention',
      label: '补 ORCID 签名',
      target: truncate(claim.claimText),
      detail:
        '这条 claim 已有人类 verdict，但还缺可携带验证的 ORCID signature；去 lineage 签名或请 reviewer 签名。',
      claimId: claim.claimId,
    });
  }

  for (const claim of args.claimsNeedingReproducibilityAssetRows) {
    actions.push({
      id: `bind-reproducibility-asset:${claim.claimId}`,
      kind: 'bind-reproducibility-asset',
      severity: 'attention',
      label: '补复现资产',
      target: truncate(claim.claimText),
      detail:
        '这条 claim 已有 evidence，但还缺 data、software 或 protocol source；在 evidence map 中补充可复查资产。',
      claimId: claim.claimId,
    });
  }

  return actions.slice(0, 8);
}

function uniqueFindings(
  findings: ResearchReadinessFindingRow[],
): ResearchReadinessFindingRow[] {
  const seen = new Set<string>();
  const out: ResearchReadinessFindingRow[] = [];
  for (const finding of findings) {
    if (seen.has(finding.findingId)) continue;
    seen.add(finding.findingId);
    out.push(finding);
  }
  return out;
}

function isActiveFinding(row: ResearchReadinessFindingRow): boolean {
  return row.status === 'open' || row.status === 'acknowledged';
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

function isReproducibilityAssetKind(value: string | null | undefined): boolean {
  return (
    value === 'dataset' || value === 'software' || value === 'protocol'
  );
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

function truncate(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= 96) return compact;
  return `${compact.slice(0, 93)}...`;
}
