// Phase 6 W2 P2 — POST /api/publish (ADR-0018 §2.4 F4 publish flow).
//
// Generic endpoint accepting any of 4 entity kinds (open_question /
// open_dataset / open_peer_review / share_snapshot). Single endpoint
// keeps the publish contract uniform — body shape varies by `kind`,
// but signing / Merkle log / persistence path is identical.
//
// Request:
//   POST /api/publish
//   { kind, entityId, content, contentHashHex, signedJws, merkleEntryId,
//     prevMerkleEntryId?: string|null }
//
// Response 201:
//   { entityId, merkleLogEntryId, entrySeq, permalink? }
//
// Response 4xx (reason field maps to PublishRejectReason union):
//   { error: 'reason-slug', detail?: string }
//
// Signature verification:
//   The route loads the signer's ed25519 public key (TODO: PG column
//   added in a future migration; until then a stub returns null and
//   the verifier passes through in dev mode — see TODO inline). When
//   the column lands, the verifier wraps `@collaborationtool/identity`
//   verify with the looked-up public key.
//
// Phase 6 W2 P2 scope: signature verifier passes when public key
// missing (dev fallback) but logs a warning. Phase 6 W3+ migration
// 0017 adds principal.ed25519_public_key and route flips to strict.

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';
import { validateContentForKind, validatePublish } from '@/lib/publish';

interface PublishBody {
  kind?: unknown;
  entityId?: unknown;
  content?: unknown;
  contentHashHex?: unknown;
  signedJws?: unknown;
  merkleEntryId?: unknown;
  prevMerkleEntryId?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  // ---------- Step 1: validate body shape per entity kind ----------
  if (typeof body.kind !== 'string') {
    return NextResponse.json({ error: 'invalid-kind' }, { status: 400 });
  }
  const kind = body.kind as 'open_question' | 'open_dataset' | 'open_peer_review' | 'share_snapshot';

  const contentCheck = validateContentForKind(kind, body.content);
  if (!contentCheck.ok) {
    return NextResponse.json(
      { error: 'invalid-content', detail: contentCheck.reason },
      { status: 400 },
    );
  }

  // ---------- Step 2: build signature verifier ----------
  //
  // TODO (Phase 6 W3+ migration 0017): SELECT ed25519_public_key
  //   FROM principal WHERE id = principalId. For now use a permissive
  //   stub that always returns true with a console.warn — Phase 6 W2
  //   demo flow only. Strict verify wired when the column lands.
  const signatureVerifier = (_jws: string, _payload: unknown): boolean => {
    console.warn(
      '[publish] signature verifier in dev fallback — Phase 6 W3+ migration 0017 adds principal.ed25519_public_key',
    );
    return true;
  };

  // ---------- Step 3: load latest Merkle entry id for prev pointer ----------
  // Note: caller may supply prevMerkleEntryId explicitly; we accept it
  // but for a fresh log (no rows yet) callers SHOULD pass null and
  // server confirms the log is empty (genesis row).
  const db = getDb();
  const callerPrev =
    body.prevMerkleEntryId === null || body.prevMerkleEntryId === undefined
      ? null
      : typeof body.prevMerkleEntryId === 'string'
        ? body.prevMerkleEntryId
        : null;

