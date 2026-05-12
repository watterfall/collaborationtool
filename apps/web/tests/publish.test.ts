// Phase 6 W2 P2 — F4 publish flow service layer.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  contentHashHex,
} from '@collaborationtool/open-content';

import {
  validateContentForKind,
  validateOpenDatasetContent,
  validateOpenPeerReviewContent,
  validateOpenQuestionContent,
  validatePublish,
  validateShareSnapshotContent,
} from '@/lib/publish';

// Helper: build a valid PublishInput with sensible defaults; tests
// override specific fields to exercise reject paths.
function publishOk(content: unknown, kind: 'open_question' | 'open_dataset' | 'open_peer_review' | 'share_snapshot' = 'open_question') {
  return {
    kind,
    entityId: 'entity-1',
    content,
    contentHashHex: contentHashHex(content),
    signedJws: 'eyJ.sig.x',
    signerPrincipalId: 'principal:jili',
    prevMerkleEntryId: null,
    merkleEntryId: 'merkle-1',
    signatureVerifier: () => true,
  };
}

describe('validatePublish — happy path', () => {
  it('returns ok with merkleEntry payload', () => {
    const r = validatePublish(publishOk({ questionMd: '?', domainTags: [] }));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.payload.kind, 'open_question');
      assert.equal(r.payload.entityId, 'entity-1');
      assert.equal(r.payload.merkleEntry.id, 'merkle-1');
      assert.equal(r.payload.merkleEntry.signerPrincipalId, 'principal:jili');
    }
  });
});

describe('validatePublish — reject paths', () => {
  it('rejects invalid kind', () => {
    const r = validatePublish({ ...publishOk({ x: 1 }), kind: 'nope' as 'open_question' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid-kind');
  });

  it('rejects empty signed_jws', () => {
    const r = validatePublish({ ...publishOk({ x: 1 }), signedJws: '   ' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'empty-signed-jws');
  });

  it('rejects malformed content_hash_hex', () => {
    const r = validatePublish({ ...publishOk({ x: 1 }), contentHashHex: 'NOT_HEX' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid-content-hash-hex');
  });

  it('rejects content_hash mismatch (anti-replay)', () => {
    const c = { x: 1 };
    const r = validatePublish({
      ...publishOk(c),
      // claim hash of different payload
      contentHashHex: contentHashHex({ x: 2 }),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'content-hash-mismatch');
  });

  it('rejects when signature verifier returns false', () => {
    const r = validatePublish({
      ...publishOk({ x: 1 }),
      signatureVerifier: () => false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'signature-verify-failed');
  });

  it('rejects when signature verifier throws (catches)', () => {
    const r = validatePublish({
      ...publishOk({ x: 1 }),
      signatureVerifier: () => {
        throw new Error('jwks unreachable');
      },
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'signature-verify-threw');
  });

  it('rejects missing entityId', () => {
    const r = validatePublish({ ...publishOk({ x: 1 }), entityId: '' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'missing-entity-id');
  });

  it('rejects missing merkleEntryId', () => {
    const r = validatePublish({ ...publishOk({ x: 1 }), merkleEntryId: '' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'missing-merkle-entry-id');
  });

  it('rejects missing signer principal id', () => {
    const r = validatePublish({ ...publishOk({ x: 1 }), signerPrincipalId: '' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'missing-signer-principal-id');
  });
});

// ---------- Content shape validators ----------

describe('validateOpenQuestionContent', () => {
  it('accepts minimal valid shape', () => {
    const r = validateOpenQuestionContent({ questionMd: '?', domainTags: [] });
    assert.equal(r.ok, true);
  });

  it('rejects empty question_md', () => {
    const r = validateOpenQuestionContent({ questionMd: '   ', domainTags: [] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'question_md-empty');
  });

  it('rejects non-array domainTags', () => {
    const r = validateOpenQuestionContent({ questionMd: '?', domainTags: 'ai' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'domain_tags-not-array');
  });

  it('rejects non-string tag', () => {
    const r = validateOpenQuestionContent({ questionMd: '?', domainTags: [1, 'ai'] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'domain_tag-not-string');
  });
});

describe('validateOpenDatasetContent', () => {
  it('accepts minimal valid shape', () => {
    const r = validateOpenDatasetContent({
      title: 'My Dataset',
      descriptionMd: '...',
      blobStorageRef: 's3://b/x',
      sizeBytes: 1024,
      licenseSpdx: 'CC0-1.0',
    });
    assert.equal(r.ok, true);
  });

  it('rejects negative sizeBytes', () => {
    const r = validateOpenDatasetContent({
      title: 't', descriptionMd: 'd', blobStorageRef: 'r', sizeBytes: -1, licenseSpdx: 'X',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'size_bytes-invalid');
  });
});

describe('validateOpenPeerReviewContent', () => {
  it('accepts endorse with no evidence', () => {
    const r = validateOpenPeerReviewContent({
      reviewerOrcidId: '0000-0002-1825-0097',
      targetKind: 'question',
      targetId: 'q-1',
      verdict: 'endorses',
      bodyMd: 'I agree',
      evidenceRefs: [],
    });
    assert.equal(r.ok, true);
  });

  it('rejects challenges without evidence', () => {
    const r = validateOpenPeerReviewContent({
      reviewerOrcidId: '0000-0002-1825-0097',
      targetKind: 'snapshot',
      targetId: 'ss-1',
      verdict: 'challenges',
      bodyMd: 'I disagree',
      evidenceRefs: [],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'challenges-requires-evidence');
  });

  it('rejects missing reviewerOrcidId', () => {
    const r = validateOpenPeerReviewContent({
      reviewerOrcidId: '',
      targetKind: 'question', targetId: 'q', verdict: 'endorses', bodyMd: '.', evidenceRefs: [],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'reviewer_orcid_id-required');
  });
});

describe('validateShareSnapshotContent', () => {
  it('accepts minimal section snapshot', () => {
    const r = validateShareSnapshotContent({
      markdownContent: '# hi',
      yjsBinaryBase64: 'AAAA',
      kind: 'section',
      permalinkHash: 'a3f9b2',
    });
    assert.equal(r.ok, true);
  });

  it('rejects invalid kind', () => {
    const r = validateShareSnapshotContent({
      markdownContent: '', yjsBinaryBase64: 'A', kind: 'bogus', permalinkHash: 'x',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid-kind');
  });
});

describe('validateContentForKind dispatch', () => {
  it('dispatches to correct validator per kind', () => {
    assert.equal(validateContentForKind('open_question', { questionMd: '?', domainTags: [] }).ok, true);
    assert.equal(
      validateContentForKind('open_dataset', {
        title: 't', descriptionMd: 'd', blobStorageRef: 'r', sizeBytes: 0, licenseSpdx: 'X',
      }).ok,
      true,
    );
    assert.equal(
      validateContentForKind('open_peer_review', {
        reviewerOrcidId: '0', targetKind: 'question', targetId: 'q', verdict: 'endorses',
        bodyMd: '.', evidenceRefs: [],
      }).ok,
      true,
    );
    assert.equal(
      validateContentForKind('share_snapshot', {
        markdownContent: '', yjsBinaryBase64: 'A', kind: 'section', permalinkHash: 'h',
      }).ok,
      true,
    );
  });
});
