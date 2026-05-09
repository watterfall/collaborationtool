// Phase 2 W7 ADR-0011 §2.5: Evidence Map dependency graph endpoint.
//
// GET /api/document/<docId>/evidence-map
//   → { claims, evidences, claimLinks, sources, crossDocReuse }
//
// Returns ALL claims/evidence/links **owned-by-or-mentioned-in** the
// document. Phase 2 W7 dogfood scope: single-doc + cross-doc reuse view
// (read-only). UI layer (Phase 3) renders the DAG.
//
// Capability gate: caller needs `block.read` on the document.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, inArray, sql } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext } from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { docId } = await ctx.params;
  if (!docId) {
    return NextResponse.json({ error: 'missing-doc-id' }, { status: 400 });
  }
  const documentId = docId as DocumentId;

  const principalId = (await getPrincipalIdForUser(session.user.id)) as
    | PrincipalId
    | null;
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }
  const db = getDb();
  const principalContext = await loadPrincipalContext(db, principalId, documentId);
  if (!principalContext) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }
  if (!principalContext.documentCapabilities.has('block.read')) {
    return NextResponse.json(
      { error: 'capability-denied', verb: 'block.read' },
      { status: 403 },
    );
  }

  // Step 1: claims originating in this document.
  const docClaims = await db
    .select()
    .from(schema.claim)
    .where(eq(schema.claim.documentOriginId, documentId));

  // Step 2: evidence supporting any of those claims (regardless of
  // origin doc — cross-doc evidence reuse is a feature, not a bug).
  const claimIds = docClaims.map((c) => c.id);
  const evidences = claimIds.length
    ? await db
        .select()
        .from(schema.evidence)
        .where(inArray(schema.evidence.supportsClaimId, claimIds))
    : [];

  // Step 3: claim_link rows touching any of those claims (either side).
  const claimLinks = claimIds.length
    ? await db
        .select()
        .from(schema.claimLink)
        .where(
          sql`${schema.claimLink.fromClaimId} IN (${sql.join(claimIds.map((id) => sql`${id}`), sql`, `)}) OR ${schema.claimLink.toClaimId} IN (${sql.join(claimIds.map((id) => sql`${id}`), sql`, `)})`,
        )
    : [];

  // Step 4: citation rows referenced by evidence (resolve sources).
  const citationIds = [
    ...new Set(
      evidences
        .map((e) => e.citationId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const sources = citationIds.length
    ? await db
        .select()
        .from(schema.citation)
        .where(inArray(schema.citation.id, citationIds))
    : [];

  // Step 5: cross-doc reuse — for each claim, find OTHER documents
  // that reference it (claims with same claimId originating elsewhere
  // are FUTURE / Phase 3; today claim is global, so reuse means "any
  // evidence in another doc supports this claim").
  const reuseMap = new Map<string, Set<string>>();
  if (claimIds.length) {
    const allEvidence = await db
      .select({
        supportsClaimId: schema.evidence.supportsClaimId,
        documentOriginId: schema.evidence.documentOriginId,
      })
      .from(schema.evidence)
      .where(inArray(schema.evidence.supportsClaimId, claimIds));
    for (const e of allEvidence) {
      if (!e.documentOriginId || e.documentOriginId === documentId) continue;
      let s = reuseMap.get(e.supportsClaimId);
      if (!s) {
        s = new Set();
        reuseMap.set(e.supportsClaimId, s);
      }
      s.add(e.documentOriginId);
    }
  }
  const crossDocReuse = [...reuseMap.entries()].map(([claimId, docs]) => ({
    claimId,
    documentIds: [...docs],
  }));

  return NextResponse.json({
    documentId,
    claims: docClaims,
    evidences,
    claimLinks,
    sources,
    crossDocReuse,
    generatedAt: new Date().toISOString(),
  });
}