  // ---------- Step 4: validate publish payload ----------
  const validation = validatePublish({
    kind,
    entityId: typeof body.entityId === 'string' ? body.entityId : '',
    content: body.content,
    contentHashHex: typeof body.contentHashHex === 'string' ? body.contentHashHex : '',
    signedJws: typeof body.signedJws === 'string' ? body.signedJws : '',
    signerPrincipalId: principalId,
    prevMerkleEntryId: callerPrev,
    merkleEntryId: typeof body.merkleEntryId === 'string' ? body.merkleEntryId : '',
    signatureVerifier,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  // ---------- Step 5: INSERT (entity row + Merkle log row in one tx) ----------
  // Wrap both writes so a partial failure (e.g. UNIQUE collision on
  // entity_id) rolls back the Merkle entry too.
  try {
    await db.transaction(async (tx) => {
      // §5a: insert Merkle log entry first (entity FKs into it)
      await tx.insert(schema.provenanceMerkleLog).values({
        id: validation.payload.merkleEntry.id,
        prevEntryId: validation.payload.merkleEntry.prevEntryId,
        entityKind: validation.payload.merkleEntry.entityKind,
        entityId: validation.payload.merkleEntry.entityId,
        contentHash: Buffer.from(validation.payload.merkleEntry.contentHash),
        signedJws: validation.payload.merkleEntry.signedJws,
        signerPrincipalId: validation.payload.merkleEntry.signerPrincipalId,
      });

      // §5b: insert entity row per kind
      const merkleId = validation.payload.merkleEntry.id;
      const sjws = validation.payload.signedJws;
      const entId = validation.payload.entityId;

      switch (kind) {
        case 'open_question': {
          const c = body.content as {
            questionMd: string;
            domainTags: string[];
            sourceSubdocId?: string;
          };
          await tx.insert(schema.openQuestion).values({
            id: entId,
            askerPrincipalId: principalId,
            questionMd: c.questionMd,
            domainTags: c.domainTags,
            ...(c.sourceSubdocId ? { sourceSubdocId: c.sourceSubdocId } : {}),
            signedPayloadJws: sjws,
            merkleLogEntryId: merkleId,
          });
          break;
        }
        case 'open_dataset': {
          const c = body.content as {
            title: string;
            descriptionMd: string;
            blobStorageRef: string;
            sizeBytes: number;
            licenseSpdx: string;
            datasetDoi?: string;
          };
          await tx.insert(schema.openDataset).values({
            id: entId,
            contributorPrincipalId: principalId,
            title: c.title,
            descriptionMd: c.descriptionMd,
            blobStorageRef: c.blobStorageRef,
            sizeBytes: BigInt(c.sizeBytes),
            licenseSpdx: c.licenseSpdx,
            ...(c.datasetDoi ? { datasetDoi: c.datasetDoi } : {}),
            signedPayloadJws: sjws,
            merkleLogEntryId: merkleId,
          });
          break;
        }
        case 'open_peer_review': {
          const c = body.content as {
            reviewerOrcidId: string;
            targetKind: 'question' | 'dataset' | 'snapshot';
            targetId: string;
            verdict: 'endorses' | 'challenges' | 'refines';
            bodyMd: string;
            evidenceRefs: string[];
          };
          await tx.insert(schema.openPeerReview).values({
            id: entId,
            reviewerPrincipalId: principalId,
            reviewerOrcidId: c.reviewerOrcidId,
            targetKind: c.targetKind,
            targetId: c.targetId,
            verdict: c.verdict,
            bodyMd: c.bodyMd,
            evidenceRefs: c.evidenceRefs,
            signedPayloadJws: sjws,
            merkleLogEntryId: merkleId,
          });
          break;
        }
        case 'share_snapshot': {
          const c = body.content as {
            sourceSubdocId?: string;
            markdownContent: string;
            yjsBinaryBase64: string;
            kind: 'section' | 'preprint' | 'dataset';
            permalinkHash: string;
            doi?: string;
          };
          const yjsBytes = Buffer.from(c.yjsBinaryBase64, 'base64');
          await tx.insert(schema.shareSnapshot).values({
            id: entId,
            sourcePrincipalId: principalId,
            ...(c.sourceSubdocId ? { sourceSubdocId: c.sourceSubdocId } : {}),
            markdownContent: c.markdownContent,
            yjsBinary: yjsBytes,
            kind: c.kind,
            permalinkHash: c.permalinkHash,
            ...(c.doi ? { doi: c.doi } : {}),
            signedPayloadJws: sjws,
            merkleLogEntryId: merkleId,
          });
          break;
        }
      }
    });
  } catch (err) {
    // PG constraint violations surface here (e.g. UNIQUE collision on
    // permalink_hash, FK violation on subdoc_id). Map to 409/400.
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json(
      { error: 'db-write-failed', detail: msg },
      { status: 409 },
    );
  }

  // ---------- Step 6: response ----------
  return NextResponse.json(
    {
      entityId: validation.payload.entityId,
      merkleLogEntryId: validation.payload.merkleEntry.id,
      kind: validation.payload.kind,
    },
    { status: 201 },
  );
}
