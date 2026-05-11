// Wave D-3 — Unit tests for CrossLayerReference (ADR-0020 §2.3).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createCrossLayerReference,
  validateCrossLayerReference,
  countReferencesByMode,
  type CrossLayerReference,
} from '../src/cross-layer-reference';

const baseRef = {
  id: 'edge:1',
  recordedBy: 'principal:jili',
  recordedAt: '2026-05-12T00:00:00Z',
};

describe('CrossLayerReference (ADR-0020 §2.3)', () => {
  it('createCrossLayerReference returns input verbatim', () => {
    const ref = createCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'night:m:1',
      fromLayer: 'night',
      toArtifactId: 'day:claim:1',
      toLayer: 'day',
      mode: 'metaphor-bridge',
    });
    assert.equal(ref.mode, 'metaphor-bridge');
    assert.equal(ref.fromLayer, 'night');
    assert.equal(ref.toLayer, 'day');
  });

  it('round-trips through JSON unchanged', () => {
    const ref = createCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'bridge:hf:1',
      fromLayer: 'bridge',
      toArtifactId: 'day:claim:1',
      toLayer: 'day',
      mode: 'hypothesis-output',
      note: 'formalized P granule droplet metaphor',
    });
    const json = JSON.stringify(ref);
    const parsed: CrossLayerReference = JSON.parse(json);
    assert.deepEqual(parsed, ref);
  });
});

describe('validateCrossLayerReference (anti-bug per Wave D-3 contract)', () => {
  it('accepts canonical direction (night → day for metaphor-bridge)', () => {
    const r = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'night:m:1',
      fromLayer: 'night',
      toArtifactId: 'day:claim:1',
      toLayer: 'day',
      mode: 'metaphor-bridge',
    });
    assert.equal(r.valid, true);
  });

  it('accepts reverse direction (day → night for metaphor-bridge)', () => {
    // Reverse is allowed because the same edge may be recorded from
    // either end's perspective. Tests Wave D-3 contract intent.
    const r = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'day:claim:1',
      fromLayer: 'day',
      toArtifactId: 'night:m:1',
      toLayer: 'night',
      mode: 'metaphor-bridge',
    });
    assert.equal(r.valid, true);
  });

  it('rejects same-layer edges (night → night)', () => {
    const r = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'night:m:1',
      fromLayer: 'night',
      toArtifactId: 'night:m:2',
      toLayer: 'night',
      mode: 'metaphor-bridge',
    });
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /cross-layer-required/);
  });

  it('rejects bridge → bridge edges', () => {
    const r = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'bridge:cp:1',
      fromLayer: 'bridge',
      toArtifactId: 'bridge:hf:1',
      toLayer: 'bridge',
      mode: 'hypothesis-output',
    });
    assert.equal(r.valid, false);
  });

  it('rejects wrong direction (bridge → bridge with anomaly-input)', () => {
    const r = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'night:m:1',
      fromLayer: 'night',
      toArtifactId: 'bridge:hf:1',
      toLayer: 'bridge',
      mode: 'anomaly-input', // canonical day→night, not night→bridge
    });
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /canonical direction/);
  });

  it('accepts any cross-layer pair for method-transfer (bidirectional)', () => {
    // day → night
    const r1 = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'day:method:1',
      fromLayer: 'day',
      toArtifactId: 'night:t:1',
      toLayer: 'night',
      mode: 'method-transfer',
    });
    assert.equal(r1.valid, true);
    // night → bridge
    const r2 = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'night:t:1',
      fromLayer: 'night',
      toArtifactId: 'bridge:cp:1',
      toLayer: 'bridge',
      mode: 'method-transfer',
    });
    assert.equal(r2.valid, true);
    // bridge → day
    const r3 = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'bridge:cp:1',
      fromLayer: 'bridge',
      toArtifactId: 'day:code:1',
      toLayer: 'day',
      mode: 'method-transfer',
    });
    assert.equal(r3.valid, true);
  });

  it('still rejects same-layer for method-transfer', () => {
    const r = validateCrossLayerReference({
      ...baseRef,
      fromArtifactId: 'night:t:1',
      fromLayer: 'night',
      toArtifactId: 'night:t:2',
      toLayer: 'night',
      mode: 'method-transfer',
    });
    assert.equal(r.valid, false);
  });
});

describe('countReferencesByMode (dogfood metric)', () => {
  it('counts modes correctly across mixed refs', () => {
    const refs: CrossLayerReference[] = [
      {
        ...baseRef,
        id: 'e1',
        fromArtifactId: 'night:m:1',
        fromLayer: 'night',
        toArtifactId: 'day:c:1',
        toLayer: 'day',
        mode: 'metaphor-bridge',
      },
      {
        ...baseRef,
        id: 'e2',
        fromArtifactId: 'night:m:2',
        fromLayer: 'night',
        toArtifactId: 'day:c:2',
        toLayer: 'day',
        mode: 'metaphor-bridge',
      },
      {
        ...baseRef,
        id: 'e3',
        fromArtifactId: 'day:c:1',
        fromLayer: 'day',
        toArtifactId: 'night:q:1',
        toLayer: 'night',
        mode: 'question-return',
      },
    ];
    const counts = countReferencesByMode(refs);
    assert.equal(counts.get('metaphor-bridge'), 2);
    assert.equal(counts.get('question-return'), 1);
    assert.equal(counts.get('anomaly-input'), undefined);
  });

  it('empty input yields empty map', () => {
    const counts = countReferencesByMode([]);
    assert.equal(counts.size, 0);
  });
});
