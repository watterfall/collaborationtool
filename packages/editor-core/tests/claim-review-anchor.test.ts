// Phase 5 Wave B B2 — pure-logic + schema tests for the
// claim-review-anchor mark. End-to-end editor tests live in apps/web;
// here we lock the helpers + ensure the mark is in paperSchema.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ClaimReviewAnchor,
  anchorAccentClass,
  dominantVerdict,
  type VerdictBuckets,
} from '../src/extensions/claim-review-anchor';
import { paperSchema } from '../src/schema';

function buckets(
  endorses: number,
  challenges: number,
  refines: number,
): VerdictBuckets {
  return { endorses, challenges, refines };
}

describe('dominantVerdict', () => {
  it('empty when all zero', () => {
    assert.equal(dominantVerdict(buckets(0, 0, 0)), 'empty');
  });

  it('endorses when only endorses > 0', () => {
    assert.equal(dominantVerdict(buckets(3, 0, 0)), 'endorses');
  });

  it('challenges when only challenges > 0', () => {
    assert.equal(dominantVerdict(buckets(0, 2, 0)), 'challenges');
  });

  it('refines when only refines > 0', () => {
    assert.equal(dominantVerdict(buckets(0, 0, 1)), 'refines');
  });

  it('majority wins on clear winner', () => {
    assert.equal(dominantVerdict(buckets(5, 2, 1)), 'endorses');
    assert.equal(dominantVerdict(buckets(1, 4, 2)), 'challenges');
    assert.equal(dominantVerdict(buckets(0, 1, 3)), 'refines');
  });

  it('mixed on tie between buckets', () => {
    assert.equal(dominantVerdict(buckets(2, 2, 0)), 'mixed');
    assert.equal(dominantVerdict(buckets(1, 1, 1)), 'mixed');
    assert.equal(dominantVerdict(buckets(0, 3, 3)), 'mixed');
  });
});

describe('anchorAccentClass — Design.md §3.2 accent triad SoT', () => {
  it('endorses maps to accent-moss', () => {
    assert.match(anchorAccentClass(buckets(3, 0, 0)), /accent-moss/);
  });

  it('challenges maps to accent-ox', () => {
    assert.match(anchorAccentClass(buckets(0, 3, 0)), /accent-ox/);
  });

  it('refines maps to accent-ink', () => {
    assert.match(anchorAccentClass(buckets(0, 0, 3)), /accent-ink/);
  });

  it('mixed and empty get distinct classes', () => {
    const mixed = anchorAccentClass(buckets(2, 2, 0));
    const empty = anchorAccentClass(buckets(0, 0, 0));
    assert.match(mixed, /accent-mixed/);
    assert.match(empty, /accent-empty/);
    assert.notEqual(mixed, empty);
  });

  it('every output starts with the canonical mark class', () => {
    const cases = [
      buckets(0, 0, 0),
      buckets(1, 0, 0),
      buckets(0, 1, 0),
      buckets(0, 0, 1),
      buckets(2, 2, 0),
    ];
    for (const b of cases) {
      assert.match(
        anchorAccentClass(b),
        /^pm-mark-claim-review-anchor /,
        `${JSON.stringify(b)} should be prefixed`,
      );
    }
  });
});

describe('claim-review-anchor mark schema', () => {
  it('registered as a mark in paperSchema', () => {
    const schema = paperSchema();
    assert.ok(
      schema.marks['claimReviewAnchor'],
      'claimReviewAnchor missing from paperSchema',
    );
  });

  it('extension name matches schema key', () => {
    assert.equal(ClaimReviewAnchor.name, 'claimReviewAnchor');
  });

  it('mark spec carries the 3 documented attrs', () => {
    const schema = paperSchema();
    const spec = schema.marks['claimReviewAnchor']!.spec;
    const attrKeys = Object.keys(spec.attrs ?? {}).sort();
    // tiptap normalises attr keys to camelCase; we keep them stable so
    // PG row → mark attrs binding stays trivial.
    assert.deepEqual(attrKeys, [
      'claimId',
      'latestReviewerOrcidId',
      'verdictBuckets',
    ]);
  });
});
