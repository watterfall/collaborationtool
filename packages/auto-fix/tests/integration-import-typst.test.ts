// Phase 2.5 §8.4 §5: integration test — Auto-Fix loop composed with
// a (mocked) Typst compile operation.
//
// Scenario: user submits a Typst source that has a small syntax issue
// (`= ` heading missing space). Operation throws on parse. AutoFix
// fixer (mocked AI: applies a deterministic patch) inserts the missing
// space. Re-run succeeds.
//
// We do NOT call real `typst` — that's gated on TYPST_BINARY env.
// Without it, this test exercises the loop's composition pattern.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { autoFixRetry, wrapPlainError } from '../src/index';

interface TypstCompileContext {
  source: string;
  /** Diagnostic info accumulated across attempts (for fixer prompt). */
  history: Array<{ attempt: number; errorMessage: string }>;
}

/** Mock "typst compile": rejects when source contains `=NOSPACE` (
 * deterministic stand-in for the real compiler's heading-space rule). */
async function mockTypstCompile(ctx: TypstCompileContext): Promise<string> {
  if (/=NOSPACE/.test(ctx.source)) {
    throw new Error("typst syntax error: expected ' ' after '=' in heading");
  }
  return `compiled(${ctx.source.length} chars)`;
}

describe('autoFixRetry × mock-typst-compile', () => {
  it('mock fixer rewrites =NOSPACE → = with space, re-run succeeds', async () => {
    const result = await autoFixRetry<TypstCompileContext, string>({
      operation: (ctx) => mockTypstCompile(ctx),
      fixer: async ({ context, error }) => {
        // Mock AI fixer: deterministic patch. In production, a real
        // fixer would call invokeAgentViaPlugin with the error in
        // hints + skill/model + return a patched source string.
        return {
          source: context.source.replace('=NOSPACE', '= '),
          history: [
            ...context.history,
            { attempt: context.history.length + 1, errorMessage: error.message },
          ],
        };
      },
      initialContext: {
        source: '=NOSPACE Heading\n\nBody.',
        history: [],
      },
    });

    assert.equal(result.succeeded, true);
    assert.match(result.finalValue ?? '', /^compiled/);
    assert.equal(result.attempts.length, 2);
    assert.equal(result.attempts[0]?.fixerProposed, true);
    assert.equal(result.attempts[1]?.fixerProposed, false);
    assert.equal(result.finalContext.history.length, 1);
  });

  it('mock fixer that returns null (give-up) stops the loop', async () => {
    const result = await autoFixRetry<TypstCompileContext, string>({
      operation: (ctx) => mockTypstCompile(ctx),
      fixer: async () => null, // can't figure it out
      initialContext: {
        source: '=NOSPACE Heading',
        history: [],
      },
    });
    assert.equal(result.succeeded, false);
    assert.equal(result.attempts.length, 1);
  });

  it('runs out of attempts when fixer returns same broken source', async () => {
    const result = await autoFixRetry<TypstCompileContext, string>({
      operation: (ctx) => mockTypstCompile(ctx),
      fixer: async ({ context }) => context, // no-op fixer
      initialContext: {
        source: '=NOSPACE Heading',
        history: [],
      },
    });
    assert.equal(result.succeeded, false);
    assert.equal(result.attempts.length, 3); // DEFAULT_MAX_ATTEMPTS
  });

  it('AutoFixError shape is suitable for an LLM fixer prompt', async () => {
    const e = wrapPlainError(
      'typst-compile',
      new Error('typst: line 1 col 2: expected space'),
    );
    assert.equal(e.kind, 'typst-compile');
    assert.match(e.message, /expected space/);
    assert.ok(e.traceback?.length); // stack present, AI can use
  });
});
