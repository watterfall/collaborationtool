// Phase 5 Wave B B5 — pure tests for the Reviewer Inbox helpers.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  REVIEWER_INBOX_OPEN_AGING_DAYS,
  assembleInbox,
  parseInboxFilter,
  type InboxClaimRow,
  type InboxReviewSlim,
} from '../src/lib/reviewer-inbox';

const CALLER = 'principal:reviewer-1';
const FIXED_NOW = new Date('2026-05-12T10:00:00Z');

function claim(
  overrides: Partial<InboxClaimRow> & { claimId: string },
): InboxClaimRow {
  return {
    claimText: 'sample claim text',
    documentOriginId: 'doc:1',
    createdAt: new Date(FIXED_NOW.getTime() - 14 * 24 * 60 * 60 * 1000),
    createdByKind: 'agent',
    ...overrides,
  };
}

function review(
  overrides: Partial<InboxReviewSlim> & { claimId: string; verdict: InboxReviewSlim['verdict'] },
): InboxReviewSlim {
  return {
    reviewerPrincipalId: 'principal:other-reviewer',
    reviewerOrcidId: null,
    isAiVerdict: false,
    withdrawnAt: null,
    ...overrides,
  };
}

describe('parseInboxFilter', () => {
  it('returns empty object on no params', () => {
    assert.deepEqual(parseInboxFilter(new URLSearchParams()), {});
  });

  it('parses documentId / topic / mineOnly / excludeMine', () => {
    const p = new URLSearchParams({
      documentId: 'doc:abc',
      topic: 'climate',
      mineOnly: '1',
    });
    const f = parseInboxFilter(p);
    assert.equal(f.documentId, 'doc:abc');
    assert.equal(f.topicPrefix, 'climate');
    assert.equal(f.mineOnly, true);
    assert.equal(f.excludeMine, undefined);
  });

  it('mineOnly wins when both flags set (defensive)', () => {
    const p = new URLSearchParams({ mineOnly: 'true', excludeMine: 'true' });
    const f = parseInboxFilter(p);
    assert.equal(f.mineOnly, true);
    assert.equal(f.excludeMine, undefined);
  });

  it('accepts plain object source (Next.js searchParams shape)', () => {
    const f = parseInboxFilter({ documentId: ['doc:x', 'doc:y'] });
    assert.equal(f.documentId, 'doc:x'); // takes first
  });

  it('drops blank values', () => {
    const f = parseInboxFilter(new URLSearchParams({ documentId: '  ' }));
    assert.equal(f.documentId, undefined);
  });
});

