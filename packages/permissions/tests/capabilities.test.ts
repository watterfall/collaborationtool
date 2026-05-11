// Capability vocabulary integrity. ADR-0002 §2.1 originally said 36
// verbs; Phase 5 Wave B (ADR-0016) added 3 claim-review verbs → 39.
// This test guards against accidental drift (extras, dupes, typos).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AGENT_CAPABILITIES,
  ANNOTATION_CAPABILITIES,
  BLOCK_CAPABILITIES,
  CAPABILITIES,
  CAPABILITY_DOMAIN,
  CAPABILITY_META_CAPABILITIES,
  CAPABILITY_SET,
  CITATION_CAPABILITIES,
  CLAIM_REVIEW_CAPABILITIES,
  DOCUMENT_CAPABILITIES,
  PROVENANCE_CAPABILITIES,
  isCapability,
} from '../src/capabilities';

describe('capabilities vocabulary', () => {
  it('has exactly 39 entries (ADR-0002 §2.1 + ADR-0016 +3)', () => {
    assert.equal(CAPABILITIES.length, 39);
  });

  it('domain group sizes match ADR-0002 §2.1 + ADR-0016', () => {
    assert.equal(DOCUMENT_CAPABILITIES.length, 10);
    assert.equal(BLOCK_CAPABILITIES.length, 8);
    assert.equal(ANNOTATION_CAPABILITIES.length, 5);
    assert.equal(CITATION_CAPABILITIES.length, 4);
    assert.equal(AGENT_CAPABILITIES.length, 5);
    assert.equal(PROVENANCE_CAPABILITIES.length, 2);
    assert.equal(CAPABILITY_META_CAPABILITIES.length, 2);
    assert.equal(CLAIM_REVIEW_CAPABILITIES.length, 3);
  });

  it('every entry is unique', () => {
    assert.equal(new Set(CAPABILITIES).size, CAPABILITIES.length);
  });

  it('every entry follows `<resource>.<verb>[:<scope>]` shape', () => {
    const re = /^[a-z-]+\.[a-z-]+(:[a-z-]+)?$/;
    for (const c of CAPABILITIES) {
      assert.match(c, re, `capability ${c} doesn't match shape`);
    }
  });

  it('CAPABILITY_SET contains every verb', () => {
    for (const c of CAPABILITIES) assert.ok(CAPABILITY_SET.has(c));
  });

  it('isCapability narrows correctly', () => {
    assert.equal(isCapability('document.read'), true);
    assert.equal(isCapability('block.commit'), true);
    assert.equal(isCapability('agent.invoke:custom'), true);
    assert.equal(isCapability('document.read:metadata-only'), true);
    assert.equal(isCapability('not-a-real-verb'), false);
    assert.equal(isCapability(''), false);
    assert.equal(isCapability('document.read.extra'), false);
  });

  it('every capability has a domain mapping', () => {
    for (const c of CAPABILITIES) {
      assert.ok(CAPABILITY_DOMAIN[c], `${c} missing domain`);
    }
  });

  it('agent invoke verbs use scope suffix (not separate verbs)', () => {
    const invokes = AGENT_CAPABILITIES.filter((c) => c.startsWith('agent.invoke'));
    assert.equal(invokes.length, 4);
    for (const i of invokes) {
      assert.match(i, /^agent\.invoke:(editor|reviewer|citation|custom)$/);
    }
  });
});
