// Phase 5 Wave B B3 — pure-logic tests for the claim-review service
// layer. Routes are thin wrappers around these validators; a state-
// machine regression caught here means it won't reach the route.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CLAIM_REVIEW_VERDICTS,
  aggregateLineage,
  validateApplySignature,
  validateSubmitClaimReview,
  validateWithdraw,
  type LineageReviewRow,
} from '../src/lib/claim-review';

const OWNER = 'principal:reviewer-1';
const STRANGER = 'principal:reviewer-2';
const FIXED_NOW = new Date('2026-05-12T10:00:00Z');

describe('CLAIM_REVIEW_VERDICTS', () => {
  it('contains exactly the 3 ADR-0016 §2.1 values', () => {
    assert.deepEqual(
      [...CLAIM_REVIEW_VERDICTS].sort(),
      ['challenges', 'endorses', 'refines'],
    );
  });
});

describe('validateSubmitClaimReview — happy paths', () => {
  it('endorses with empty evidence_refs is allowed', () => {
    const r = validateSubmitClaimReview({
      verdict: 'endorses',
      bodyMarkdown: '看起来对',
      evidenceRefs: [],
      isAiVerdict: false,
      reviewerOrcidId: '0000-0002-1825-0097',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.payload.verdict, 'endorses');
    assert.equal(r.payload.evidenceRefs.length, 0);
    assert.equal(r.payload.reviewerOrcidId, '0000-0002-1825-0097');
  });

  it('challenges requires evidence_refs (1+ ids)', () => {
    const r = validateSubmitClaimReview({
      verdict: 'challenges',
      bodyMarkdown: '反驳',
      evidenceRefs: ['ev_abc'],
      isAiVerdict: false,
    });
    assert.equal(r.ok, true);
  });

  it('AI verdict path (no ORCID, no JWS)', () => {
    const r = validateSubmitClaimReview({
      verdict: 'refines',
      bodyMarkdown: 'AI 缩窄范围',
      evidenceRefs: [],
      isAiVerdict: true,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.payload.isAiVerdict, true);
    assert.equal(r.payload.reviewerOrcidId, null);
    assert.equal(r.payload.signedPayloadJws, null);
  });

  it('trims body markdown whitespace', () => {
    const r = validateSubmitClaimReview({
      verdict: 'endorses',
      bodyMarkdown: '  body with spaces  \n',
      evidenceRefs: [],
      isAiVerdict: false,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.payload.bodyMarkdown, 'body with spaces');
  });
});

describe('validateSubmitClaimReview — rejections', () => {
  it('rejects unknown verdict', () => {
    const r = validateSubmitClaimReview({
      verdict: 'unknown' as 'endorses',
      bodyMarkdown: 'body',
      evidenceRefs: [],
      isAiVerdict: false,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'invalid-verdict');
  });

  it('rejects empty body', () => {
    const r = validateSubmitClaimReview({
      verdict: 'endorses',
      bodyMarkdown: '   \n  ',
      evidenceRefs: [],
      isAiVerdict: false,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'empty-body');
  });

  it('rejects challenges without evidence_refs (ADR-0016 §2.1 invariant 1)', () => {
    const r = validateSubmitClaimReview({
      verdict: 'challenges',
      bodyMarkdown: 'no evidence',
      evidenceRefs: [],
      isAiVerdict: false,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'challenges-requires-evidence');
  });

  it('rejects AI verdict with ORCID (ADR-0016 §2.1 invariant 2)', () => {
    const r = validateSubmitClaimReview({
      verdict: 'endorses',
      bodyMarkdown: 'AI verdict but signed?',
      evidenceRefs: [],
      isAiVerdict: true,
      reviewerOrcidId: '0000-0001-2345-6789',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'ai-must-not-sign');
  });

  it('rejects AI verdict with JWS (ADR-0016 §2.1 invariant 2)', () => {
    const r = validateSubmitClaimReview({
      verdict: 'endorses',
      bodyMarkdown: 'body',
      evidenceRefs: [],
      isAiVerdict: true,
      signedPayloadJws: 'eyJhbGciOi...',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'ai-must-not-sign');
  });

  it('rejects signed without ORCID (ADR-0016 §2.1 invariant 3)', () => {
    const r = validateSubmitClaimReview({
      verdict: 'endorses',
      bodyMarkdown: 'body',
      evidenceRefs: [],
      isAiVerdict: false,
      signedPayloadJws: 'eyJhbGciOi...',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'sign-requires-orcid');
  });

  it('rejects malformed evidence ref id', () => {
    const r = validateSubmitClaimReview({
      verdict: 'challenges',
      bodyMarkdown: 'body',
      evidenceRefs: ['ev_ok', 'bad; DROP TABLE x'],
      isAiVerdict: false,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'invalid-evidence-ref-id');
  });
});

describe('validateApplySignature', () => {
  const baseRow = {
    id: 'r1',
    reviewerPrincipalId: OWNER,
    isAiVerdict: false,
    signedPayloadJws: null,
    withdrawnAt: null,
  };

  it('happy path: owner + ORCID + JWS sets the 4 update fields', () => {
    const r = validateApplySignature(
      {
        row: baseRow,
        callerPrincipalId: OWNER,
        callerOrcidId: '0000-0002-1825-0097',
        signedPayloadJws: 'eyJhbGciOi...',
        signatureAlgorithm: 'RS256',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.update.signedPayloadJws, 'eyJhbGciOi...');
    assert.equal(r.update.orcidSignedAt.toISOString(), FIXED_NOW.toISOString());
    assert.equal(r.update.signatureAlgorithm, 'RS256');
    assert.equal(r.update.reviewerOrcidId, '0000-0002-1825-0097');
  });

  it('rejects stranger', () => {
    const r = validateApplySignature(
      {
        row: baseRow,
        callerPrincipalId: STRANGER,
        callerOrcidId: '0000-0000-0000-0000',
        signedPayloadJws: 'jws',
        signatureAlgorithm: 'RS256',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'unauthorized');
  });

  it('rejects AI row (cannot sign)', () => {
    const r = validateApplySignature(
      {
        row: { ...baseRow, isAiVerdict: true },
        callerPrincipalId: OWNER,
        callerOrcidId: '0000-0002-1825-0097',
        signedPayloadJws: 'jws',
        signatureAlgorithm: 'RS256',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'ai-cannot-sign');
  });

  it('rejects already-signed', () => {
    const r = validateApplySignature(
      {
        row: { ...baseRow, signedPayloadJws: 'existing' },
        callerPrincipalId: OWNER,
        callerOrcidId: '0000-0002-1825-0097',
        signedPayloadJws: 'new-attempt',
        signatureAlgorithm: 'RS256',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'already-signed');
  });

  it('rejects withdrawn rows', () => {
    const r = validateApplySignature(
      {
        row: { ...baseRow, withdrawnAt: new Date('2026-05-12T09:00:00Z') },
        callerPrincipalId: OWNER,
        callerOrcidId: '0000-0002-1825-0097',
        signedPayloadJws: 'jws',
        signatureAlgorithm: 'RS256',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'withdrawn');
  });

  it('rejects sign attempts without linked ORCID', () => {
    const r = validateApplySignature(
      {
        row: baseRow,
        callerPrincipalId: OWNER,
        callerOrcidId: null,
        signedPayloadJws: 'jws',
        signatureAlgorithm: 'RS256',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'no-orcid-linked');
  });

  it('rejects empty JWS string', () => {
    const r = validateApplySignature(
      {
        row: baseRow,
        callerPrincipalId: OWNER,
        callerOrcidId: '0000-0002-1825-0097',
        signedPayloadJws: '   ',
        signatureAlgorithm: 'RS256',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'empty-jws');
  });
});

describe('validateWithdraw', () => {
  const baseRow = {
    id: 'r1',
    reviewerPrincipalId: OWNER,
    withdrawnAt: null,
  };

  it('owner can withdraw with reason', () => {
    const r = validateWithdraw(
      { row: baseRow, callerPrincipalId: OWNER, reason: '改了我的判断' },
      FIXED_NOW,
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.update.withdrawnReason, '改了我的判断');
    assert.equal(r.update.withdrawnAt.toISOString(), FIXED_NOW.toISOString());
  });

  it('stranger rejected before terminal check', () => {
    const r = validateWithdraw(
      {
        row: { ...baseRow, withdrawnAt: new Date('2026-05-12T09:00:00Z') },
        callerPrincipalId: STRANGER,
        reason: 'whatever',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'unauthorized');
  });

  it('already-withdrawn rejected (idempotency belongs to caller)', () => {
    const r = validateWithdraw(
      {
        row: { ...baseRow, withdrawnAt: new Date('2026-05-12T09:00:00Z') },
        callerPrincipalId: OWNER,
        reason: 'whatever',
      },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'already-withdrawn');
  });

  it('empty reason rejected', () => {
    const r = validateWithdraw(
      { row: baseRow, callerPrincipalId: OWNER, reason: '  ' },
      FIXED_NOW,
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'empty-reason');
  });
});

describe('aggregateLineage', () => {
  function row(
    overrides: Partial<LineageReviewRow> & { id: string; verdict: LineageReviewRow['verdict'] },
  ): LineageReviewRow {
    return {
      reviewerOrcidId: null,
      isAiVerdict: false,
      withdrawnAt: null,
      ...overrides,
    };
  }

  it('empty list returns zeros', () => {
    const agg = aggregateLineage([]);
    assert.deepEqual(agg, {
      endorses: 0,
      challenges: 0,
      refines: 0,
      orcidSignedCount: 0,
      aiVerdictCount: 0,
      totalReviews: 0,
      activeReviews: 0,
      withdrawnCount: 0,
    });
  });

  it('partitions by verdict and active status', () => {
    const agg = aggregateLineage([
      row({ id: 'a', verdict: 'endorses' }),
      row({ id: 'b', verdict: 'endorses' }),
      row({ id: 'c', verdict: 'challenges' }),
      row({ id: 'd', verdict: 'refines', withdrawnAt: new Date() }),
    ]);
    assert.equal(agg.endorses, 2);
    assert.equal(agg.challenges, 1);
    assert.equal(agg.refines, 0); // withdrawn doesn't count
    assert.equal(agg.totalReviews, 4);
    assert.equal(agg.activeReviews, 3);
    assert.equal(agg.withdrawnCount, 1);
  });

  it('orcidSignedCount + aiVerdictCount independent of withdrawal', () => {
    const agg = aggregateLineage([
      row({ id: 'a', verdict: 'endorses', reviewerOrcidId: '0000-0001-0000-0000' }),
      row({ id: 'b', verdict: 'refines', isAiVerdict: true }),
      row({ id: 'c', verdict: 'endorses', reviewerOrcidId: '0000-0002-0000-0000' }),
    ]);
    assert.equal(agg.orcidSignedCount, 2);
    assert.equal(agg.aiVerdictCount, 1);
  });

  it('withdrawn rows do not contribute orcid/ai counts', () => {
    const agg = aggregateLineage([
      row({
        id: 'a',
        verdict: 'endorses',
        reviewerOrcidId: '0000-0001-0000-0000',
        withdrawnAt: new Date(),
      }),
    ]);
    assert.equal(agg.orcidSignedCount, 0);
    assert.equal(agg.aiVerdictCount, 0);
    assert.equal(agg.activeReviews, 0);
    assert.equal(agg.withdrawnCount, 1);
  });
});
