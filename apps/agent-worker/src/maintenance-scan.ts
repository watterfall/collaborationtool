// Phase 4 W4 ADR-0011 + Phase 3 W4 maintenance scan worker logic.
//
// Per essay §7.4 the scan looks for 6 categories of knowledge debt.
// 3 of them are SQL-pure (computable directly from PG with no LLM):
//
//   - unsupported-claim: claim without any evidence row referencing it
//   - outdated-source: source.accessed_at older than cutoff (default 18mo)
//   - unverified-ai-block: claim/evidence still in 'ai-suggested' status
//                          older than aging threshold (default 14d)
//
// The other 3 require an LLM or external network and stay deferred:
//
//   - duplicated-claim (semantic similarity across vault) — Phase 4 W4
//     end / Phase 5 (vector index)
//   - contradicted-conclusion (claim has 'challenges' evidence but no
//     synthesis claim resolving it) — half SQL, half LLM; W4 末
//   - broken-citation (DOI no longer resolves) — needs network fetch;
//     stays deferred until ADR-0006 MCP server bandwidth allowed
//
// This module is the SQL-pure half. Tests exercise it against the
// drizzle in-memory schema (or a real PG when DATABASE_URL is set).

import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
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
  | 'broken-citation';

export type ScanScope =
  | { kind: 'document'; documentId: string }
  | { kind: 'vault'; vaultPrincipalId: PrincipalId };

export interface ScanInput {
  scope: ScanScope;
  /** Restrict to specific finding kinds. Default = all SQL-pure 3. */
  findingKinds?: ScanFindingKind[];
  /** When the source has not been re-accessed in this many days, flag it. */
  outdatedSourceDays?: number;
  /** When an AI-suggested claim/evidence has been pending this long, flag it. */
  unverifiedAiAgingDays?: number;
  /** The agent_job that triggered this scan. Stamped onto each finding. */
  jobId: string;
}

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
  const kinds = input.findingKinds ?? [
    'unsupported-claim',
    'outdated-source',
    'unverified-ai-block',
  ];
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
