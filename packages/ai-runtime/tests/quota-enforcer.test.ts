// Phase 5 Wave A A1 — ADR-0008 §122 quota enforcer.
//
// Pure-logic tests; no PG. The QuotaCounter abstraction lets tests
// drive the rolling 24h window via an in-memory log; the production
// adapter (createDbQuotaCounter) is integration-tested elsewhere.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_QUOTA_PER_DAY,
  QuotaExceededError,
  checkAndConsumeQuota,
  type QuotaCounter,
} from '../src/quota-enforcer';

function makeFakeCounter(initial: Array<{
  principalId: string;
  kind: string;
  at: Date;
}> = []): QuotaCounter & {
  rows: Array<{ principalId: string; kind: string; at: Date }>;
} {
  const rows = [...initial];
  return {
    rows,
    async count(principalId, kind, since) {
      return rows.filter(
        (r) =>
          r.principalId === principalId &&
          r.kind === kind &&
          r.at.getTime() >= since.getTime(),
      ).length;
    },
    async log(principalId, kind, now) {
      rows.push({ principalId, kind, at: now });
    },
    async earliestIn(principalId, kind, since) {
      const matches = rows
        .filter(
          (r) =>
            r.principalId === principalId &&
            r.kind === kind &&
            r.at.getTime() >= since.getTime(),
        )
        .sort((a, b) => a.at.getTime() - b.at.getTime());
      return matches[0]?.at ?? null;
    },
  };
}