describe('assembleInbox — default open-for-review view', () => {
  it('shows aging claim with no endorsing human verdict', () => {
    const entries = assembleInbox(
      [claim({ claimId: 'c1' })],
      [],
      CALLER,
      {},
      FIXED_NOW,
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.claim.claimId, 'c1');
    assert.equal(entries[0]!.hasEndorsingHuman, false);
    assert.equal(entries[0]!.callerVerdict, null);
    assert.equal(entries[0]!.agingDays, 14);
  });

  it('hides claims younger than REVIEWER_INBOX_OPEN_AGING_DAYS', () => {
    const fresh = claim({
      claimId: 'c1',
      createdAt: new Date(FIXED_NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
    });
    const entries = assembleInbox([fresh], [], CALLER, {}, FIXED_NOW);
    assert.equal(entries.length, 0);
  });

  it('hides claims that already have an endorsing human verdict', () => {
    const entries = assembleInbox(
      [claim({ claimId: 'c1' })],
      [review({ claimId: 'c1', verdict: 'endorses' })],
      CALLER,
      {},
      FIXED_NOW,
    );
    assert.equal(entries.length, 0);
  });

  it('does NOT hide on AI endorsement (AI verdict does not satisfy human-review need)', () => {
    const entries = assembleInbox(
      [claim({ claimId: 'c1' })],
      [
        review({
          claimId: 'c1',
          verdict: 'endorses',
          isAiVerdict: true,
        }),
      ],
      CALLER,
      {},
      FIXED_NOW,
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.hasEndorsingHuman, false);
  });

  it('does NOT hide on withdrawn human endorsement', () => {
    const entries = assembleInbox(
      [claim({ claimId: 'c1' })],
      [
        review({
          claimId: 'c1',
          verdict: 'endorses',
          withdrawnAt: new Date(),
        }),
      ],
      CALLER,
      {},
      FIXED_NOW,
    );
    assert.equal(entries.length, 1);
  });

  it('exposes callerVerdict when caller has a verdict (excludeMine default = false)', () => {
    const entries = assembleInbox(
      [claim({ claimId: 'c1' })],
      [
        review({
          claimId: 'c1',
          verdict: 'refines',
          reviewerPrincipalId: CALLER,
        }),
      ],
      CALLER,
      {},
      FIXED_NOW,
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.callerVerdict, 'refines');
  });

  it('REVIEWER_INBOX_OPEN_AGING_DAYS constant is 7 (ADR-0016 §2.7)', () => {
    assert.equal(REVIEWER_INBOX_OPEN_AGING_DAYS, 7);
  });
});

describe('assembleInbox — filter constraints', () => {
  it('documentId filter narrows to that doc only', () => {
    const entries = assembleInbox(
      [
        claim({ claimId: 'c1', documentOriginId: 'doc:a' }),
        claim({ claimId: 'c2', documentOriginId: 'doc:b' }),
      ],
      [],
      CALLER,
      { documentId: 'doc:b' },
      FIXED_NOW,
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.claim.claimId, 'c2');
  });

  it('topicPrefix filter matches claim_id prefix (Phase 5 stub)', () => {
    const entries = assembleInbox(
      [
        claim({ claimId: 'climate:c1' }),
        claim({ claimId: 'biology:c2' }),
      ],
      [],
      CALLER,
      { topicPrefix: 'climate' },
      FIXED_NOW,
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.claim.claimId, 'climate:c1');
  });

  it('mineOnly bypasses aging + endorsement gates (shows caller verdicts)', () => {
    const fresh = claim({
      claimId: 'c1',
      createdAt: new Date(FIXED_NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
    });
    const entries = assembleInbox(
      [fresh],
      [review({ claimId: 'c1', verdict: 'endorses', reviewerPrincipalId: CALLER })],
      CALLER,
      { mineOnly: true },
      FIXED_NOW,
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.callerVerdict, 'endorses');
  });

  it('excludeMine drops claims the caller has verdicted on', () => {
    const entries = assembleInbox(
      [
        claim({ claimId: 'c1' }),
        claim({ claimId: 'c2' }),
      ],
      [
        review({
          claimId: 'c1',
          verdict: 'endorses',
          reviewerPrincipalId: CALLER,
        }),
      ],
      CALLER,
      { excludeMine: true },
      FIXED_NOW,
    );
    // c1 → caller already verdicted (hides); c1 also has endorsing
    // human verdict (would hide anyway). c2 → no caller verdict, shows.
    const ids = entries.map((e) => e.claim.claimId);
    assert.deepEqual(ids, ['c2']);
  });
});

describe('assembleInbox — sort', () => {
  it('sorts most-aging first', () => {
    const entries = assembleInbox(
      [
        claim({
          claimId: 'newer',
          createdAt: new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000),
        }),
        claim({
          claimId: 'older',
          createdAt: new Date(FIXED_NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
        }),
        claim({
          claimId: 'middle',
          createdAt: new Date(FIXED_NOW.getTime() - 20 * 24 * 60 * 60 * 1000),
        }),
      ],
      [],
      CALLER,
      {},
      FIXED_NOW,
    );
    assert.deepEqual(
      entries.map((e) => e.claim.claimId),
      ['older', 'middle', 'newer'],
    );
  });
});
