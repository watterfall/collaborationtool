// Phase 4 W4 ADR-0011 + Phase 3 W4 maintenance scan worker logic.
//
// Per essay §7.4 the scan looks for 6 categories of knowledge debt.
//
// 5 of them are SQL-pure (computable directly from PG with no LLM):
//
//   - unsupported-claim: claim without any evidence row referencing it
//   - outdated-source: source.accessed_at older than cutoff (default 18mo)
//   - unverified-ai-block: claim/evidence still in 'ai-suggested' status
//                          older than aging threshold (default 14d)
//   - contradicted-conclusion: claim has evidence with relation='challenges'
//                              AND no synthesis-typed claim resolves it via
//                              claim_link link_type='synthesizes'  (Phase 4 W4)
//   - duplicated-claim (exact text match): claim.text appears >= 2x in
//                                           the same scope. Semantic similarity
//                                           is deferred to Phase 5 (vector index).
//
// The 6th requires external network access:
//
//   - broken-citation: citation.doi no longer resolves at doi.org. Caller
//                      injects a DoiResolver; the http variant lives in
//                      ./doi-resolver.ts (production), tests pass a stub.
//
// All 6 generators emit `PendingFinding` records that are batch-INSERTed
// via writeFindings(); the scan job ID stamps each finding for audit.

