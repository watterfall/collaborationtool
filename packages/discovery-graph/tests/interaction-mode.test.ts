// Wave D-3 — Unit tests for the 6 InteractionMode taxonomy (ADR-0020 §2.3).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  INTERACTION_MODES,
  INTERACTION_MODE_CANONICAL_FROM,
  INTERACTION_MODE_CANONICAL_TO,
  INTERACTION_MODE_LABELS_ZH,
  INTERACTION_MODE_LABELS_EN,
  isInteractionMode,
  parseInteractionMode,
} from '../src/interaction-mode';

describe('InteractionMode taxonomy (ADR-0020 §2.3 — 6 交互模式)', () => {
  it('has exactly 6 modes', () => {
    assert.equal(INTERACTION_MODES.length, 6);
  });

  it('contains the 6 jili-defined modes', () => {
    assert.deepEqual(
      [...INTERACTION_MODES].sort(),
      [
        'anomaly-input',
        'constraint-transfer',
        'hypothesis-output',
        'metaphor-bridge',
        'method-transfer',
        'question-return',
      ],
    );
  });

  it('isInteractionMode validates 6 modes', () => {
    for (const m of INTERACTION_MODES) {
      assert.equal(isInteractionMode(m), true);
    }
    assert.equal(isInteractionMode('thought'), false);
    assert.equal(isInteractionMode(null), false);
    assert.equal(isInteractionMode(undefined), false);
    assert.equal(isInteractionMode(''), false);
  });

  it('parseInteractionMode returns mode or null', () => {
    assert.equal(parseInteractionMode('hypothesis-output'), 'hypothesis-output');
    assert.equal(parseInteractionMode('method-transfer'), 'method-transfer');
    assert.equal(parseInteractionMode('nonsense'), null);
  });

  it('directional modes have canonical from/to layers', () => {
    assert.equal(INTERACTION_MODE_CANONICAL_FROM['hypothesis-output'], 'night');
    assert.equal(INTERACTION_MODE_CANONICAL_TO['hypothesis-output'], 'day');

    assert.equal(INTERACTION_MODE_CANONICAL_FROM['anomaly-input'], 'day');
    assert.equal(INTERACTION_MODE_CANONICAL_TO['anomaly-input'], 'night');

    assert.equal(INTERACTION_MODE_CANONICAL_FROM['constraint-transfer'], 'day');
    assert.equal(INTERACTION_MODE_CANONICAL_TO['constraint-transfer'], 'night');

    assert.equal(INTERACTION_MODE_CANONICAL_FROM['metaphor-bridge'], 'night');
    assert.equal(INTERACTION_MODE_CANONICAL_TO['metaphor-bridge'], 'day');

    assert.equal(INTERACTION_MODE_CANONICAL_FROM['question-return'], 'day');
    assert.equal(INTERACTION_MODE_CANONICAL_TO['question-return'], 'night');
  });

  it('method-transfer is bidirectional (canonical from/to are undefined)', () => {
    assert.equal(INTERACTION_MODE_CANONICAL_FROM['method-transfer'], undefined);
    assert.equal(INTERACTION_MODE_CANONICAL_TO['method-transfer'], undefined);
  });

  it('every mode has both zh and en label', () => {
    for (const m of INTERACTION_MODES) {
      assert.ok(INTERACTION_MODE_LABELS_ZH[m], `missing zh for ${m}`);
      assert.ok(INTERACTION_MODE_LABELS_EN[m], `missing en for ${m}`);
    }
  });

  it('all directional modes have non-equal from/to (cross-layer by definition)', () => {
    for (const m of INTERACTION_MODES) {
      const from = INTERACTION_MODE_CANONICAL_FROM[m];
      const to = INTERACTION_MODE_CANONICAL_TO[m];
      if (from !== undefined && to !== undefined) {
        assert.notEqual(from, to, `mode ${m} from === to`);
      }
    }
  });
});
