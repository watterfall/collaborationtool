// Phase 6 W2 — ORCID link payload canonicalisation.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assembleOrcidLink,
  buildOrcidLinkPayload,
  canonicaliseOrcidLinkPayload,
  generateKeypair,
  isOrcidIdShape,
  toHex,
} from '../src/index';

describe('buildOrcidLinkPayload', () => {
  it('produces canonical { publicKey, orcidId, issuedAt }', () => {
    const kp = generateKeypair();
    const p = buildOrcidLinkPayload({
      publicKey: kp.publicKey,
      orcidId: '0000-0002-1825-0097',
      issuedAt: '2026-05-12T00:00:00Z',
    });
    assert.equal(p.publicKey, `ed25519:${toHex(kp.publicKey)}`);
    assert.equal(p.orcidId, '0000-0002-1825-0097');
    assert.equal(p.issuedAt, '2026-05-12T00:00:00Z');
  });
});

describe('canonicaliseOrcidLinkPayload', () => {
  it('produces deterministic bytes for same input', () => {
    const kp = generateKeypair();
    const p = buildOrcidLinkPayload({
      publicKey: kp.publicKey,
      orcidId: '0000-0002-1825-0097',
      issuedAt: '2026-05-12T00:00:00Z',
    });
    const a = canonicaliseOrcidLinkPayload(p);
    const b = canonicaliseOrcidLinkPayload(p);
    assert.deepEqual(a, b);
  });

  it('field-reorder client object yields same bytes (defensive re-build)', () => {
    const kp = generateKeypair();
    const p1 = {
      publicKey: `ed25519:${toHex(kp.publicKey)}`,
      orcidId: '0000-0002-1825-0097',
      issuedAt: '2026-05-12T00:00:00Z',
    };
    // Caller might construct the object in different key order; the
    // canonicaliser must produce identical bytes.
    const p2 = {
      orcidId: p1.orcidId,
      issuedAt: p1.issuedAt,
      publicKey: p1.publicKey,
    } as typeof p1;
    const a = canonicaliseOrcidLinkPayload(p1);
    const b = canonicaliseOrcidLinkPayload(p2);
    assert.deepEqual(a, b);
  });
});

describe('assembleOrcidLink', () => {
  it('builds OrcidLink from payload + signed JWS', () => {
    const kp = generateKeypair();
    const payload = buildOrcidLinkPayload({
      publicKey: kp.publicKey,
      orcidId: '0000-0002-1825-0097',
      issuedAt: '2026-05-12T00:00:00Z',
    });
    const link = assembleOrcidLink({ payload, signedJws: 'eyJ.x.y' });
    assert.equal(link.publicKey, payload.publicKey);
    assert.equal(link.orcidId, payload.orcidId);
    assert.equal(link.signedJws, 'eyJ.x.y');
    assert.equal(link.linkedAt, payload.issuedAt);
  });
});

describe('isOrcidIdShape', () => {
  it('accepts valid ORCID iD shapes', () => {
    assert.equal(isOrcidIdShape('0000-0002-1825-0097'), true);
    assert.equal(isOrcidIdShape('0000-0001-2345-678X'), true);
  });

  it('rejects malformed strings', () => {
    assert.equal(isOrcidIdShape('not-an-orcid'), false);
    assert.equal(isOrcidIdShape('0000000218250097'), false); // no dashes
    assert.equal(isOrcidIdShape('0000-0002-1825-009'), false); // 3 chars in last group
    assert.equal(isOrcidIdShape(''), false);
    assert.equal(isOrcidIdShape(null), false);
    assert.equal(isOrcidIdShape(undefined), false);
    assert.equal(isOrcidIdShape(42), false);
  });
});
