// Phase 5 Wave A A1 — ADR-0008 §122 quota enforcer.
//
// Why this file: CLAUDE.md §5.7 red line states agent autonomy must
// have "quota + timeout + 可中断". ADR-0008 §122 promised
// `quotaPerDay: 50` on every agent row; §150 said "service 层做
// Redis (Phase 1.5 加) 或 PG counter". Phase 4.5 closeout's codex
// review flagged this as P0 evidence gap (mock-tier).
//
// Phase 5 implementation strategy:
//   - PG counter (Redis swap deferred to Phase 6+ per improvement-
//     plan-2026-05.md §三 Wave A scope).
//   - Atomic check-and-consume: count rows in rolling 24h window;
//     if under quota, log the new invocation; otherwise reject.
//   - Partitioned by (principalId, kind). One alice's citation quota
//     does not affect alice's reviewer quota or bob's citation quota.
//   - Pure-logic core (`checkAndConsumeQuota`) takes a `QuotaCounter`
//     abstraction so tests can drive the window with an in-memory log
//     and the production adapter (`createDbQuotaCounter`) wraps PG.
//
// Two enforcement entry points (per Wave A A1 spec):
//   1. apps/web /api/agent/invoke route — sync citation / inline-editor.
//   2. apps/agent-worker handleOne — async reviewer / researcher /
//      maintenance-scan. Defense-in-depth: even if a client bypasses
//      the HTTP route, the worker re-checks before invokeAgentViaPlugin.

import { sql, and, eq, gte } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { schema, type DbExecutor } from '@collaborationtool/drizzle';

/** ADR-0008 §122 default — 50 invocations per (principal, kind, 24h).
 * Per-agent override lives on `agent.quota_per_day` (migration 0013). */
export const DEFAULT_QUOTA_PER_DAY = 50;

/** Rolling window for the PG counter. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface QuotaCounter {
  /** Count invocations by (principalId, kind) since `since` (inclusive). */
  count(principalId: string, kind: string, since: Date): Promise<number>;
  /** Append one invocation at `now`. */
  log(principalId: string, kind: string, now: Date): Promise<void>;
  /** Optional: earliest in-window timestamp (used to compute resetAt).
   * Implementations may return null if the window is empty. */
  earliestIn?(
    principalId: string,
    kind: string,
    since: Date,
  ): Promise<Date | null>;
}

export interface CheckQuotaInput {
  counter: QuotaCounter;
  principalId: string;
  kind: string;
  /** Effective quota for this (principal, kind). Caller chooses from
   * agent.quota_per_day, document override, or DEFAULT_QUOTA_PER_DAY. */
  quotaPerDay: number;
  now: Date;
}

export interface QuotaResult {
  allowed: boolean;
  /** Count after the call. On allow: post-increment. On reject: pre-call. */
  currentCount: number;
  limit: number;
  /** When the next quota slot frees up. null when allowed (no wait). */
  resetAt: Date | null;
}

/** Reject + record-keeping shape. The HTTP layer turns this into 429;
 * the agent-worker turns it into an `agent_job_event{kind:'quota_blocked'}`
 * + agent_job.status='error', error_class='quota-exceeded'. */
export class QuotaExceededError extends Error {
  readonly principalId: string;
  readonly kind: string;
  readonly currentCount: number;
  readonly limit: number;
  readonly resetAt: Date | null;

  constructor(params: {
    principalId: string;
    kind: string;
    currentCount: number;
    limit: number;
    resetAt: Date | null;
  }) {
    super(
      `quota exceeded for ${params.principalId}/${params.kind}: ${params.currentCount}/${params.limit}`,
    );
    this.name = 'QuotaExceededError';
    this.principalId = params.principalId;
    this.kind = params.kind;
    this.currentCount = params.currentCount;
    this.limit = params.limit;
    this.resetAt = params.resetAt;
  }
}

export async function checkAndConsumeQuota(
  input: CheckQuotaInput,
): Promise<QuotaResult> {
  const { counter, principalId, kind, quotaPerDay, now } = input;
  if (!Number.isFinite(quotaPerDay) || quotaPerDay < 0) {
    throw new Error(`checkAndConsumeQuota: quotaPerDay must be >= 0 (got ${quotaPerDay})`);
  }
  const since = new Date(now.getTime() - WINDOW_MS);
  const currentCount = await counter.count(principalId, kind, since);

  if (currentCount >= quotaPerDay) {
    const earliest = counter.earliestIn
      ? await counter.earliestIn(principalId, kind, since)
      : null;
    return {
      allowed: false,
      currentCount,
      limit: quotaPerDay,
      resetAt: earliest ? new Date(earliest.getTime() + WINDOW_MS) : null,
    };
  }

  await counter.log(principalId, kind, now);
  return {
    allowed: true,
    currentCount: currentCount + 1,
    limit: quotaPerDay,
    resetAt: null,
  };
}

/** Convenience wrapper that throws QuotaExceededError on reject; useful
 * for HTTP handlers that already have a try/catch shape. */
export async function enforceQuotaOrThrow(
  input: CheckQuotaInput,
): Promise<QuotaResult> {
  const r = await checkAndConsumeQuota(input);
  if (!r.allowed) {
    throw new QuotaExceededError({
      principalId: input.principalId,
      kind: input.kind,
      currentCount: r.currentCount,
      limit: r.limit,
      resetAt: r.resetAt,
    });
  }
  return r;
}

/** Production adapter: PG-backed QuotaCounter via the
 * `agent_invocation_log` table (migration 0013). */
export function createDbQuotaCounter(db: DbExecutor): QuotaCounter {
  return {
    async count(principalId, kind, since) {
      const rows = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(schema.agentInvocationLog)
        .where(
          and(
            eq(schema.agentInvocationLog.triggeringPrincipalId, principalId),
            eq(schema.agentInvocationLog.kind, kind),
            gte(schema.agentInvocationLog.createdAt, since),
          ),
        );
      return rows[0]?.c ?? 0;
    },
    async log(principalId, kind, now) {
      await db.insert(schema.agentInvocationLog).values({
        id: uuidv7(),
        triggeringPrincipalId: principalId,
        kind,
        createdAt: now,
      });
    },
    async earliestIn(principalId, kind, since) {
      const rows = await db
        .select({ createdAt: schema.agentInvocationLog.createdAt })
        .from(schema.agentInvocationLog)
        .where(
          and(
            eq(schema.agentInvocationLog.triggeringPrincipalId, principalId),
            eq(schema.agentInvocationLog.kind, kind),
            gte(schema.agentInvocationLog.createdAt, since),
          ),
        )
        .orderBy(schema.agentInvocationLog.createdAt)
        .limit(1);
      return rows[0]?.createdAt ?? null;
    },
  };
}
