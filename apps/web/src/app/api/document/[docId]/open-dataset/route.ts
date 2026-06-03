// POST /api/document/[docId]/open-dataset
//
// Publish a reproducibility asset from a private research document into
// the public open collaboration ledger. The route narrows the generic
// publish contract into an editor action: callers provide asset metadata,
// while the server stamps ids, hash and Merkle provenance.

import { contentHashHex } from '@collaborationtool/open-content';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';

import { resolveReviewSignatureInput } from '@/lib/claim-review';
import {
  devOpenLedgerSignatureVerifier,
  loadDocumentOpenPublishContext,
  publishRejectStatus,
} from '@/lib/document-open-publish';
import { buildOpenDatasetPublishContent } from '@/lib/open-content-feed';
import { getOrcidIdentityForUser } from '@/lib/orcid-lookup';
import { validatePublish } from '@/lib/publish';

interface PublishDatasetBody {
  title?: unknown;
  descriptionMd?: unknown;
  blobStorageRef?: unknown;
  sizeBytes?: unknown;
  licenseSpdx?: unknown;
  datasetDoi?: unknown;
  signedPayloadJws?: unknown;
  orcidIdToken?: unknown;
  orcidIdParam?: unknown;
}

const ORCID_ID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  const { docId } = await ctx.params;
  const loaded = await loadDocumentOpenPublishContext(docId);
  if (!loaded.ok) return loaded.response;
  const { db, sessionUserId, principalId } = loaded.context;

  let body: PublishDatasetBody;
  try {
    body = (await request.json()) as PublishDatasetBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const draft = buildOpenDatasetPublishContent({
    title: body.title,
    descriptionMd: body.descriptionMd,
    blobStorageRef: body.blobStorageRef,
    sizeBytes: body.sizeBytes,
    licenseSpdx: body.licenseSpdx,
    datasetDoi: body.datasetDoi,
  });
  if (!draft.ok) {
    return NextResponse.json(
      { error: 'invalid-open-dataset', detail: draft.reason },
      { status: 400 },
    );
  }

  const linkedIdentity = await getOrcidIdentityForUser(sessionUserId);
  const clientOrcidId =
    typeof body.orcidIdParam === 'string' ? body.orcidIdParam.trim() : null;
  if (clientOrcidId && !ORCID_ID_RE.test(clientOrcidId)) {
    return NextResponse.json({ error: 'invalid-orcid-id' }, { status: 400 });
  }
  const signatureInput = resolveReviewSignatureInput({
    linkedIdentity,
    clientOrcidId,
    clientSignedPayloadJws:
      typeof body.orcidIdToken === 'string'
        ? body.orcidIdToken
        : typeof body.signedPayloadJws === 'string'
          ? body.signedPayloadJws
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
  const datasetId = uuidv7();
  const merkleEntryId = uuidv7();
  const validation = validatePublish({
    kind: 'open_dataset',
    entityId: datasetId,
    content: draft.content,
    contentHashHex: contentHashHex(draft.content),
    signedJws: signatureInput.signedPayloadJws,
    signerPrincipalId: principalId,
    prevMerkleEntryId: prevRows[0]?.id ?? null,
    merkleEntryId,
    signatureVerifier: devOpenLedgerSignatureVerifier('document-open-dataset'),
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: publishRejectStatus(validation.reason) },
    );
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.provenanceMerkleLog).values({
        id: validation.payload.merkleEntry.id,
        prevEntryId: validation.payload.merkleEntry.prevEntryId,
        entityKind: validation.payload.merkleEntry.entityKind,
        entityId: validation.payload.merkleEntry.entityId,
        contentHash: Buffer.from(validation.payload.merkleEntry.contentHash),
        signedJws: validation.payload.merkleEntry.signedJws,
        signerPrincipalId: validation.payload.merkleEntry.signerPrincipalId,
      });

      await tx.insert(schema.openDataset).values({
        id: datasetId,
        contributorPrincipalId: principalId,
        title: draft.content.title,
        descriptionMd: draft.content.descriptionMd,
        blobStorageRef: draft.content.blobStorageRef,
        sizeBytes: BigInt(draft.content.sizeBytes),
        licenseSpdx: draft.content.licenseSpdx,
        ...(draft.content.datasetDoi
          ? { datasetDoi: draft.content.datasetDoi }
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
      datasetId,
      href: `/open/dataset/${encodeURIComponent(datasetId)}`,
      merkleLogEntryId: validation.payload.merkleEntry.id,
      contributorOrcidId: signatureInput.callerOrcidId,
    },
    { status: 201 },
  );
}
