export interface EvidenceMapClaimRow {
  claimId: string;
  text: string;
  claimType: string;
  status: string;
  confidence: string;
  createdAt: Date;
}

export interface EvidenceMapEvidenceRow {
  evidenceId: string;
  excerpt: string;
  supportsClaimId: string;
  citationId: string | null;
  relation: 'supports' | 'challenges' | 'qualifies' | string;
  status: string;
  documentOriginId: string | null;
  createdAt: Date;
}

export interface EvidenceMapCitationRow {
  citationId: string;
  kind: string;
  cslJson: unknown;
  doi: string | null;
  url: string | null;
}

export interface EvidenceMapCitationSummary {
  citationId: string;
  title: string;
  meta: string;
  doi: string | null;
  url: string | null;
  kind: string;
  sourceKind: EvidenceSourceKind;
}

export interface EvidenceMapEvidenceNode {
  evidenceId: string;
  excerpt: string;
  relation: string;
  status: string;
  createdAt: Date;
  citation: EvidenceMapCitationSummary | null;
  isCrossDocument: boolean;
}

export interface EvidenceMapClaimNode {
  claimId: string;
  text: string;
  claimType: string;
  status: string;
  confidence: string;
  createdAt: Date;
  evidenceCount: number;
  supportCount: number;
  challengeCount: number;
  qualifyCount: number;
  sourceCount: number;
  needsEvidence: boolean;
  highlighted: boolean;
  crossDocDocumentIds: string[];
  evidences: EvidenceMapEvidenceNode[];
}

export interface EvidenceMapSummary {
  totalClaims: number;
  evidencedClaims: number;
  unsupportedClaims: number;
  totalEvidence: number;
  totalSources: number;
  literatureSources: number;
  datasetSources: number;
  softwareSources: number;
  protocolSources: number;
  webSources: number;
  documentSources: number;
  reproducibilityAssetClaims: number;
  targetClaimId: string | null;
  targetFound: boolean;
}

export interface EvidenceMapView {
  summary: EvidenceMapSummary;
  claims: EvidenceMapClaimNode[];
}

export const EVIDENCE_RELATIONS = [
  'supports',
  'challenges',
  'qualifies',
] as const;

export type EvidenceRelation = (typeof EVIDENCE_RELATIONS)[number];

export const EVIDENCE_SOURCE_KINDS = [
  'literature',
  'dataset',
  'software',
  'protocol',
  'document',
  'web',
] as const;

export type EvidenceSourceKind = (typeof EVIDENCE_SOURCE_KINDS)[number];

export type EvidenceCitationStorageKind = Exclude<
  EvidenceSourceKind,
  'protocol'
>;

export type EvidenceDraftValidation =
  | { ok: true; payload: EvidenceDraftPayload }
  | { ok: false; reason: EvidenceDraftValidationReason };

export interface EvidenceDraftPayload {
  claimId: string;
  excerpt: string;
  relation: EvidenceRelation;
  source: EvidenceDraftSource | null;
}

export interface EvidenceDraftSource {
  title: string;
  doi: string | null;
  url: string | null;
  kind: EvidenceCitationStorageKind;
  sourceKind: EvidenceSourceKind;
}

export interface EvidenceDraftCitationLookupRow {
  citationId: string;
  doi: string | null;
  url: string | null;
  archivedAt?: Date | string | null;
}

export type EvidenceDraftValidationReason =
  | 'missing-claim'
  | 'unknown-claim'
  | 'missing-excerpt'
  | 'excerpt-too-short'
  | 'excerpt-too-long'
  | 'invalid-relation'
  | 'invalid-source-kind'
  | 'source-title-too-long'
  | 'invalid-doi'
  | 'invalid-url';

