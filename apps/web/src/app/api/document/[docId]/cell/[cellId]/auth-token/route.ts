// Phase 2 W4 ADR-0007 §2.4: cell auth-token endpoint.
//
// POST /api/document/<docId>/cell/<cellId>/auth-token
//   → { token, ttlSeconds: 300, audience: 'cell-runtime' }
//
// Issued only when the caller has `agent.invoke:custom` (per ADR-0002 §2.1)
// + `block.read` on the document. Reviewer-supplied tokens are gated by
// the owner having explicitly granted `cell.execute:<cellId>` (Phase 2
// new capability — ADR-0002 review log will register it).
//
// Token is short-lived (5 min) JWT, audience='cell-runtime', signed
// with SYNC_TOKEN_SECRET. The host page passes this token to the molab
// iframe via `cell.config` (per molab-protocol).
//
// This is the W4 stub — actual molab iframe wiring lands in W7 e2e
// (real iframe → JWT → cell.execute → cell.executed → figure insert).

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { signCellToken } from '@collaborationtool/permissions';
import { loadPrincipalContext } from '@collaborationtool/permissions';
import type { Capability } from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { getPrincipalIdForUser } from '@/lib/principal';

const REQUIRED_VERBS: Capability[] = ['agent.invoke:custom', 'block.read'];

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ docId: string; cellId: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { docId, cellId } = await ctx.params;
  if (!docId || !cellId) {
    return NextResponse.json({ error: 'missing-route-params' }, { status: 400 });
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
  for (const verb of REQUIRED_VERBS) {
    if (!principalContext.documentCapabilities.has(verb)) {
      return NextResponse.json(
        { error: 'capability-denied', verb },
        { status: 403 },
      );
    }
  }

  const token = await signCellToken(
    { sub: principalId, doc: documentId, cell: cellId },
    env.syncTokenSecret,
    { issuer: env.syncTokenIssuer },
  );

  return NextResponse.json({
    token,
    ttlSeconds: 300,
    audience: 'cell-runtime',
    cellId,
  });
}
