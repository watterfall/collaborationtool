// POST /api/document/[docId]/share-snapshot
//
// Publish a shareable manuscript snapshot from the editor into the
// public open collaboration ledger. The server derives the permalink
// hash from the submitted public preview + archive payload, then writes
// the snapshot and Merkle entry atomically.

import { contentHashHex } from '@collaborationtool/open-content';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';

import {
  loadDocumentOpenPublishContext,
  publishRejectStatus,
  resolveOpenContentSignatureInput,
} from '@/lib/document-open-publish';
import { buildShareSnapshotPublishContent } from '@/lib/open-content-feed';
import {
  allowOpenContentDevSignatureFallback,
  buildPrincipalOpenContentSignatureVerifier,
  persistPrincipalEd25519PublicKeyIfNeeded,
} from '@/lib/open-content-signature-store';
import { getOrcidIdentityForUser } from '@/lib/orcid-lookup';
import { validatePublish } from '@/lib/publish';

interface PublishSnapshotBody {
  markdownContent?: unknown;
  kind?: unknown;
  yjsBinaryBase64?: unknown;
  pmJsonArchiveBase64?: unknown;
  doi?: unknown;
  supersedesSnapshotId?: unknown;
  signedPayloadJws?: unknown;
  orcidIdToken?: unknown;
  orcidIdParam?: unknown;
  signaturePublicKey?: unknown;
}

const ORCID_ID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  const { docId } = await ctx.params;
  const loaded = await loadDocumentOpenPublishContext(docId);
  if (!loaded.ok) return loaded.response;
  const { db, sessionUserId, principalId, doc } = loaded.context;

  let body: PublishSnapshotBody;
  try {
    body = (await request.json()) as PublishSnapshotBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const yjsBinaryBase64 = resolveSnapshotArchiveBase64(body, doc.yjsDocBinary);
  const permalinkHash = contentHashHex({
    markdownContent:
      typeof body.markdownContent === 'string'
        ? body.markdownContent.trim()
        : '',
    kind: body.kind,
    yjsBinaryBase64,
    doi: typeof body.doi === 'string' ? body.doi.trim() : undefined,
    supersedesSnapshotId:
      typeof body.supersedesSnapshotId === 'string'
        ? body.supersedesSnapshotId.trim()
        : undefined,
  });

  const draft = buildShareSnapshotPublishContent({
    markdownContent: body.markdownContent,
    yjsBinaryBase64,
    kind: body.kind,
    permalinkHash,
    doi: body.doi,
    supersedesSnapshotId: body.supersedesSnapshotId,
  });
  if (!draft.ok) {
    return NextResponse.json(
      { error: 'invalid-share-snapshot', detail: draft.reason },
      { status: 400 },
    );
  }

  const linkedIdentity = await getOrcidIdentityForUser(sessionUserId);
  const clientOrcidId =
    typeof body.orcidIdParam === 'string' ? body.orcidIdParam.trim() : null;
  if (clientOrcidId && !ORCID_ID_RE.test(clientOrcidId)) {
    return NextResponse.json({ error: 'invalid-orcid-id' }, { status: 400 });
  }
  const signatureInput = resolveOpenContentSignatureInput({
    linkedIdentity,
    clientOrcidId,
    clientSignedPayloadJws:
      typeof body.signedPayloadJws === 'string'
        ? body.signedPayloadJws
        : typeof body.orcidIdToken === 'string'
          ? body.orcidIdToken
          : '',
  });
  if (!signatureInput.callerOrcidId) {
    return NextResponse.json({ error: 'no-orcid-linked' }, { status: 412 });
  }

  const prevRows = await db
    .select({ id: schema.provenanceMerkleLog.id })
    .from(schema.provenanceMerkleLog)
    .orderBy(desc(schema.provenanceMerkleLog.entrySeq))
    .limit(1);
  const snapshotId = uuidv7();
  const merkleEntryId = uuidv7();
  const signatureVerifier = await buildPrincipalOpenContentSignatureVerifier({
    db,
    principalId,
    submittedPublicKey: body.signaturePublicKey,
    scope: 'document-share-snapshot',
    allowDevFallback: allowOpenContentDevSignatureFallback(),
  });
  const validation = validatePublish({
    kind: 'share_snapshot',
    entityId: snapshotId,
    content: draft.content,
    contentHashHex: contentHashHex(draft.content),
    signedJws: signatureInput.signedPayloadJws,
    signerPrincipalId: principalId,
    prevMerkleEntryId: prevRows[0]?.id ?? null,
    merkleEntryId,
    signatureVerifier: signatureVerifier.verifier,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: publishRejectStatus(validation.reason) },
    );
  }

  try {
    await db.transaction(async (tx) => {
      await persistPrincipalEd25519PublicKeyIfNeeded(
        tx,
        principalId,
        signatureVerifier.publicKeyToPersist,
      );
      await tx.insert(schema.provenanceMerkleLog).values({
        id: validation.payload.merkleEntry.id,
        prevEntryId: validation.payload.merkleEntry.prevEntryId,
        entityKind: validation.payload.merkleEntry.entityKind,
        entityId: validation.payload.merkleEntry.entityId,
        contentHash: Buffer.from(validation.payload.merkleEntry.contentHash),
        signedJws: validation.payload.merkleEntry.signedJws,
        signerPrincipalId: validation.payload.merkleEntry.signerPrincipalId,
      });

      await tx.insert(schema.shareSnapshot).values({
        id: snapshotId,
        sourcePrincipalId: principalId,
        markdownContent: draft.content.markdownContent,
        yjsBinary: Buffer.from(draft.content.yjsBinaryBase64, 'base64'),
        kind: draft.content.kind,
        permalinkHash: draft.content.permalinkHash,
        ...(draft.content.doi ? { doi: draft.content.doi } : {}),
        ...(draft.content.supersedesSnapshotId
          ? { supersedesSnapshotId: draft.content.supersedesSnapshotId }
          : {}),
        signedPayloadJws: validation.payload.signedJws,
        merkleLogEntryId: validation.payload.merkleEntry.id,
      });
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json(
      { error: 'db-write-failed', detail },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      snapshotId,
      href: `/open/snapshot/${encodeURIComponent(draft.content.permalinkHash)}`,
      permalinkHash: draft.content.permalinkHash,
      merkleLogEntryId: validation.payload.merkleEntry.id,
      sourceOrcidId: signatureInput.callerOrcidId,
    },
    { status: 201 },
  );
}

function resolveSnapshotArchiveBase64(
  body: PublishSnapshotBody,
  documentYjsBinary: Uint8Array | null,
): string {
  if (
    typeof body.yjsBinaryBase64 === 'string' &&
    body.yjsBinaryBase64.trim().length > 0
  ) {
    return body.yjsBinaryBase64.trim();
  }
  if (
    typeof body.pmJsonArchiveBase64 === 'string' &&
    body.pmJsonArchiveBase64.trim().length > 0
  ) {
    return body.pmJsonArchiveBase64.trim();
  }
  return documentYjsBinary ? Buffer.from(documentYjsBinary).toString('base64') : '';
}