export function assembleEvidenceMap(args: {
  documentId: string;
  claims: EvidenceMapClaimRow[];
  evidences: EvidenceMapEvidenceRow[];
  citations: EvidenceMapCitationRow[];
  targetClaimId?: string | null;
}): EvidenceMapView {
  const targetClaimId = hasText(args.targetClaimId ?? null)
    ? (args.targetClaimId ?? '').trim()
    : null;
  const claimIds = new Set(args.claims.map((claim) => claim.claimId));
  const citationsById = new Map(
    args.citations.map((citation) => [citation.citationId, citation]),
  );
  const evidenceByClaim = new Map<string, EvidenceMapEvidenceRow[]>();
  for (const evidence of args.evidences) {
    if (!claimIds.has(evidence.supportsClaimId)) continue;
    const bucket = evidenceByClaim.get(evidence.supportsClaimId);
    if (bucket) bucket.push(evidence);
    else evidenceByClaim.set(evidence.supportsClaimId, [evidence]);
  }

  const claims = args.claims
    .map((claim) => {
      const evidences = (evidenceByClaim.get(claim.claimId) ?? [])
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const citationIds = new Set(
        evidences
          .map((evidence) => evidence.citationId)
          .filter((id): id is string => id !== null),
      );
      const crossDocDocumentIds = [
        ...new Set(
          evidences
            .map((evidence) => evidence.documentOriginId)
            .filter(
              (documentId): documentId is string =>
                documentId !== null && documentId !== args.documentId,
            ),
        ),
      ].sort();
      const summarizedEvidences = evidences.map((evidence) => ({
        evidenceId: evidence.evidenceId,
        excerpt: evidence.excerpt,
        relation: evidence.relation,
        status: evidence.status,
        createdAt: evidence.createdAt,
        citation: evidence.citationId
          ? summarizeCitation(citationsById.get(evidence.citationId) ?? null)
          : null,
        isCrossDocument:
          evidence.documentOriginId !== null &&
          evidence.documentOriginId !== args.documentId,
      }));
      return {
        claimId: claim.claimId,
        text: claim.text,
        claimType: claim.claimType,
        status: claim.status,
        confidence: claim.confidence,
        createdAt: claim.createdAt,
        evidenceCount: evidences.length,
        supportCount: evidences.filter((e) => e.relation === 'supports').length,
        challengeCount: evidences.filter((e) => e.relation === 'challenges')
          .length,
        qualifyCount: evidences.filter((e) => e.relation === 'qualifies')
          .length,
        sourceCount: citationIds.size,
        needsEvidence: evidences.length === 0,
        highlighted: targetClaimId === claim.claimId,
        crossDocDocumentIds,
        evidences: summarizedEvidences,
      } satisfies EvidenceMapClaimNode;
    })
    .sort((a, b) => {
      if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1;
      if (a.needsEvidence !== b.needsEvidence) return a.needsEvidence ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const totalSources = new Set(
    args.evidences
      .filter((evidence) => claimIds.has(evidence.supportsClaimId))
      .map((evidence) => evidence.citationId)
      .filter((id): id is string => id !== null),
  ).size;
  const sourceKindsByClaim = new Map<string, Set<EvidenceSourceKind>>();
  const uniqueSourceKinds = new Map<string, EvidenceSourceKind>();
  for (const evidence of args.evidences) {
    if (!claimIds.has(evidence.supportsClaimId) || !evidence.citationId) {
      continue;
    }
    const citation = summarizeCitation(
      citationsById.get(evidence.citationId) ?? null,
    );
    if (!citation) continue;
    uniqueSourceKinds.set(evidence.citationId, citation.sourceKind);
    const claimKinds =
      sourceKindsByClaim.get(evidence.supportsClaimId) ??
      new Set<EvidenceSourceKind>();
    claimKinds.add(citation.sourceKind);
    sourceKindsByClaim.set(evidence.supportsClaimId, claimKinds);
  }
  const sourceKinds = [...uniqueSourceKinds.values()];

  return {
    summary: {
      totalClaims: args.claims.length,
      evidencedClaims: claims.filter((claim) => !claim.needsEvidence).length,
      unsupportedClaims: claims.filter((claim) => claim.needsEvidence).length,
      totalEvidence: args.evidences.filter((evidence) =>
        claimIds.has(evidence.supportsClaimId),
      ).length,
      totalSources,
      literatureSources: countKind(sourceKinds, 'literature'),
      datasetSources: countKind(sourceKinds, 'dataset'),
      softwareSources: countKind(sourceKinds, 'software'),
      protocolSources: countKind(sourceKinds, 'protocol'),
      webSources: countKind(sourceKinds, 'web'),
      documentSources: countKind(sourceKinds, 'document'),
      reproducibilityAssetClaims: [...sourceKindsByClaim.values()].filter(
        hasReproducibilityAsset,
      ).length,
      targetClaimId,
      targetFound:
        targetClaimId !== null &&
        args.claims.some((claim) => claim.claimId === targetClaimId),
    },
    claims,
  };
}

export function validateEvidenceDraftInput(args: {
  claimId: unknown;
  excerpt: unknown;
  relation: unknown;
  sourceTitle?: unknown;
  sourceDoi?: unknown;
  sourceUrl?: unknown;
  sourceKind?: unknown;
  allowedClaimIds: readonly string[];
}): EvidenceDraftValidation {
  const claimId = typeof args.claimId === 'string' ? args.claimId.trim() : '';
  if (!claimId) return { ok: false, reason: 'missing-claim' };
  if (!args.allowedClaimIds.includes(claimId)) {
    return { ok: false, reason: 'unknown-claim' };
  }

  const excerpt = typeof args.excerpt === 'string' ? args.excerpt.trim() : '';
  if (!excerpt) return { ok: false, reason: 'missing-excerpt' };
  if (excerpt.length < 16) return { ok: false, reason: 'excerpt-too-short' };
  if (excerpt.length > 4000) return { ok: false, reason: 'excerpt-too-long' };

  const relation =
    typeof args.relation === 'string' ? args.relation.trim() : '';
  if (!isEvidenceRelation(relation)) {
    return { ok: false, reason: 'invalid-relation' };
  }
  const source = validateEvidenceDraftSource({
    sourceTitle: args.sourceTitle,
    sourceDoi: args.sourceDoi,
    sourceUrl: args.sourceUrl,
    sourceKind: args.sourceKind,
  });
  if (!source.ok) return source;

  return {
    ok: true,
    payload: {
      claimId,
      excerpt,
      relation,
      source: source.payload,
    },
  };
}

export function selectReusableCitationId(
  source: EvidenceDraftSource | null,
  rows: readonly EvidenceDraftCitationLookupRow[],
): string | null {
  if (!source) return null;
  if (source.doi) {
    const doi = source.doi.trim();
    return (
      rows.find(
        (row) => row.archivedAt == null && row.doi?.trim() === doi,
      )?.citationId ?? null
    );
  }
  if (source.url) {
    const url = source.url.trim();
    return (
      rows.find(
        (row) => row.archivedAt == null && row.url?.trim() === url,
      )?.citationId ?? null
    );
  }
  return null;
}

function validateEvidenceDraftSource(args: {
  sourceTitle: unknown;
  sourceDoi: unknown;
  sourceUrl: unknown;
  sourceKind: unknown;
}):
  | { ok: true; payload: EvidenceDraftSource | null }
  | { ok: false; reason: EvidenceDraftValidationReason } {
  const sourceTitle =
    typeof args.sourceTitle === 'string' ? args.sourceTitle.trim() : '';
  const sourceDoi =
    typeof args.sourceDoi === 'string' ? args.sourceDoi.trim() : '';
  const sourceUrl =
    typeof args.sourceUrl === 'string' ? args.sourceUrl.trim() : '';
  const sourceKind = normalizeEvidenceSourceKind(args.sourceKind, {
    sourceDoi,
    sourceUrl,
  });
  if (sourceKind === null) {
    return { ok: false, reason: 'invalid-source-kind' };
  }
  if (!sourceTitle && !sourceDoi && !sourceUrl) {
    return { ok: true, payload: null };
  }
  if (sourceTitle.length > 300) {
    return { ok: false, reason: 'source-title-too-long' };
  }
  if (sourceDoi && !isValidDoi(sourceDoi)) {
    return { ok: false, reason: 'invalid-doi' };
  }
  if (sourceUrl && !isValidSourceUrl(sourceUrl)) {
    return { ok: false, reason: 'invalid-url' };
  }
  return {
    ok: true,
    payload: {
      title: sourceTitle || sourceDoi || sourceUrl,
      doi: sourceDoi || null,
      url: sourceUrl || null,
      kind: toCitationStorageKind(sourceKind, {
        sourceDoi,
        sourceUrl,
      }),
      sourceKind,
    },
  };
}

function isEvidenceRelation(value: string): value is EvidenceRelation {
  return (EVIDENCE_RELATIONS as readonly string[]).includes(value);
}

export function readEvidenceSourceKind(
  citationKind: string | null | undefined,
  cslJson?: unknown,
): EvidenceSourceKind {
  const storedKind = readCslString(cslJson, 'collaborationtool:evidenceKind');
  if (isEvidenceSourceKind(storedKind)) return storedKind;
  if (isEvidenceSourceKind(citationKind)) return citationKind;
  return 'web';
}

export function isReproducibilityAssetKind(
  value: string | null | undefined,
): boolean {
  return (
    value === 'dataset' || value === 'software' || value === 'protocol'
  );
}

function normalizeEvidenceSourceKind(
  value: unknown,
  fallback: { sourceDoi: string; sourceUrl: string },
): EvidenceSourceKind | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim();
    return isEvidenceSourceKind(trimmed) ? trimmed : null;
  }
  return fallback.sourceDoi ? 'literature' : fallback.sourceUrl ? 'web' : 'document';
}

