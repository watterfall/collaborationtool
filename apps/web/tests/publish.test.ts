// Phase 6 W2 P2 — F4 publish flow service layer.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalBytes,
  contentHash,
  contentHashHex,
} from '@collaborationtool/open-content';
import { generateKeypair, sign, toHex } from '@collaborationtool/identity';

import {
  allowOpenContentDevSignatureFallback,
  buildOpenContentSignatureVerifier,
  normalizeEd25519PublicKeyText,
  parseEd25519PublicKey,
  parseEd25519Signature,
  signatureRejectDetail,
} from '@/lib/open-content-signature';
import { assessOpenContentProvenance } from '@/lib/open-content-provenance';
import {
  validateContentForKind,
  validateOpenDatasetContent,
  validateOpenPeerReviewContent,
  validateOpenQuestionContent,
  validatePublish,
  validateShareSnapshotContent,
} from '@/lib/publish';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const repoWebSrc = path.resolve(__dirname, '../src');

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

describe('open content Ed25519 signature verifier', () => {
  it('verifies a detached signature over canonical open-content payload bytes', () => {
    const kp = generateKeypair();
    const payload = { questionMd: '# Can this replicate?', domainTags: ['methods'] };
    const signatureHex = toHex(sign(canonicalBytes(payload), kp.secretKey));

    const verifier = buildOpenContentSignatureVerifier({
      scope: 'test',
      publicKey: `ed25519:${toHex(kp.publicKey)}`,
      allowDevFallback: false,
    });

    assert.equal(verifier(signatureHex, payload), true);
    assert.equal(
      verifier(signatureHex, { questionMd: '# Tampered?', domainTags: ['methods'] }),
      false,
    );
  });

  it('rejects malformed provided public keys instead of falling back', () => {
    const verifier = buildOpenContentSignatureVerifier({
      scope: 'test',
      publicKey: 'ed25519:not-hex',
      allowDevFallback: true,
    });
    assert.equal(verifier('sig', { x: 1 }), false);
  });

  it('rejects a valid signature when no public key is on file and dev fallback is off (strict)', () => {
    // 缺 key 即拒：even a genuinely-signed payload cannot be accepted
    // without a key to verify it against. This is the strict-verify path
    // that guards every non-dev environment (prod + default self-host).
    const kp = generateKeypair();
    const payload = { questionMd: '# Real signature, no key on file', domainTags: ['methods'] };
    const signatureHex = toHex(sign(canonicalBytes(payload), kp.secretKey));

    const verifier = buildOpenContentSignatureVerifier({
      scope: 'test',
      publicKey: null,
      allowDevFallback: false,
    });
    assert.equal(verifier(signatureHex, payload), false);
  });

  it('skips verification only when no key is present AND dev fallback is explicitly on', () => {
    const verifier = buildOpenContentSignatureVerifier({
      scope: 'test',
      publicKey: null,
      allowDevFallback: true,
    });
    // Dev escape hatch: no key + opted-in fallback accepts an unverified sig.
    assert.equal(verifier('anything', { x: 1 }), true);
  });

  it('allowOpenContentDevSignatureFallback: off by default, opt-in only, never in production', () => {
    const savedNodeEnv = process.env['NODE_ENV'];
    const savedFlag = process.env['OPEN_CONTENT_DEV_SIGNATURE_FALLBACK'];
    const restore = (key: string, val: string | undefined) => {
      if (val === undefined) Reflect.deleteProperty(process.env, key);
      else Object.assign(process.env, { [key]: val });
    };
    try {
      // Non-production, flag unset → strict (no skip).
      Object.assign(process.env, { NODE_ENV: 'development' });
      Reflect.deleteProperty(process.env, 'OPEN_CONTENT_DEV_SIGNATURE_FALLBACK');
      assert.equal(allowOpenContentDevSignatureFallback(), false);

      // Non-production + explicit opt-in → skip allowed.
      Object.assign(process.env, { OPEN_CONTENT_DEV_SIGNATURE_FALLBACK: '1' });
      assert.equal(allowOpenContentDevSignatureFallback(), true);

      // Production ignores the flag entirely.
      Object.assign(process.env, { NODE_ENV: 'production' });
      assert.equal(allowOpenContentDevSignatureFallback(), false);
    } finally {
      restore('NODE_ENV', savedNodeEnv);
      restore('OPEN_CONTENT_DEV_SIGNATURE_FALLBACK', savedFlag);
    }
  });

  it('signatureRejectDetail returns a bilingual detail for signature reasons only', () => {
    const failed = signatureRejectDetail('signature-verify-failed');
    assert.ok(failed && /Ed25519/.test(failed) && /公钥/.test(failed));
    const threw = signatureRejectDetail('signature-verify-threw');
    assert.ok(threw && /签名验证/.test(threw));
    // Non-signature reasons carry no detail (route omits the field).
    assert.equal(signatureRejectDetail('invalid-kind'), null);
    assert.equal(signatureRejectDetail('content-hash-mismatch'), null);
  });

  it('parses strict public keys and raw signatures only', () => {
    const kp = generateKeypair();
    const payload = { x: 1 };
    const signature = sign(canonicalBytes(payload), kp.secretKey);

    assert.notEqual(parseEd25519PublicKey(`ed25519:${toHex(kp.publicKey)}`), null);
    assert.notEqual(parseEd25519Signature(toHex(signature)), null);
    assert.notEqual(
      parseEd25519Signature(Buffer.from(signature).toString('base64url')),
      null,
    );
    assert.equal(parseEd25519Signature('eyJ.not-a-raw-signature.jwt'), null);
  });

  it('normalizes Ed25519 public key text for principal storage', () => {
    const kp = generateKeypair();
    const hex = toHex(kp.publicKey);

    assert.equal(normalizeEd25519PublicKeyText(hex), `ed25519:${hex}`);
    assert.equal(
      normalizeEd25519PublicKeyText(`ED25519:${hex.toUpperCase()}`),
      `ed25519:${hex}`,
    );
    assert.equal(normalizeEd25519PublicKeyText('ed25519:not-hex'), null);
  });
});

