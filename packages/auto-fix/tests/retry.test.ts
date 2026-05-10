// Phase 2 W6 Auto-Fix Retry Loop tests.
// Pure deterministic — no LLM, no PG.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  autoFixRetry,
  wrapPlainError,
  DEFAULT_MAX_ATTEMPTS,
} from '../src/index';

describe('autoFixRetry', () => {
  it('returns immediately on first-try success', async () => {
    const r = await autoFixRetry<string, number>({
      operation: async () => 42,
      fixer: async () => null,
      initialContext: 'input',
    });
    assert.equal(r.succeeded, true);
    assert.equal(r.finalValue, 42);
    assert.equal(r.attempts.length, 1);
  });

  it('retries up to maxAttempts when operation throws', async () => {
    let calls = 0;
    const r = await autoFixRetry<string, number>({
      operation: async () => {
        calls++;
        throw new Error('always fails');
      },
      fixer: async ({ attempt, context }) => `${context}-fix${attempt}`,
      initialContext: 'in',
    });
    assert.equal(r.succeeded, false);
    assert.equal(calls, DEFAULT_MAX_ATTEMPTS);
    assert.equal(r.attempts.length, DEFAULT_MAX_ATTEMPTS);
    assert.equal(r.finalContext, 'in-fix1-fix2');
  });

  it('succeeds after fixer patches the context', async () => {
    const r = await autoFixRetry<string, string>({
      operation: async (ctx) => {
        if (!ctx.includes('valid')) throw new Error('needs valid');
        return ctx;
      },
      fixer: async ({ context }) => `${context}-valid`,
      initialContext: 'bad',
    });
    assert.equal(r.succeeded, true);
    assert.equal(r.finalValue, 'bad-valid');
    assert.equal(r.attempts.length, 2);
    assert.equal(r.attempts[0]?.fixerProposed, true);
    assert.equal(r.attempts[1]?.fixerProposed, false);
  });

  it('stops if fixer returns null (give-up signal)', async () => {
    const r = await autoFixRetry<string, number>({
      operation: async () => {
        throw new Error('nope');
      },
      fixer: async () => null,
      initialContext: 'x',
    });
    assert.equal(r.succeeded, false);
    assert.equal(r.attempts.length, 1);
  });

  it('rejects out-of-range maxAttempts', async () => {
    await assert.rejects(
      () =>
        autoFixRetry({
          operation: async () => 1,
          fixer: async () => null,
          initialContext: 'x',
          maxAttempts: 99,
        }),
      /out of/,
    );
  });

  it('attempt timeout caps a hung operation', async () => {
    const r = await autoFixRetry<string, number>({
      operation: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 1;
      },
      fixer: async () => null,
      initialContext: 'x',
      maxAttempts: 1,
      attemptTimeoutMs: 30,
    });
    assert.equal(r.succeeded, false);
    assert.match(r.attempts[0]?.error?.message ?? '', /timed out/);
  });

  it('onProgress emits trying/fixed/failed events', async () => {
    const events: Array<{ attempt: number; status: string }> = [];
    await autoFixRetry<string, number>({
      operation: async () => 1,
      fixer: async () => null,
      initialContext: 'x',
      onProgress: (e) => events.push(e),
    });
    assert.ok(events.some((e) => e.status === 'trying'));
    assert.ok(events.some((e) => e.status === 'fixed'));
  });
});

describe('wrapPlainError', () => {
  it('wraps Error with stack', () => {
    const e = wrapPlainError('compile', new Error('boom'));
    assert.equal(e.kind, 'compile');
    assert.equal(e.message, 'boom');
    assert.ok(e.traceback?.length);
  });

  it('wraps non-Error value', () => {
    const e = wrapPlainError('compile', 42);
    assert.equal(e.message, '42');
  });
});
