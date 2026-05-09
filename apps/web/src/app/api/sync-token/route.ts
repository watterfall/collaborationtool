// Issues a short-lived JWT for a (principal, document) pair.
// The Editor client component fetches this before opening the WebSocket
// to apps/sync-gateway. Cookie-based auth (better-auth session) protects
// this endpoint; the JWT is HS256 over the SYNC_TOKEN_SECRET shared
// between web and gateway.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import {
  signSyncToken,
  loadPrincipalContext,
} from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { documentId?: unknown };
  try {
    body = (await request.json()) as { documentId?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (typeof body.documentId !== 'string') {
    return NextResponse.json({ error: 'missing-document-id' }, { status: 400 });
  }
  const documentId = body.documentId as DocumentId;

  const principalId = (await getPrincipalIdForUser(
    session.user.id,
  )) as PrincipalId | null;
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  // Confirm the document exists and the principal can read it before
  // signing. We don't want to leak which docs exist by just signing
  // tokens for arbitrary documentIds.
  const db = getDb();
  const docs = await db
    .select({ id: schema.document.id })
    .from(schema.document)
    .where(
      and(
        eq(schema.document.id, documentId),
        isNull(schema.document.deletedAt),
      ),
    )
    .limit(1);
  if (docs.length === 0) {
    return NextResponse.json({ error: 'document-not-found' }, { status: 404 });
  }

  const ctx = await loadPrincipalContext(db, principalId, documentId);
  if (!ctx || !ctx.documentCapabilities.has('document.read')) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }

  const token = await signSyncToken(
    { sub: principalId, doc: documentId },
    env.syncTokenSecret,
    {
      issuer: env.syncTokenIssuer,
      audience: env.syncTokenAudience,
    },
  );

  return NextResponse.json({
    token,
    gatewayUrl: env.syncGatewayWsUrl,
    // Include the mode the gateway will assign so the client can
    // pre-render UI without waiting for the mode_set frame.
    expectedMode: ctx.documentCapabilities.has('block.commit')
      ? 'writer'
      : ctx.documentCapabilities.has('block.propose')
        ? 'proposer'
        : 'reader',
  });
}