import { and, eq, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { schema, type DbExecutor } from '@collaborationtool/drizzle';
import type { PrincipalId } from '@collaborationtool/schema';

// ---------- Types ----------

export type ScanFindingKind =
  | 'unsupported-claim'
  | 'outdated-source'
  | 'duplicated-claim'
  | 'contradicted-conclusion'
  | 'unverified-ai-block'
  | 'broken-citation'
  // Phase 5 Wave B B4 (ADR-0016 §2.6): claim with no human-ORCID
  // endorsement > 30d + created by agent principal. Signals the
  // author to recruit a human reviewer.
  | 'unverified-claim';

export type ScanScope =
  | { kind: 'document'; documentId: string }
  | { kind: 'vault'; vaultPrincipalId: PrincipalId };

export interface ScanInput {
  scope: ScanScope;
  /** Restrict to specific finding kinds. Default = the 5 SQL-pure
   * kinds (broken-citation is opt-in only since it requires a
   * DoiResolver). */
  findingKinds?: ScanFindingKind[];
  /** When the source has not been re-accessed in this many days, flag it. */
  outdatedSourceDays?: number;
  /** When an AI-suggested claim/evidence has been pending this long, flag it. */
  unverifiedAiAgingDays?: number;
  /** Phase 5 Wave B B4 — claim with no human ORCID endorsement after
   * this many days, AND created by an agent principal, gets flagged
   * as unverified-claim. Default 30 days (ADR-0016 §2.6). */
  unverifiedClaimAgingDays?: number;
  /** Cap on broken-citation network calls per scan (default 100).
   * Older citations are deferred to the next scan. */
  brokenCitationBatchLimit?: number;
  /** Required when `findingKinds` includes 'broken-citation'.
   * Production wires a doi.org HEAD-redirect resolver
   * (see ./doi-resolver.ts); tests pass a stub. */
  doiResolver?: DoiResolver;
  /** The agent_job that triggered this scan. Stamped onto each finding. */
  jobId: string;
}

/** Resolves a DOI string to a {ok, reason?} verdict. The default kinds
 * skip broken-citation; only when the caller opts in does this get
 * called. Implementations: HTTP HEAD via doi.org (./doi-resolver.ts)
 * or any custom MCP server fronting CrossRef. */
export interface DoiResolver {
  resolve(doi: string): Promise<{ ok: boolean; reason?: string }>;
}

/** Default kinds when `findingKinds` is omitted. broken-citation is
 * NOT included by default since it requires both opt-in + a resolver. */
export const DEFAULT_FINDING_KINDS: readonly ScanFindingKind[] = [
  'unsupported-claim',
  'outdated-source',
  'unverified-ai-block',
  'contradicted-conclusion',
  'duplicated-claim',
];

/** A pending finding (not yet INSERT'd; the worker writes them in
 * batch). Surface = what UI / dashboard reads. */
export interface PendingFinding {
  id: string;
  kind: ScanFindingKind;
  severity: 'info' | 'low' | 'medium' | 'high';
  jobId: string;
  claimId: string | null;
  evidenceId: string | null;
  sourceId: string | null;
  citationId: string | null;
  documentId: string | null;
  vaultPrincipalId: string;
  summary: string;
  details: Record<string, unknown> | null;
}

// ---------- Public API ----------

/**
 * Run the SQL-pure scan and return pending findings. Does NOT INSERT —
 * caller passes the array to writeFindings(). Splitting read from write
 * lets tests inspect findings without persistence.
 */
export async function scanForFindings(
  db: DbExecutor,
  input: ScanInput,
): Promise<PendingFinding[]> {
  const kinds = input.findingKinds ?? [...DEFAULT_FINDING_KINDS];
  const findings: PendingFinding[] = [];

  if (kinds.includes('unsupported-claim')) {
    findings.push(...(await scanUnsupportedClaims(db, input)));
  }
  if (kinds.includes('outdated-source')) {
    findings.push(...(await scanOutdatedSources(db, input)));
  }
  if (kinds.includes('unverified-ai-block')) {
    findings.push(...(await scanUnverifiedAiBlocks(db, input)));
  }
  if (kinds.includes('contradicted-conclusion')) {
    findings.push(...(await scanContradictedConclusions(db, input)));
  }
  if (kinds.includes('duplicated-claim')) {
    findings.push(...(await scanDuplicatedClaims(db, input)));
  }
  if (kinds.includes('broken-citation')) {
    if (!input.doiResolver) {
      throw new Error(
        'scanForFindings: broken-citation requested but no doiResolver provided',
      );
    }
    findings.push(
      ...(await scanBrokenCitations(db, input, input.doiResolver)),
    );
  }
  if (kinds.includes('unverified-claim')) {
    findings.push(...(await scanUnverifiedClaims(db, input)));
  }
  return findings;
}

/** Persist findings via INSERT. Idempotent on (kind, target id, job_id)
 * is NOT enforced at the SQL level — caller dedupes by re-running with
 * a new jobId; older findings stay history. */
export async function writeFindings(
  db: DbExecutor,
  findings: PendingFinding[],
): Promise<void> {
  if (findings.length === 0) return;
  await db.insert(schema.maintenanceFinding).values(
    findings.map((f) => ({
      id: f.id,
      kind: f.kind,
      severity: f.severity,
      status: 'open' as const,
      jobId: f.jobId,
      claimId: f.claimId,
      evidenceId: f.evidenceId,
      sourceId: f.sourceId,
      citationId: f.citationId,
      documentId: f.documentId,
      vaultPrincipalId: f.vaultPrincipalId,
      summary: f.summary,
      details: f.details as Record<string, unknown> | null,
    })),
  );
}

// ---------- SQL-pure scan implementations ----------

async function scanUnsupportedClaims(
  db: DbExecutor,
  input: ScanInput,
): Promise<PendingFinding[]> {
  // A claim is unsupported when no evidence row points at it AND it is
  // not in 'deprecated' / 'superseded' status (those are intentionally
  // dangling).
  const vaultPrincipalId =
    input.scope.kind === 'vault'
      ? input.scope.vaultPrincipalId
      : await loadDocumentOwner(db, input.scope.documentId);

  const rows = await db
    .select({
      claimId: schema.claim.id,
      claimText: schema.claim.text,
      claimStatus: schema.claim.status,
      documentOriginId: schema.claim.documentOriginId,
    })
    .from(schema.claim)
    .leftJoin(
      schema.evidence,
      eq(schema.evidence.supportsClaimId, schema.claim.id),
    )
    .where(
      input.scope.kind === 'document'
        ? and(
            eq(schema.claim.documentOriginId, input.scope.documentId),
            isNull(schema.evidence.id),
          )
        : isNull(schema.evidence.id),
    );

  return rows
    .filter(
      (r) => r.claimStatus !== 'deprecated' && r.claimStatus !== 'superseded',
    )
    .map((r) => ({
      id: uuidv7(),
      kind: 'unsupported-claim' as const,
      severity:
        r.claimStatus === 'approved' ? ('high' as const) : ('medium' as const),
      jobId: input.jobId,
      claimId: r.claimId,
      evidenceId: null,
      sourceId: null,
      citationId: null,
      documentId: r.documentOriginId,
      vaultPrincipalId,
      summary: `Claim has no supporting evidence: "${truncate(r.claimText, 80)}"`,
      details: { claimStatus: r.claimStatus },
    }));
}

async function scanOutdatedSources(
  db: DbExecutor,
  input: ScanInput,
): Promise<PendingFinding[]> {
  const days = input.outdatedSourceDays ?? 540; // ~18 months
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const vaultPrincipalId =
    input.scope.kind === 'vault'
      ? input.scope.vaultPrincipalId
      : await loadDocumentOwner(db, input.scope.documentId);

  const conditions = [
    isNull(schema.source.archivedAt),
    isNotNull(schema.source.accessedAt),
    lt(schema.source.accessedAt, cutoff),
  ];
  if (input.scope.kind === 'vault') {
    conditions.push(eq(schema.source.importedBy, input.scope.vaultPrincipalId));
  }

  const rows = await db
    .select({
      sourceId: schema.source.id,
      title: schema.source.title,
      accessedAt: schema.source.accessedAt,
    })
    .from(schema.source)
    .where(and(...conditions));

  return rows.map((r) => ({
    id: uuidv7(),
    kind: 'outdated-source' as const,
    severity: 'low' as const,
    jobId: input.jobId,
    claimId: null,
    evidenceId: null,
    sourceId: r.sourceId,
    citationId: null,
    documentId: null,
    vaultPrincipalId,
    summary: `Source "${truncate(r.title, 80)}" not re-accessed for ${days}+ days`,
    details: {
      lastAccessedAt: r.accessedAt?.toISOString() ?? null,
      cutoffDays: days,
    },
  }));
}

async function scanUnverifiedAiBlocks(
  db: DbExecutor,
  input: ScanInput,
): Promise<PendingFinding[]> {
  const days = input.unverifiedAiAgingDays ?? 14;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const vaultPrincipalId =
    input.scope.kind === 'vault'
      ? input.scope.vaultPrincipalId
      : await loadDocumentOwner(db, input.scope.documentId);

  // Aging AI-suggested CLAIMS
  const claimRows = await db
    .select({
      claimId: schema.claim.id,
      claimText: schema.claim.text,
      createdAt: schema.claim.createdAt,
      documentOriginId: schema.claim.documentOriginId,
    })
    .from(schema.claim)
    .where(
      input.scope.kind === 'document'
        ? and(
            eq(schema.claim.documentOriginId, input.scope.documentId),
            eq(schema.claim.status, 'ai-suggested'),
            lt(schema.claim.createdAt, cutoff),
          )
        : and(
            eq(schema.claim.status, 'ai-suggested'),
            lt(schema.claim.createdAt, cutoff),
          ),
    );

  // Aging AI-suggested EVIDENCE
  const evidenceRows = await db
    .select({
      evidenceId: schema.evidence.id,
      excerpt: schema.evidence.excerpt,
      createdAt: schema.evidence.createdAt,
    })
    .from(schema.evidence)
    .where(
      and(
        eq(schema.evidence.status, 'ai-suggested'),
        lt(schema.evidence.createdAt, cutoff),
      ),
    );

  return [
    ...claimRows.map<PendingFinding>((r) => ({
      id: uuidv7(),
      kind: 'unverified-ai-block',
      severity: 'medium',
      jobId: input.jobId,
      claimId: r.claimId,
      evidenceId: null,
      sourceId: null,
      citationId: null,
      documentId: r.documentOriginId,
      vaultPrincipalId,
      summary: `AI-suggested claim pending review for ${days}+ days: "${truncate(r.claimText, 80)}"`,
      details: {
        ageDays: Math.round(
          (Date.now() - r.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        ),
      },
    })),
    ...evidenceRows.map<PendingFinding>((r) => ({
      id: uuidv7(),
      kind: 'unverified-ai-block',
      severity: 'medium',
      jobId: input.jobId,
      claimId: null,
      evidenceId: r.evidenceId,
      sourceId: null,
      citationId: null,
      documentId: null,
      vaultPrincipalId,
      summary: `AI-suggested evidence pending review for ${days}+ days: "${truncate(
        r.excerpt ?? '<no excerpt>',
        80,
      )}"`,
      details: {
        ageDays: Math.round(
          (Date.now() - r.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        ),
      },
    })),
  ];
}

async function scanContradictedConclusions(
  db: DbExecutor,
  input: ScanInput,
): Promise<PendingFinding[]> {
  // A claim is "contradicted-conclusion" when:
  //   1. At least one evidence row has relation='challenges' against it
  //   2. No claim_link of type='synthesizes' resolves it from a
  //      synthesis-typed claim
  // EXISTS / NOT EXISTS push the join into PG; one-row-per-claim out.
  const vaultPrincipalId =
    input.scope.kind === 'vault'
      ? input.scope.vaultPrincipalId
      : await loadDocumentOwner(db, input.scope.documentId);

  const conditions = [
    ne(schema.claim.status, 'deprecated' as never),
    ne(schema.claim.status, 'superseded' as never),
    sql`EXISTS (
      SELECT 1 FROM ${schema.evidence}
      WHERE ${schema.evidence.supportsClaimId} = ${schema.claim.id}
        AND ${schema.evidence.relation} = 'challenges'
    )`,
    sql`NOT EXISTS (
      SELECT 1 FROM ${schema.claimLink} cl
      JOIN ${schema.claim} sc ON sc.id = cl.from_claim_id
      WHERE cl.to_claim_id = ${schema.claim.id}
        AND cl.link_type = 'synthesizes'
        AND sc.claim_type = 'synthesis'
    )`,
  ];
  if (input.scope.kind === 'document') {
    conditions.push(eq(schema.claim.documentOriginId, input.scope.documentId));
  }

  const rows = await db
    .select({
      claimId: schema.claim.id,
      claimText: schema.claim.text,
      claimStatus: schema.claim.status,
      documentOriginId: schema.claim.documentOriginId,
    })
    .from(schema.claim)
    .where(and(...conditions));

  return rows.map((r) => ({
    id: uuidv7(),
    kind: 'contradicted-conclusion' as const,
    severity:
      r.claimStatus === 'approved' ? ('high' as const) : ('medium' as const),
    jobId: input.jobId,
    claimId: r.claimId,
    evidenceId: null,
    sourceId: null,
    citationId: null,
    documentId: r.documentOriginId,
    vaultPrincipalId,
    summary: `Claim has challenging evidence with no synthesis resolution: "${truncate(r.claimText, 80)}"`,
    details: { claimStatus: r.claimStatus },
  }));
}

async function scanDuplicatedClaims(
  db: DbExecutor,
  input: ScanInput,
): Promise<PendingFinding[]> {
  // Phase 4 W4 stub: exact-text-match duplicates only. Catches the
  // "user copy-pasted the same claim into two documents" case which
  // is common in vault-wide scans. Semantic similarity (embedding
  // index) is deferred to Phase 5.
  const vaultPrincipalId =
    input.scope.kind === 'vault'
      ? input.scope.vaultPrincipalId
      : await loadDocumentOwner(db, input.scope.documentId);

  const conditions = [
    ne(schema.claim.status, 'deprecated' as never),
    ne(schema.claim.status, 'superseded' as never),
  ];
  if (input.scope.kind === 'document') {
    conditions.push(eq(schema.claim.documentOriginId, input.scope.documentId));
  }

  // Group by text; keep groups with > 1 member. We expand each group
  // into one finding per member so the dashboard can link to each
  // duplicate individually with `details.otherClaimIds[]`.
  const dupRows = await db
    .select({
      text: schema.claim.text,
      claimIds: sql<string[]>`array_agg(${schema.claim.id})`,
      documentOriginIds: sql<
        (string | null)[]
      >`array_agg(${schema.claim.documentOriginId})`,
      statuses: sql<string[]>`array_agg(${schema.claim.status}::text)`,
    })
    .from(schema.claim)
    .where(and(...conditions))
    .groupBy(schema.claim.text)
    .having(sql`count(*) > 1`);

  const findings: PendingFinding[] = [];
  for (const dup of dupRows) {
    for (let i = 0; i < dup.claimIds.length; i++) {
      const claimId = dup.claimIds[i]!;
      const otherClaimIds = dup.claimIds.filter((_, j) => j !== i);
      const documentOriginId = dup.documentOriginIds[i] ?? null;
      const status = dup.statuses[i] ?? 'ai-suggested';
      findings.push({
        id: uuidv7(),
        kind: 'duplicated-claim',
        severity: status === 'approved' ? 'medium' : 'low',
        jobId: input.jobId,
        claimId,
        evidenceId: null,
        sourceId: null,
        citationId: null,
        documentId: documentOriginId,
        vaultPrincipalId,
        summary: `Claim text duplicated across ${dup.claimIds.length} entries: "${truncate(dup.text, 80)}"`,
        details: {
          otherClaimIds,
          method: 'exact-text-match',
          totalDuplicates: dup.claimIds.length,
        },
      });
    }
  }
  return findings;
}

async function scanBrokenCitations(
  db: DbExecutor,
  input: ScanInput,
  resolver: DoiResolver,
): Promise<PendingFinding[]> {
  // External network scan: ask the resolver to verify each DOI; emit
  // a finding for each failure. Bounded by brokenCitationBatchLimit
  // to keep scan latency predictable on vaults with thousands of
  // citations. The next scan picks up the rest.
  const vaultPrincipalId =
    input.scope.kind === 'vault'
      ? input.scope.vaultPrincipalId
      : await loadDocumentOwner(db, input.scope.documentId);

  const limit = input.brokenCitationBatchLimit ?? 100;
  const conditions = [
    isNotNull(schema.citation.doi),
    isNull(schema.citation.archivedAt),
  ];
  if (input.scope.kind === 'vault') {
    // Vault scope: filter to citations created by the vault owner.
    conditions.push(
      eq(schema.citation.createdBy, input.scope.vaultPrincipalId),
    );
  } else {
    // Document scope: filter to citations referenced by evidence in
    // this document. Citations are global so we can't filter by
    // doc id directly on the citation row.
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${schema.evidence}
      WHERE ${schema.evidence.citationId} = ${schema.citation.id}
        AND ${schema.evidence.documentOriginId} = ${input.scope.documentId}
    )`);
  }

  const citations = await db
    .select({
      citationId: schema.citation.id,
      doi: schema.citation.doi,
      kind: schema.citation.kind,
    })
    .from(schema.citation)
    .where(and(...conditions))
    .limit(limit);

  const findings: PendingFinding[] = [];
  for (const cit of citations) {
    if (!cit.doi) continue;
    const verdict = await resolver.resolve(cit.doi);
    if (!verdict.ok) {
      findings.push({
        id: uuidv7(),
        kind: 'broken-citation',
        severity: 'high',
        jobId: input.jobId,
        claimId: null,
        evidenceId: null,
        sourceId: null,
        citationId: cit.citationId,
        documentId: null,
        vaultPrincipalId,
        summary: `Citation DOI no longer resolves: ${cit.doi}`,
        details: {
          doi: cit.doi,
          reason: verdict.reason ?? 'unknown',
          citationKind: cit.kind,
        },
      });
    }
  }
  return findings;
}

// Phase 5 Wave B B4 (ADR-0016 §2.6) — unverified-claim scan.
//
// Surfaces claims that have been alive > N days (default 30) AND were
// created by an agent principal AND have NO endorsing human verdict
// (claim_review.verdict='endorses' AND is_ai_verdict=false AND
// withdrawn_at IS NULL).
//
// Approximation note (ADR-0016 §2.6 says "provenance.actor_kind 全是
// agent"): we use `principal.kind = 'agent'` on `claim.created_by` as
// a proxy. The proper check is harder because claim has no direct FK
// to provenance — getting there means walking contribution rows
// matching affected_block_ids, which is non-trivial in SQL. The proxy
// covers the dogfood case (AI-created claim never reviewed) without
// over-flagging mixed-actor claims.
async function scanUnverifiedClaims(
  db: DbExecutor,
  input: ScanInput,
): Promise<PendingFinding[]> {
  const days = input.unverifiedClaimAgingDays ?? 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const vaultPrincipalId =
    input.scope.kind === 'vault'
      ? input.scope.vaultPrincipalId
      : await loadDocumentOwner(db, input.scope.documentId);

  // Subquery: claims that have at least one endorsing human verdict.
  // We render this via a LEFT JOIN + filter for absence.
  const claimRows = await db
    .select({
      claimId: schema.claim.id,
      claimText: schema.claim.text,
      claimStatus: schema.claim.status,
      createdAt: schema.claim.createdAt,
      documentOriginId: schema.claim.documentOriginId,
      createdByKind: schema.principal.kind,
    })
    .from(schema.claim)
    .innerJoin(
      schema.principal,
      eq(schema.principal.id, schema.claim.createdBy),
    )
    .where(
      input.scope.kind === 'document'
        ? and(
            eq(schema.claim.documentOriginId, input.scope.documentId),
            lt(schema.claim.createdAt, cutoff),
            eq(schema.principal.kind, 'agent'),
          )
        : and(
            lt(schema.claim.createdAt, cutoff),
            eq(schema.principal.kind, 'agent'),
          ),
    );

  if (claimRows.length === 0) return [];

  // Pull all endorsing human verdicts for the candidate set in one shot.
  const candidateIds = claimRows.map((r) => r.claimId);
  const endorsingRows = await db
    .select({ claimId: schema.claimReview.claimId })
    .from(schema.claimReview)
    .where(
      and(
        eq(schema.claimReview.verdict, 'endorses'),
        eq(schema.claimReview.isAiVerdict, false),
        isNull(schema.claimReview.withdrawnAt),
      ),
    );
  const endorsedSet = new Set(
    endorsingRows
      .filter((r) => candidateIds.includes(r.claimId))
      .map((r) => r.claimId),
  );

  return claimRows
    .filter(
      (r) =>
        !endorsedSet.has(r.claimId) &&
        r.claimStatus !== 'deprecated' &&
        r.claimStatus !== 'superseded',
    )
    .map((r) => ({
      id: uuidv7(),
      kind: 'unverified-claim' as const,
      severity: 'medium' as const,
      jobId: input.jobId,
      claimId: r.claimId,
      evidenceId: null,
      sourceId: null,
      citationId: null,
      documentId: r.documentOriginId,
      vaultPrincipalId,
      summary: `Claim has no human-ORCID endorsement after ${days}+ days: "${truncate(r.claimText, 80)}"`,
      details: {
        agingDays: days,
        createdAt: r.createdAt.toISOString(),
        createdByKind: r.createdByKind,
      },
    }));
}

// ---------- Helpers ----------

async function loadDocumentOwner(
  db: DbExecutor,
  documentId: string,
): Promise<string> {
  const rows = await db
    .select({ ownerPrincipalId: schema.document.ownerPrincipalId })
    .from(schema.document)
    .where(eq(schema.document.id, documentId))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(`document ${documentId} not found`);
  }
  return rows[0]!.ownerPrincipalId;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

// suppress unused warning when sql tagged template not needed
void sql;
