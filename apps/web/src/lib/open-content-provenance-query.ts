import 'server-only';

import { eq } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { getDb } from '@/lib/db';
import {
  assessOpenContentProvenance,
  fingerprintEd25519PublicKey,
  type OpenContentProvenanceSummary,
} from '@/lib/open-content-provenance';

export type OpenContentVerificationMode =
  | 'public-replayable'
  | 'server-summary-only';

export interface OpenContentMerkleBundle {
  id: string;
  prevEntryId: string | null;
  entrySeq: string;
  entityKind: string;
  entityId: string;
  contentHashHex: string;
  signedJws: string;
  signerPrincipalId: string;
  appendedAt: string;
}

export interface OpenContentSignerBundle {
  principalId: string;
  ed25519PublicKey: string | null;
  publicKeyFingerprint: string | null;
}

export interface OpenContentVerificationBundle {
  summary: OpenContentProvenanceSummary;
  verificationMode: OpenContentVerificationMode;
  canonicalContent: unknown | null;
  signedPayloadJws: string | null;
  merkleEntry: OpenContentMerkleBundle | null;
  signer: OpenContentSignerBundle | null;
  redactedFields: string[];
}

const UNAVAILABLE_PROVENANCE = {
  status: 'unavailable',
  contentHashHex: null,
  merkleLogEntryId: '',
  signerPrincipalId: null,
  signatureAlgorithm: null,
  publicKeyFingerprint: null,
} satisfies OpenContentProvenanceSummary;

const UNAVAILABLE_BUNDLE = {
  summary: UNAVAILABLE_PROVENANCE,
  verificationMode: 'server-summary-only',
  canonicalContent: null,
  signedPayloadJws: null,
  merkleEntry: null,
  signer: null,
  redactedFields: [],
} satisfies OpenContentVerificationBundle;

export async function loadOpenQuestionProvenanceSummary(
  questionId: string,
): Promise<OpenContentProvenanceSummary> {
  return (await loadOpenQuestionVerificationBundle(questionId)).summary;
}

export async function loadOpenQuestionVerificationBundle(
  questionId: string,
): Promise<OpenContentVerificationBundle> {
  return loadBundleSafely(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.openQuestion.id,
        questionMd: schema.openQuestion.questionMd,
        domainTags: schema.openQuestion.domainTags,
        sourceSubdocId: schema.openQuestion.sourceSubdocId,
        signedPayloadJws: schema.openQuestion.signedPayloadJws,
        merkleLogEntryId: schema.openQuestion.merkleLogEntryId,
      })
      .from(schema.openQuestion)
      .where(eq(schema.openQuestion.id, questionId))
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) return UNAVAILABLE_BUNDLE;

    return loadEntityVerificationBundle({
      kind: 'open_question',
      entityId: row.id,
      content: {
        questionMd: row.questionMd,
        domainTags: [...row.domainTags],
        ...(row.sourceSubdocId ? { sourceSubdocId: row.sourceSubdocId } : {}),
      },
      signedPayloadJws: row.signedPayloadJws,
      merkleLogEntryId: row.merkleLogEntryId,
      verificationMode: 'public-replayable',
      redactedFields: [],
    });
  });
}

export async function loadOpenDatasetProvenanceSummary(
  datasetId: string,
): Promise<OpenContentProvenanceSummary> {
  return (await loadOpenDatasetVerificationBundle(datasetId)).summary;
}

