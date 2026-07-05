import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateKeypair, sign, toHex } from '@collaborationtool/identity';

import {
  canonicalBytes,
  contentHashHex,
  verifyPublicProvenanceBundle,
  verifyPublicProvenanceResponse,
  type PublicProvenanceApiResponse,
  type PublicProvenanceVerificationBundle,
} from '../src/index';

const payload = {
  questionMd: 'Can this replication protocol survive a new cohort?',
  domainTags: ['replication', 'methods'],
};

describe('public provenance verifier', () => {
  it('independently verifies a public replayable bundle', () => {
    const bundle = replayableBundle('open_question', 'q-1', payload);
    const result = verifyPublicProvenanceBundle(bundle, {
      expectedEntityKind: 'open_question',
      expectedEntityId: 'q-1',
    });

    assert.equal(result.status, 'verified');
    assert.equal(result.independentlyVerified, true);
    assert.deepEqual(result.failures, []);
    assert.equal(result.computedContentHashHex, contentHashHex(payload));
  });

  it('detects canonical content tampering', () => {
    const bundle = replayableBundle('open_question', 'q-1', payload);
    const result = verifyPublicProvenanceBundle({
      ...bundle,
      canonicalContent: { ...payload, questionMd: 'Changed after signing.' },
    });

    assert.equal(result.status, 'invalid');
    assert.equal(result.independentlyVerified, false);
    assert.ok(result.failures.some((failure) => /content hash mismatch/.test(failure)));
    assert.ok(
      result.failures.some((failure) => /signature verification failed/.test(failure)),
    );
  });

  it('marks redacted dataset bundles as server-summary-only without leaking content', () => {
    const bundle = serverSummaryOnlyBundle('open_dataset', 'ds-1', [
      'blobStorageRef',
    ]);
    const result = verifyPublicProvenanceBundle(bundle, {
      expectedEntityKind: 'open_dataset',
      expectedEntityId: 'ds-1',
    });

    assert.equal(result.status, 'server-summary-only');
    assert.equal(result.independentlyVerified, false);
    assert.deepEqual(result.failures, []);
  });

  it('rejects server-summary-only bundles that expose canonical content', () => {
    const bundle = serverSummaryOnlyBundle('open_dataset', 'ds-1', [
      'blobStorageRef',
    ]);
    const result = verifyPublicProvenanceBundle({
      ...bundle,
      canonicalContent: { blobStorageRef: 's3://private/archive.csv' },
    });

    assert.equal(result.status, 'invalid');
    assert.ok(
      result.failures.some((failure) =>
        /server-summary-only bundle exposes canonicalContent/.test(failure),
      ),
    );
  });

  it('summarizes a public provenance response with review verification', () => {
    const record = replayableBundle('open_question', 'q-1', payload);
    const reviewPayload = {
      reviewerOrcidId: '0000-0002-1825-0097',
      targetKind: 'question',
      targetId: 'q-1',
      verdict: 'endorses',
      bodyMd: 'The cohort split and preprocessing notes are sufficient.',
      evidenceRefs: ['doi:10.5281/zenodo.1234567'],
    };
    const response: PublicProvenanceApiResponse = {
      kind: 'open_question',
      id: 'q-1',
      record,
      reviews: [
        {
          id: 'review-1',
          reviewerOrcidId: '0000-0002-1825-0097',
          verdict: 'endorses',
          provenance: replayableBundle(
            'open_peer_review',
            'review-1',
            reviewPayload,
          ),
        },
      ],
    };

    const result = verifyPublicProvenanceResponse(response);

    assert.equal(result.status, 'verified');
    assert.equal(result.independentlyVerified, true);
    assert.deepEqual(result.failures, []);
    assert.equal(result.reviews[0]!.provenance.status, 'verified');
  });

  it('reports mixed public and redacted responses as partially verified', () => {
    const response: PublicProvenanceApiResponse = {
      kind: 'share_snapshot',
      id: 'snapshot-permalink',
      record: serverSummaryOnlyBundle('share_snapshot', 'snapshot-row-1', [
        'yjsBinaryBase64',
      ]),
      reviews: [
        {
          id: 'review-1',
          reviewerOrcidId: '0000-0002-1825-0097',
          verdict: 'refines',
          provenance: replayableBundle('open_peer_review', 'review-1', {
            reviewerOrcidId: '0000-0002-1825-0097',
            targetKind: 'snapshot',
            targetId: 'snapshot-row-1',
            verdict: 'refines',
            bodyMd: 'Clarify the exclusion rule.',
            evidenceRefs: [],
          }),
        },
      ],
    };

    const result = verifyPublicProvenanceResponse(response);

    assert.equal(result.status, 'partially-verified');
    assert.equal(result.independentlyVerified, false);
    assert.deepEqual(result.failures, []);
    assert.equal(result.record.status, 'server-summary-only');
  });
});

function replayableBundle(
  entityKind: string,
  entityId: string,
  canonicalContent: unknown,
): PublicProvenanceVerificationBundle {
  const keypair = generateKeypair();
  const signature = sign(canonicalBytes(canonicalContent), keypair.secretKey);
  const signedPayloadJws = base64Url(signature);
  const hash = contentHashHex(canonicalContent);
  return {
    summary: {
      status: 'verified',
    },
    verificationMode: 'public-replayable',
    canonicalContent,
    signedPayloadJws,
    merkleEntry: {
      id: `merkle-${entityId}`,
      prevEntryId: null,
      entrySeq: '1',
      entityKind,
      entityId,
      contentHashHex: hash,
      signedJws: signedPayloadJws,
      signerPrincipalId: `principal-${entityId}`,
      appendedAt: '2026-06-03T00:00:00.000Z',
    },
    signer: {
      principalId: `principal-${entityId}`,
      ed25519PublicKey: `ed25519:${toHex(keypair.publicKey)}`,
      publicKeyFingerprint: null,
    },
    redactedFields: [],
  };
}

function serverSummaryOnlyBundle(
  entityKind: string,
  entityId: string,
  redactedFields: string[],
): PublicProvenanceVerificationBundle {
  return {
    summary: {
      status: 'verified',
    },
    verificationMode: 'server-summary-only',
    canonicalContent: null,
    signedPayloadJws: 'detached-signature-redacted',
    merkleEntry: {
      id: `merkle-${entityId}`,
      prevEntryId: null,
      entrySeq: '1',
      entityKind,
      entityId,
      contentHashHex:
        '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
      signedJws: 'detached-signature-redacted',
      signerPrincipalId: `principal-${entityId}`,
      appendedAt: '2026-06-03T00:00:00.000Z',
    },
    signer: {
      principalId: `principal-${entityId}`,
      ed25519PublicKey: null,
      publicKeyFingerprint: null,
    },
    redactedFields,
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
