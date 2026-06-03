import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { schema } from '@collaborationtool/drizzle';
import type { Database } from '@collaborationtool/drizzle';
import {
  DEFAULT_ROLE_BUNDLES,
  loadPrincipalContext,
  materialiseRoleBundle,
} from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';
import type { PublishRejectReason } from '@/lib/publish';

export interface DocumentOpenPublishContext {
  db: Database;
  sessionUserId: string;
  principalId: string;
  doc: {
    id: string;
    ownerPrincipalId: string;
    title: string;
    slug: string;
    yjsDocBinary: Uint8Array | null;
  };
}

export type DocumentOpenPublishContextResult =
  | { ok: true; context: DocumentOpenPublishContext }
  | { ok: false; response: NextResponse };

export async function loadDocumentOpenPublishContext(
  docId: string,
): Promise<DocumentOpenPublishContextResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }),
    };
  }
  if (!docId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'missing-doc-id' }, { status: 400 }),
    };
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'no-principal' }, { status: 403 }),
    };
  }

  const db = getDb();
  const docRows = await db
    .select({
      id: schema.document.id,
      ownerPrincipalId: schema.document.ownerPrincipalId,
      title: schema.document.title,
      slug: schema.document.slug,
      yjsDocBinary: schema.document.yjsDocBinary,
    })
    .from(schema.document)
    .where(and(eq(schema.document.id, docId), isNull(schema.document.deletedAt)))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'document-not-found' }, { status: 404 }),
    };
  }

  let principalContext = await loadPrincipalContext(db, principalId, doc.id);
  if (!principalContext && principalId === doc.ownerPrincipalId) {
    await materialiseRoleBundle(db, {
      documentId: doc.id,
      principalId,
      roleId: 'paper-author',
      capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
    });
    principalContext = await loadPrincipalContext(db, principalId, doc.id);
  }
  if (!principalContext?.documentCapabilities.has('block.commit')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'capability-denied', verb: 'block.commit' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      db,
      sessionUserId: session.user.id,
      principalId,
      doc: {
        id: doc.id,
        ownerPrincipalId: doc.ownerPrincipalId,
        title: doc.title,
        slug: doc.slug,
        yjsDocBinary: doc.yjsDocBinary,
      },
    },
  };
}

export function publishRejectStatus(reason: PublishRejectReason): number {
  if (reason === 'empty-signed-jws') return 412;
  if (reason === 'signature-verify-failed') return 403;
  return 400;
}

export function devOpenLedgerSignatureVerifier(scope: string) {
  return () => {
    console.warn(
      `[${scope}] signature verifier in dev fallback — strict ORCID/JWS verification is a follow-up gate`,
    );
    return true;
  };
}