export async function loadOpenDatasetVerificationBundle(
  datasetId: string,
): Promise<OpenContentVerificationBundle> {
  return loadBundleSafely(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.openDataset.id,
        datasetDoi: schema.openDataset.datasetDoi,
        title: schema.openDataset.title,
        descriptionMd: schema.openDataset.descriptionMd,
        blobStorageRef: schema.openDataset.blobStorageRef,
        sizeBytes: schema.openDataset.sizeBytes,
        licenseSpdx: schema.openDataset.licenseSpdx,
        signedPayloadJws: schema.openDataset.signedPayloadJws,
        merkleLogEntryId: schema.openDataset.merkleLogEntryId,
      })
      .from(schema.openDataset)
      .where(eq(schema.openDataset.id, datasetId))
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) return UNAVAILABLE_BUNDLE;

    return loadEntityVerificationBundle({
      kind: 'open_dataset',
      entityId: row.id,
      content: {
        title: row.title,
        descriptionMd: row.descriptionMd,
        blobStorageRef: row.blobStorageRef,
        sizeBytes: Number(row.sizeBytes),
        licenseSpdx: row.licenseSpdx,
        ...(row.datasetDoi ? { datasetDoi: row.datasetDoi } : {}),
      },
      signedPayloadJws: row.signedPayloadJws,
      merkleLogEntryId: row.merkleLogEntryId,
      verificationMode: 'server-summary-only',
      redactedFields: ['blobStorageRef'],
    });
  });
}

export async function loadOpenSnapshotProvenanceSummary(
  permalinkHash: string,
): Promise<OpenContentProvenanceSummary> {
  return (await loadOpenSnapshotVerificationBundle(permalinkHash)).summary;
}

export async function loadOpenSnapshotVerificationBundle(
  permalinkHash: string,
): Promise<OpenContentVerificationBundle> {
  return loadBundleSafely(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.shareSnapshot.id,
        sourceSubdocId: schema.shareSnapshot.sourceSubdocId,
        markdownContent: schema.shareSnapshot.markdownContent,
        yjsBinary: schema.shareSnapshot.yjsBinary,
        kind: schema.shareSnapshot.kind,
        permalinkHash: schema.shareSnapshot.permalinkHash,
        doi: schema.shareSnapshot.doi,
        supersedesSnapshotId: schema.shareSnapshot.supersedesSnapshotId,
        signedPayloadJws: schema.shareSnapshot.signedPayloadJws,
        merkleLogEntryId: schema.shareSnapshot.merkleLogEntryId,
      })
      .from(schema.shareSnapshot)
      .where(eq(schema.shareSnapshot.permalinkHash, permalinkHash))
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) return UNAVAILABLE_BUNDLE;

    return loadEntityVerificationBundle({
      kind: 'share_snapshot',
      entityId: row.id,
      content: {
        ...(row.sourceSubdocId ? { sourceSubdocId: row.sourceSubdocId } : {}),
        markdownContent: row.markdownContent,
        yjsBinaryBase64: Buffer.from(row.yjsBinary).toString('base64'),
        kind: row.kind,
        permalinkHash: row.permalinkHash,
        ...(row.doi ? { doi: row.doi } : {}),
        ...(row.supersedesSnapshotId
          ? { supersedesSnapshotId: row.supersedesSnapshotId }
          : {}),
      },
      signedPayloadJws: row.signedPayloadJws,
      merkleLogEntryId: row.merkleLogEntryId,
      verificationMode: 'server-summary-only',
      redactedFields: ['yjsBinaryBase64'],
    });
  });
}

export async function loadOpenReviewProvenanceSummary(
  reviewId: string,
): Promise<OpenContentProvenanceSummary> {
  return (await loadOpenReviewVerificationBundle(reviewId)).summary;
}

