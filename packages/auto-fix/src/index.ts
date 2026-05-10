// Auto-Fix Retry Loop — Phase 2 W6 (per phase-2-plan-stub §3.6 +
// landscape mode 3 reference).
//
// Pattern: a deterministic operation (compile / render / lint / cite-
// resolve / etc.) fails with a structured error. We hand the error +
// surrounding context to an AI agent, the agent proposes a fix, we
// re-apply the operation. ≤ 3 attempts; sidebar UI shows status.
//
// This package is the **runtime-agnostic core** — it doesn't know
// about pgboss, Anthropic, Typst, or LaTeX. Callers (apps/web import
// route, agent-worker, snapshot-worker) wire it into their context.
//
// Phase 2 W7 e2e: real Typst compile-fail → AI fix → retry success
// (require `typst` on PATH + ANTHROPIC_API_KEY).

export const DEFAULT_MAX_ATTEMPTS = 3;

export interface RunResult<T> {
  ok: boolean;
  value?: T;
  /** When ok=false, the error to feed back into the fixer. */
  error?: AutoFixError;
}

/** Structured error suitable for an AI fixer prompt. The AI sees:
 *   - what operation failed (kind)
 *   - exact error message
 *   - optional source context (file path, line, surrounding lines)
 *   - optional traceback
 * Anything not in this shape is wrapped in `wrapPlainError`. */
export interface AutoFixError {
  kind: string;
  message: string;
  sourcePath?: string;
  sourceLine?: number;
  contextSnippet?: string;
  traceback?: string;
}

/** A pluggable fixer: takes the failing operation's error + the
 * caller-supplied context, returns either a patched input (success
 * → re-run with new input) or `null` (give up). */
export interface FixerInput<C> {
  attempt: number;
  maxAttempts: number;
  error: AutoFixError;
  context: C;
}

export type Fixer<C> = (input: FixerInput<C>) => Promise<C | null>;

export interface RetryOptions<C> {
  /** The operation to retry. Throws to signal failure. */
  operation: (context: C) => Promise<unknown>;
  /** AI-driven fixer that proposes a patched context. */
  fixer: Fixer<C>;
  /** Initial input. */
  initialContext: C;
  /** ≤ 3 by default; landscape mode 3 reference. */
  maxAttempts?: number;
  /** Per-attempt timeout (ms); default 30s. */
  attemptTimeoutMs?: number;
  /** Optional callback for sidebar progress. */
  onProgress?: (event: { attempt: number; status: 'trying' | 'fixed' | 'failed' }) => void;
}

export interface RetryReport<C, T> {
  succeeded: boolean;
  finalValue?: T;
  finalContext: C;
  attempts: Array<{
    attempt: number;
    error?: AutoFixError;
    fixerProposed: boolean;
  }>;
}

/** Wrap an arbitrary thrown value as an AutoFixError. */
export function wrapPlainError(kind: string, err: unknown): AutoFixError {
  if (err instanceof Error) {
    return {
      kind,
      message: err.message,
      ...(err.stack ? { traceback: err.stack } : {}),
    };
  }
  return { kind, message: String(err) };
}

/**
 * Run `operation`. On throw, ask `fixer` for a patched context, retry.
 * Stop after `maxAttempts` (default 3) or when fixer returns null.
 *
 * Type parameters: C = context (e.g. a Typst source string), T = the
 * operation's success value.
 */
export async function autoFixRetry<C, T>(
  options: RetryOptions<C>,
): Promise<RetryReport<C, T>> {
  const max = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (max < 1 || max > 10) {
    throw new Error(`autoFixRetry: maxAttempts ${max} out of [1,10]`);
  }
  const attempts: RetryReport<C, T>['attempts'] = [];
  let context = options.initialContext;

  for (let attempt = 1; attempt <= max; attempt++) {
    options.onProgress?.({ attempt, status: 'trying' });
    try {
      const value = (await runWithTimeout(
        options.operation(context),
        options.attemptTimeoutMs ?? 30_000,
      )) as T;
      options.onProgress?.({ attempt, status: 'fixed' });
      return {
        succeeded: true,
        finalValue: value,
        finalContext: context,
        attempts: [...attempts, { attempt, fixerProposed: false }],
      };
    } catch (err) {
      const error = wrapPlainError('operation', err);
      attempts.push({ attempt, error, fixerProposed: false });
      if (attempt === max) break;
      const patched = await options.fixer({
        attempt,
        maxAttempts: max,
        error,
        context,
      });
      if (patched === null) break;
      attempts[attempts.length - 1]!.fixerProposed = true;
      context = patched;
    }
  }
  options.onProgress?.({ attempt: attempts.length, status: 'failed' });
  return { succeeded: false, finalContext: context, attempts };
}

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`auto-fix attempt timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