describe('open content principal key persistence contract', () => {
  it('adds a nullable unique Ed25519 public key column to principal', () => {
    const schemaSrc = readFileSync(
      path.join(repoRoot, 'infra/drizzle/src/schema.ts'),
      'utf8',
    );
    const migrationSrc = readFileSync(
      path.join(
        repoRoot,
        'infra/drizzle/migrations/0017_principal_ed25519_public_key.sql',
      ),
      'utf8',
    );

    assert.match(schemaSrc, /ed25519PublicKey: text\('ed25519_public_key'\)/);
    assert.match(schemaSrc, /principal_ed25519_public_key_uniq/);
    assert.match(migrationSrc, /ADD COLUMN "ed25519_public_key" text/);
    assert.match(migrationSrc, /CREATE UNIQUE INDEX "principal_ed25519_public_key_uniq"/);
  });

  it('generic publish route verifies and persists through the principal key store', () => {
    const routeSrc = readFileSync(
      path.join(repoWebSrc, 'app/api/publish/route.ts'),
      'utf8',
    );
    const storeSrc = readFileSync(
      path.join(repoWebSrc, 'lib/open-content-signature-store.ts'),
      'utf8',
    );
    const signatureSrc = readFileSync(
      path.join(repoWebSrc, 'lib/open-content-signature.ts'),
      'utf8',
    );

    assert.match(routeSrc, /buildPrincipalOpenContentSignatureVerifier/);
    assert.match(routeSrc, /persistPrincipalEd25519PublicKeyIfNeeded/);
    assert.doesNotMatch(routeSrc, /buildOpenContentSignatureVerifier/);
    assert.match(storeSrc, /schema\.principal\.ed25519PublicKey/);
    assert.match(storeSrc, /submittedPublicKey !== storedPublicKey/);
    assert.match(storeSrc, /isNull\(schema\.principal\.ed25519PublicKey\)/);
    // Dev-fallback gate is production-aware AND opt-in only (缺 key 默认拒).
    assert.match(signatureSrc, /process\.env\['NODE_ENV'\] !== 'production'/);
    assert.match(signatureSrc, /OPEN_CONTENT_DEV_SIGNATURE_FALLBACK/);
  });
});

