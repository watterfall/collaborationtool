// Wave D-1 — Unit tests for the 5 创意触发模式 taxonomy (ADR-0020 §2.2).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MODE_TAGS,
  MAX_TAGS_PER_ARTIFACT,
  MODE_TAG_LABELS_ZH,
  MODE_TAG_LABELS_EN,
  isModeTag,
  parseModeTag,
  validateModeTags,
} from '../src/mode-tag';

describe('ModeTag taxonomy (ADR-0020 §2.2 — 5 创意触发模式)', () => {
  it('has exactly 5 mode tags', () => {
    assert.equal(MODE_TAGS.length, 5);
  });

  it('contains the 5 jili-defined modes', () => {
    assert.deepEqual(
      [...MODE_TAGS].sort(),
      ['contradiction', 'cross-domain', 'metaphor', 'reframe', 'thought-experiment'],
    );
  });

  it('isModeTag returns true for valid tags', () => {
    for (const tag of MODE_TAGS) {
      assert.equal(isModeTag(tag), true, `expected ${tag} to validate`);
    }
  });

  it('isModeTag rejects invalid values', () => {
    assert.equal(isModeTag('not-a-mode'), false);
    assert.equal(isModeTag(null), false);
    assert.equal(isModeTag(42), false);
    assert.equal(isModeTag(''), false);
    assert.equal(isModeTag(undefined), false);
  });

  it('parseModeTag returns tag for valid input, null otherwise', () => {
    assert.equal(parseModeTag('metaphor'), 'metaphor');
    assert.equal(parseModeTag('contradiction'), 'contradiction');
    assert.equal(parseModeTag('nonsense'), null);
  });

  it('every mode has both zh and en label', () => {
    for (const tag of MODE_TAGS) {
      assert.ok(MODE_TAG_LABELS_ZH[tag], `missing zh label for ${tag}`);
      assert.ok(MODE_TAG_LABELS_EN[tag], `missing en label for ${tag}`);
    }
  });
});

describe('validateModeTags (anti-abuse per R-T5)', () => {
  it('accepts empty array', () => {
    const r = validateModeTags([]);
    assert.equal(r.valid, true);
    if (r.valid) assert.deepEqual(r.tags, []);
  });

  it('accepts up to MAX_TAGS_PER_ARTIFACT tags', () => {
    const r = validateModeTags(['metaphor', 'contradiction', 'reframe']);
    assert.equal(r.valid, true);
    if (r.valid) assert.equal(r.tags.length, 3);
  });

  it('rejects more than MAX_TAGS_PER_ARTIFACT tags', () => {
    const r = validateModeTags([
      'metaphor',
      'contradiction',
      'reframe',
      'cross-domain',
    ]);
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /too-many-tags/);
  });

  it('rejects invalid tag strings', () => {
    const r = validateModeTags(['metaphor', 'nonsense']);
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /invalid-mode-tag/);
  });

  it('rejects duplicate tags', () => {
    const r = validateModeTags(['metaphor', 'metaphor']);
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /duplicate-tag/);
  });

  it('returns parsed typed tags on success', () => {
    const r = validateModeTags(['metaphor', 'contradiction']);
    assert.equal(r.valid, true);
    if (r.valid) assert.deepEqual(r.tags, ['metaphor', 'contradiction']);
  });

  it('respects custom maxTags override', () => {
    const r = validateModeTags(['metaphor', 'contradiction'], 1);
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /max 1/);
  });

  it('MAX_TAGS_PER_ARTIFACT default is 3', () => {
    assert.equal(MAX_TAGS_PER_ARTIFACT, 3);
  });
});
