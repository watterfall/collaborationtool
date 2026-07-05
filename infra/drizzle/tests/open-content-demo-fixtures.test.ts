import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  verifyPublicProvenanceBundle,
  type PublicProvenanceVerificationBundle,
} from '@collaborationtool/open-content';

import {
  buildOpenContentDemoChain,
  DEMO_OPEN_QUESTION_ID,
  DEMO_OPEN_REVIEW_ID,
  DEMO_OPEN_SIGNER_PUBLIC_KEY,
  DEMO_REVIEWER_PUBLIC_KEY,
  type DemoOpenContentEntry,
} from '../src/open-content-demo-fixtures';

describe('open-content demo fixtures', () => {
  it('builds a stable question -> review -> dataset -> snapshot Merkle chain', () => {
    const chain = buildOpenContentDemoChain(null);

    assert.equal(chain.question.entityId, DEMO_OPEN_QUESTION_ID);
    assert.equal(chain.review.entityId, DEMO_OPEN_REVIEW_ID);
    assert.equal(chain.question.merkleEntry.prevEntryId, null);
    assert.equal(chain.review.merkleEntry.prevEntryId, chain.question.merkleEntryId);
    assert.equal(chain.dataset.merkleEntry.prevEntryId, chain.review.merkleEntryId);
    assert.equal(chain.snapshot.merkleEntry.prevEntryId, chain.dataset.merkleEntryId);
  });

  it('ships replayable public question and review signatures', () => {
    const chain = buildOpenContentDemoChain(null);

    const question = verifyPublicProvenanceBundle(
      replayableBundle(chain.question, DEMO_OPEN_SIGNER_PUBLIC_KEY),
      {
        expectedEntityKind: 'open_question',
        expectedEntityId: DEMO_OPEN_QUESTION_ID,
      },
    );
    const review = verifyPublicProvenanceBundle(
      replayableBundle(chain.review, DEMO_REVIEWER_PUBLIC_KEY),
      {
        expectedEntityKind: 'open_peer_review',
        expectedEntityId: DEMO_OPEN_REVIEW_ID,
      },
    );

    assert.equal(question.status, 'verified');
    assert.equal(question.independentlyVerified, true);
    assert.equal(review.status, 'verified');
    assert.equal(review.independentlyVerified, true);
  });
});

function replayableBundle(
  entry: DemoOpenContentEntry,
  publicKey: string,
): PublicProvenanceVerificationBundle {
  return {
    summary: { status: 'verified' },
    verificationMode: 'public-replayable',
    canonicalContent: entry.payload,
    signedPayloadJws: entry.signedJws,
    merkleEntry: {
      id: entry.merkleEntry.id,
      prevEntryId: entry.merkleEntry.prevEntryId,
      entrySeq: '1',
      entityKind: entry.merkleEntry.entityKind,
      entityId: entry.merkleEntry.entityId,
      contentHashHex: bytesToHex(entry.merkleEntry.contentHash),
      signedJws: entry.merkleEntry.signedJws,
      signerPrincipalId: entry.merkleEntry.signerPrincipalId,
      appendedAt: '2026-06-03T00:00:00.000Z',
    },
    signer: {
      principalId: entry.merkleEntry.signerPrincipalId,
      ed25519PublicKey: publicKey,
      publicKeyFingerprint: null,
    },
    redactedFields: [],
  };
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
