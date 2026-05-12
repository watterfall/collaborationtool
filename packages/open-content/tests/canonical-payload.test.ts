// Phase 6 W2 P2 — canonical JSON serialiser contract.
// Critical: any drift between client / server canonicaliser = signature
// verify fail = entire publish flow broken.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canonicalBytes,
  canonicaliseJson,
  contentHash,
  contentHashHex,
} from '../src/index';

describe('canonicaliseJson — sorted keys', () => {
  it('object key reorder produces identical output', () => {
    const a = { b: 1, a: 2, c: 3 };
    const b = { a: 2, b: 1, c: 3 };
    const c = { c: 3, b: 1, a: 2 };
    assert.equal(canonicaliseJson(a), canonicaliseJson(b));
    assert.equal(canonicaliseJson(b), canonicaliseJson(c));
    assert.equal(canonicaliseJson(a), '{"a":2,"b":1,"c":3}');
  });

  it('recursive sort — nested objects', () => {
    const v = { z: { y: 1, x: 2 }, a: { c: 3, b: 4 } };
    assert.equal(canonicaliseJson(v), '{"a":{"b":4,"c":3},"z":{"x":2,"y":1}}');
  });

  it('array order preserved (significant per JSON)', () => {
    assert.equal(canonicaliseJson([3, 1, 2]), '[3,1,2]');
    assert.notEqual(canonicaliseJson([3, 1, 2]), canonicaliseJson([1, 2, 3]));
  });

  it('omits undefined object values', () => {
    const v = { a: 1, b: undefined, c: 3 };
    assert.equal(canonicaliseJson(v), '{"a":1,"c":3}');
  });

  it('primitives — boolean / null / number / string', () => {
    assert.equal(canonicaliseJson(true), 'true');
    assert.equal(canonicaliseJson(false), 'false');
    assert.equal(canonicaliseJson(null), 'null');
    assert.equal(canonicaliseJson(0), '0');
    assert.equal(canonicaliseJson(-1.5), '-1.5');
    assert.equal(canonicaliseJson('hello'), '"hello"');
  });

  it('strings — escape chars', () => {
    assert.equal(canonicaliseJson('a\nb"c'), '"a\\nb\\"c"');
  });

  it('rejects non-finite numbers', () => {
    assert.throws(() => canonicaliseJson(Infinity), /non-finite/);
    assert.throws(() => canonicaliseJson(NaN), /non-finite/);
  });

  it('rejects undefined as top-level', () => {
    assert.throws(() => canonicaliseJson(undefined), /undefined/);
  });

  it('rejects function values', () => {
    assert.throws(() => canonicaliseJson(() => 1), /unsupported type function/);
  });
});

describe('canonicalBytes', () => {
  it('produces UTF-8 bytes of canonical JSON', () => {
    const v = { greeting: '你好' };
    const bytes = canonicalBytes(v);
    const decoded = new TextDecoder().decode(bytes);
    assert.equal(decoded, '{"greeting":"你好"}');
  });
});

describe('contentHash / contentHashHex', () => {
  it('contentHash returns 32 bytes (sha-256)', () => {
    const h = contentHash({ a: 1 });
    assert.equal(h.length, 32);
  });

  it('different objects yield different hashes', () => {
    const h1 = contentHash({ a: 1 });
    const h2 = contentHash({ a: 2 });
    assert.notDeepEqual(h1, h2);
  });

  it('semantically-equal objects yield identical hashes (sorted keys)', () => {
    const h1 = contentHash({ b: 2, a: 1 });
    const h2 = contentHash({ a: 1, b: 2 });
    assert.deepEqual(h1, h2);
  });

  it('contentHashHex returns 64 lowercase hex chars', () => {
    const hex = contentHashHex({ x: 1 });
    assert.equal(hex.length, 64);
    assert.match(hex, /^[0-9a-f]{64}$/);
  });

  it('empty object {} has stable hash', () => {
    // Sanity — empty object has a known sha-256
    // sha256('{}') = 44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a
    assert.equal(
      contentHashHex({}),
      '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
  });
});