export async function loadOpenReviewVerificationBundle(
  reviewId: string,
): Promise<OpenContentVerificationBundle> {
  return loadBundleSafely(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.openPeerReview.id,
        reviewerOrcidId: schema.openPeerReview.reviewerOrcidId,
        targetKind: schema.openPeerReview.targetKind,
        targetId: schema.openPeerReview.targetId,
        verdict: schema.openPeerReview.verdict,
        bodyMd: schema.openPeerReview.bodyMd,
        evidenceRefs: schema.openPeerReview.evidenceRefs,
        signedPayloadJws: schema.openPeerReview.signedPayloadJws,
        merkleLogEntryId: schema.openPeerReview.merkleLogEntryId,
      })
      .from(schema.openPeerReview)
      .where(eq(schema.openPeerReview.id, reviewId))
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) return UNAVAILABLE_BUNDLE;

    return loadEntityVerificationBundle({
      kind: 'open_peer_review',
      entityId: row.id,
      content: {
        reviewerOrcidId: row.reviewerOrcidId,
        targetKind: row.targetKind,
        targetId: row.targetId,
        verdict: row.verdict,
        bodyMd: row.bodyMd,
        evidenceRefs: [...row.evidenceRefs],
      },
      signedPayloadJws: row.signedPayloadJws,
      merkleLogEntryId: row.merkleLogEntryId,
      verificationMode: 'public-replayable',
      redactedFields: [],
    });
  });
}

async function loadEntityVerificationBundle(input: {
  kind: string;
  entityId: string;
  content: unknown;
  signedPayloadJws: string;
  merkleLogEntryId: string;
  verificationMode: OpenContentVerificationMode;
  redactedFields: string[];
}): Promise<OpenContentVerificationBundle> {
  const db = getDb();
  const merkleRows = await db
    .select({
      id: schema.provenanceMerkleLog.id,
      prevEntryId: schema.provenanceMerkleLog.prevEntryId,
      entrySeq: schema.provenanceMerkleLog.entrySeq,
      entityKind: schema.provenanceMerkleLog.entityKind,
      entityId: schema.provenanceMerkleLog.entityId,
      contentHash: schema.provenanceMerkleLog.contentHash,
      signedJws: schema.provenanceMerkleLog.signedJws,
      signerPrincipalId: schema.provenanceMerkleLog.signerPrincipalId,
      appendedAt: schema.provenanceMerkleLog.appendedAt,
    })
    .from(schema.provenanceMerkleLog)
    .where(eq(schema.provenanceMerkleLog.id, input.merkleLogEntryId))
    .limit(1);
  const merkleEntry = merkleRows[0] ?? null;

  const principalRows = merkleEntry
    ? await db
        .select({ ed25519PublicKey: schema.principal.ed25519PublicKey })
        .from(schema.principal)
        .where(eq(schema.principal.id, merkleEntry.signerPrincipalId))
        .limit(1)
    : [];

  const ed25519PublicKey = principalRows[0]?.ed25519PublicKey ?? null;
  const summary = assessOpenContentProvenance({
    ...input,
    merkleEntry,
    signerPublicKey: ed25519PublicKey,
  });

  return {
    summary,
    verificationMode: input.verificationMode,
    canonicalContent:
      input.verificationMode === 'public-replayable' ? input.content : null,
    signedPayloadJws: input.signedPayloadJws.trim() || null,
    merkleEntry: merkleEntry
      ? {
          id: merkleEntry.id,
          prevEntryId: merkleEntry.prevEntryId,
          entrySeq: merkleEntry.entrySeq.toString(),
          entityKind: merkleEntry.entityKind,
          entityId: merkleEntry.entityId,
          contentHashHex: bytesToHex(merkleEntry.contentHash),
          signedJws: merkleEntry.signedJws,
          signerPrincipalId: merkleEntry.signerPrincipalId,
          appendedAt: merkleEntry.appendedAt.toISOString(),
        }
      : null,
    signer: merkleEntry
      ? {
          principalId: merkleEntry.signerPrincipalId,
          ed25519PublicKey,
          publicKeyFingerprint: fingerprintEd25519PublicKey(ed25519PublicKey),
        }
      : null,
    redactedFields: [...input.redactedFields],
  };
}

async function loadBundleSafely(
  load: () => Promise<OpenContentVerificationBundle>,
): Promise<OpenContentVerificationBundle> {
  try {
    return await load();
  } catch (error) {
    console.error('[open-content-provenance] failed to verify public record', error);
    return UNAVAILABLE_BUNDLE;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