function isEvidenceSourceKind(
  value: string | null | undefined,
): value is EvidenceSourceKind {
  return (
    typeof value === 'string' &&
    (EVIDENCE_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

function toCitationStorageKind(
  sourceKind: EvidenceSourceKind,
  fallback: { sourceDoi: string; sourceUrl: string },
): EvidenceCitationStorageKind {
  if (sourceKind === 'protocol') {
    return fallback.sourceUrl || fallback.sourceDoi ? 'web' : 'document';
  }
  return sourceKind;
}

// Same DOI shape used by inline citation tools; no network lookup here.
const DOI_VALIDATION_PATTERN = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

function isValidDoi(value: string): boolean {
  return DOI_VALIDATION_PATTERN.test(value.trim());
}

function isValidSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function summarizeCitation(
  row: EvidenceMapCitationRow | null,
): EvidenceMapCitationSummary | null {
  if (!row) return null;
  const title =
    readCslString(row.cslJson, 'title') ?? row.doi ?? row.url ?? row.citationId;
  const container = readCslString(row.cslJson, 'container-title');
  const year = readCslYear(row.cslJson);
  const metaParts = [container, year].filter((part): part is string =>
    hasText(part),
  );
  return {
    citationId: row.citationId,
    title,
    meta: metaParts.length > 0 ? metaParts.join(' · ') : row.kind,
    doi: row.doi,
    url: row.url,
    kind: row.kind,
    sourceKind: readEvidenceSourceKind(row.kind, row.cslJson),
  };
}

function countKind(
  values: readonly EvidenceSourceKind[],
  kind: EvidenceSourceKind,
): number {
  return values.filter((value) => value === kind).length;
}

function hasReproducibilityAsset(
  sourceKinds: ReadonlySet<EvidenceSourceKind>,
): boolean {
  return [...sourceKinds].some(isReproducibilityAssetKind);
}

function readCslString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const raw = value[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function readCslYear(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const issued = value['issued'];
  if (!isRecord(issued)) return null;
  const dateParts = issued['date-parts'];
  if (!Array.isArray(dateParts)) return null;
  const first = dateParts[0];
  if (!Array.isArray(first)) return null;
  const year = first[0];
  if (typeof year === 'number' || typeof year === 'string') {
    return String(year);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}
