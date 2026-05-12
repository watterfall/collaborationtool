// Phase 6 W2 P2 — open content feed filter parser + open question answer validator.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseFeedFilter,
  validateOpenQuestionAnswer,
} from '@/lib/open-content-feed';

describe('parseFeedFilter', () => {
  it('empty params → defaults kind=open_question + status=open + limit=50', () => {
    const f = parseFeedFilter(new URLSearchParams());
    assert.equal(f.kind, 'open_question');
    assert.equal(f.status, 'open');
    assert.equal(f.limit, 50);
    assert.equal(f.domainTags, undefined);
  });

  it('kind=open_dataset → status not set (other entities have no status enum)', () => {
    const f = parseFeedFilter(new URLSearchParams('kind=open_dataset'));
    assert.equal(f.kind, 'open_dataset');
    assert.equal(f.status, undefined);
  });

  it('invalid kind falls back to default', () => {
    const f = parseFeedFilter(new URLSearchParams('kind=bogus'));
    assert.equal(f.kind, 'open_question');
  });

  it('status only honored when kind=open_question', () => {
    const f1 = parseFeedFilter(new URLSearchParams('kind=open_question&status=answered'));
    assert.equal(f1.status, 'answered');

    const f2 = parseFeedFilter(new URLSearchParams('kind=open_dataset&status=answered'));
    assert.equal(f2.status, undefined);
  });

  it('invalid status string for question kind → defaults to open', () => {
    const f = parseFeedFilter(new URLSearchParams('status=bogus'));
    assert.equal(f.status, 'open');
  });

  it('domainTags splits on comma + trims + drops empties', () => {
    const f = parseFeedFilter(new URLSearchParams('domainTags=ai,  physics  ,, '));
    assert.deepEqual(f.domainTags, ['ai', 'physics']);
  });

  it('limit clamped [1, 200]', () => {
    assert.equal(parseFeedFilter(new URLSearchParams('limit=0')).limit, 50);
    assert.equal(parseFeedFilter(new URLSearchParams('limit=-5')).limit, 50);
    assert.equal(parseFeedFilter(new URLSearchParams('limit=300')).limit, 200);
    assert.equal(parseFeedFilter(new URLSearchParams('limit=75')).limit, 75);
  });

  it('invalid date strings yield undefined', () => {
    const f = parseFeedFilter(new URLSearchParams('sinceCreatedAt=not-a-date'));
    assert.equal(f.sinceCreatedAt, undefined);
  });

  it('valid ISO date parsed', () => {
    const f = parseFeedFilter(new URLSearchParams('sinceCreatedAt=2026-05-12T00:00:00Z'));
    assert.ok(f.sinceCreatedAt instanceof Date);
    assert.equal(f.sinceCreatedAt!.toISOString(), '2026-05-12T00:00:00.000Z');
  });
});

describe('validateOpenQuestionAnswer', () => {
  const goodQuestion = {
    id: 'q-1',
    status: 'open' as const,
    askerPrincipalId: 'principal:asker',
  };

  it('accepts valid answer from stranger', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: goodQuestion,
      reviewerPrincipalId: 'principal:stranger',
      reviewerOrcidId: '0000-0002-1825-0097',
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.questionId, 'q-1');
  });

  it('rejects missing question (404 path)', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: null,
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'question-not-found');
  });

  it('rejects answered question', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: { ...goodQuestion, status: 'answered' },
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'question-not-open');
  });

  it('rejects withdrawn question', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: { ...goodQuestion, status: 'withdrawn' },
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'question-not-open');
  });

  it('rejects self-answer', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: goodQuestion,
      reviewerPrincipalId: goodQuestion.askerPrincipalId,
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'cannot-self-answer');
  });

  it('rejects reviewer with no ORCID', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: goodQuestion,
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'reviewer-no-orcid');
  });
});