describe('open content public provenance assessment', () => {
  it('verifies Merkle identity, content hash and Ed25519 signature', () => {
    const kp = generateKeypair();
    const payload = { questionMd: '# Can this replicate?', domainTags: ['methods'] };
    const signedPayloadJws = toHex(sign(canonicalBytes(payload), kp.secretKey));

    const summary = assessOpenContentProvenance({
      kind: 'open_question',
      entityId: 'question-1',
      content: payload,
      signedPayloadJws,
      merkleLogEntryId: 'merkle-1',
      merkleEntry: {
        id: 'merkle-1',
        entityKind: 'open_question',
        entityId: 'question-1',
        contentHash: contentHash(payload),
        signedJws: signedPayloadJws,
        signerPrincipalId: 'principal:user-1',
      },
      signerPublicKey: `ed25519:${toHex(kp.publicKey)}`,
    });

    assert.equal(summary.status, 'verified');
    assert.equal(summary.signatureAlgorithm, 'Ed25519');
    assert.equal(summary.contentHashHex, contentHashHex(payload));
    assert.equal(summary.publicKeyFingerprint?.startsWith('ed25519:'), true);
  });

  it('distinguishes missing keys, hash drift and signature failure', () => {
    const kp = generateKeypair();
    const other = generateKeypair();
    const payload = { questionMd: '# Can this replicate?', domainTags: ['methods'] };
    const signedPayloadJws = toHex(sign(canonicalBytes(payload), kp.secretKey));
    const merkleEntry = {
      id: 'merkle-1',
      entityKind: 'open_question',
      entityId: 'question-1',
      contentHash: contentHash(payload),
      signedJws: signedPayloadJws,
      signerPrincipalId: 'principal:user-1',
    };

    assert.equal(
      assessOpenContentProvenance({
        kind: 'open_question',
        entityId: 'question-1',
        content: payload,
        signedPayloadJws,
        merkleLogEntryId: 'merkle-1',
        merkleEntry,
        signerPublicKey: null,
      }).status,
      'missing-public-key',
    );
    assert.equal(
      assessOpenContentProvenance({
        kind: 'open_question',
        entityId: 'question-1',
        content: { ...payload, questionMd: '# Tampered' },
        signedPayloadJws,
        merkleLogEntryId: 'merkle-1',
        merkleEntry,
        signerPublicKey: `ed25519:${toHex(kp.publicKey)}`,
      }).status,
      'hash-mismatch',
    );
    assert.equal(
      assessOpenContentProvenance({
        kind: 'open_question',
        entityId: 'question-1',
        content: payload,
        signedPayloadJws,
        merkleLogEntryId: 'merkle-1',
        merkleEntry,
        signerPublicKey: `ed25519:${toHex(other.publicKey)}`,
      }).status,
      'invalid-signature',
    );
  });

  it('verifies open peer review payloads as first-class public records', () => {
    const kp = generateKeypair();
    const payload = {
      reviewerOrcidId: '0000-0002-1825-0097',
      targetKind: 'question',
      targetId: 'question-1',
      verdict: 'refines',
      bodyMd: 'The protocol needs one more exclusion criterion.',
      evidenceRefs: ['doi:10.1234/example'],
    };
    const signedPayloadJws = toHex(sign(canonicalBytes(payload), kp.secretKey));

    const summary = assessOpenContentProvenance({
      kind: 'open_peer_review',
      entityId: 'review-1',
      content: payload,
      signedPayloadJws,
      merkleLogEntryId: 'merkle-review-1',
      merkleEntry: {
        id: 'merkle-review-1',
        entityKind: 'open_peer_review',
        entityId: 'review-1',
        contentHash: contentHash(payload),
        signedJws: signedPayloadJws,
        signerPrincipalId: 'principal:reviewer-1',
      },
      signerPublicKey: `ed25519:${toHex(kp.publicKey)}`,
    });

    assert.equal(summary.status, 'verified');
    assert.equal(summary.contentHashHex, contentHashHex(payload));
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

  it('rejects invalid kind instead of returning undefined', () => {
    const r = validateContentForKind('not-a-kind', { questionMd: '?', domainTags: [] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid-kind');
  });
});