describe('checkAndConsumeQuota', () => {
  it('default quota per day is 50 (ADR-0008 §122)', () => {
    assert.equal(DEFAULT_QUOTA_PER_DAY, 50);
  });

  it('allows the first invocation and increments the counter', async () => {
    const counter = makeFakeCounter();
    const now = new Date('2026-05-12T10:00:00Z');
    const result = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'citation',
      quotaPerDay: 50,
      now,
    });
    assert.equal(result.allowed, true);
    assert.equal(result.currentCount, 1);
    assert.equal(result.limit, 50);
    assert.equal(counter.rows.length, 1);
  });

  it('allows up to and including the quota limit', async () => {
    const counter = makeFakeCounter();
    const now = new Date('2026-05-12T10:00:00Z');
    for (let i = 1; i <= 50; i++) {
      const r = await checkAndConsumeQuota({
        counter,
        principalId: 'usr_alice',
        kind: 'citation',
        quotaPerDay: 50,
        now,
      });
      assert.equal(r.allowed, true, `step ${i} should be allowed`);
      assert.equal(r.currentCount, i);
    }
    assert.equal(counter.rows.length, 50);
  });

  it('rejects the 51st invocation in the rolling window', async () => {
    const baseNow = new Date('2026-05-12T10:00:00Z');
    const initial = Array.from({ length: 50 }, (_, i) => ({
      principalId: 'usr_alice',
      kind: 'citation',
      at: new Date(baseNow.getTime() - i * 60_000),
    }));
    const counter = makeFakeCounter(initial);
    const result = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'citation',
      quotaPerDay: 50,
      now: baseNow,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.currentCount, 50);
    assert.equal(result.limit, 50);
    // Rejection must NOT consume — preserves quota reset semantics.
    assert.equal(counter.rows.length, 50, 'rejected call must not log');
  });

  it('counts only invocations within the rolling 24h window', async () => {
    const now = new Date('2026-05-12T10:00:00Z');
    const initial = [
      // 23h ago — inside window.
      { principalId: 'usr_alice', kind: 'citation', at: new Date(now.getTime() - 23 * 3600_000) },
      // 25h ago — outside window.
      { principalId: 'usr_alice', kind: 'citation', at: new Date(now.getTime() - 25 * 3600_000) },
      // 26h ago — outside window.
      { principalId: 'usr_alice', kind: 'citation', at: new Date(now.getTime() - 26 * 3600_000) },
    ];
    const counter = makeFakeCounter(initial);
    const r = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'citation',
      quotaPerDay: 50,
      now,
    });
    assert.equal(r.allowed, true);
    // 1 in-window + this call = 2.
    assert.equal(r.currentCount, 2);
  });

  it('partitions quota by (principalId, kind)', async () => {
    const counter = makeFakeCounter();
    const now = new Date('2026-05-12T10:00:00Z');
    // Burn alice's citation quota.
    for (let i = 0; i < 50; i++) {
      await checkAndConsumeQuota({
        counter,
        principalId: 'usr_alice',
        kind: 'citation',
        quotaPerDay: 50,
        now,
      });
    }
    // Bob (different principal) — fresh quota.
    const bob = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_bob',
      kind: 'citation',
      quotaPerDay: 50,
      now,
    });
    assert.equal(bob.allowed, true);
    assert.equal(bob.currentCount, 1);

    // Alice on a different kind — fresh quota.
    const aliceReviewer = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'reviewer',
      quotaPerDay: 50,
      now,
    });
    assert.equal(aliceReviewer.allowed, true);
    assert.equal(aliceReviewer.currentCount, 1);

    // Alice citation is still capped.
    const aliceCitation = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'citation',
      quotaPerDay: 50,
      now,
    });
    assert.equal(aliceCitation.allowed, false);
  });

  it('per-agent quota override (e.g. quotaPerDay=5 for a niche agent)', async () => {
    const counter = makeFakeCounter();
    const now = new Date('2026-05-12T10:00:00Z');
    for (let i = 1; i <= 5; i++) {
      const r = await checkAndConsumeQuota({
        counter,
        principalId: 'usr_alice',
        kind: 'researcher',
        quotaPerDay: 5,
        now,
      });
      assert.equal(r.allowed, true);
    }
    const sixth = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'researcher',
      quotaPerDay: 5,
      now,
    });
    assert.equal(sixth.allowed, false);
    assert.equal(sixth.limit, 5);
  });

  it('rejects when quotaPerDay is 0 (kill-switch semantics)', async () => {
    const counter = makeFakeCounter();
    const now = new Date('2026-05-12T10:00:00Z');
    const r = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'citation',
      quotaPerDay: 0,
      now,
    });
    assert.equal(r.allowed, false);
    assert.equal(r.currentCount, 0);
    assert.equal(r.limit, 0);
    assert.equal(counter.rows.length, 0);
  });

  it('throws on negative quotaPerDay (invariant)', async () => {
    const counter = makeFakeCounter();
    const now = new Date('2026-05-12T10:00:00Z');
    await assert.rejects(
      () =>
        checkAndConsumeQuota({
          counter,
          principalId: 'usr_alice',
          kind: 'citation',
          quotaPerDay: -1,
          now,
        }),
      /quotaPerDay/,
    );
  });

  it('exposes resetAt = earliest in-window invocation + 24h on rejection', async () => {
    const now = new Date('2026-05-12T10:00:00Z');
    const earliest = new Date(now.getTime() - 12 * 3600_000); // 12h ago
    const initial = [
      { principalId: 'usr_alice', kind: 'citation', at: earliest },
      ...Array.from({ length: 49 }, (_, i) => ({
        principalId: 'usr_alice',
        kind: 'citation',
        at: new Date(now.getTime() - (10 - i / 5) * 3600_000),
      })),
    ];
    const counter = makeFakeCounter(initial);
    const r = await checkAndConsumeQuota({
      counter,
      principalId: 'usr_alice',
      kind: 'citation',
      quotaPerDay: 50,
      now,
    });
    assert.equal(r.allowed, false);
    assert.ok(r.resetAt, 'resetAt should be set on rejection');
    assert.equal(
      r.resetAt!.getTime(),
      earliest.getTime() + 24 * 3600_000,
    );
  });
});

describe('QuotaExceededError', () => {
  it('is an Error subclass with structured fields', () => {
    const e = new QuotaExceededError({
      principalId: 'usr_alice',
      kind: 'citation',
      currentCount: 50,
      limit: 50,
      resetAt: new Date('2026-05-13T10:00:00Z'),
    });
    assert.ok(e instanceof Error);
    assert.equal(e.name, 'QuotaExceededError');
    assert.equal(e.principalId, 'usr_alice');
    assert.equal(e.kind, 'citation');
    assert.equal(e.currentCount, 50);
    assert.equal(e.limit, 50);
    assert.ok(e.resetAt instanceof Date);
    assert.match(e.message, /quota/i);
  });
});
