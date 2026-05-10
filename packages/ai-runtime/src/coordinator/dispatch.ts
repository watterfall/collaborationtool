// Phase 3 W6 closeout: coordinator dispatcher helpers.
//
// The coordinator agent (plugins/coordinator-agent) emits each step as
// a JSON envelope inside its assistant text. The host parses each step
// with `parseCoordinatorDecision`, runs sync handoffs through
// `dispatchSyncHandoff`, and (for async handoffs) is expected to insert
// agent_job rows with parent_job_id wired up — that path is host-side
// because it touches PG + pgboss; this file ships only the in-process
// pieces that don't depend on infra/drizzle or apps/agent-worker.
//
// Test isolation: dispatchSyncHandoff takes a `runChild` callback so
// tests can stub the actual plugin invocation without standing up
// MCP servers / Anthropic clients.

import type {
  AgentHandoff,
  CoordinatorDecision,
  HandoffResult,
} from './types';

/**
 * Parse a coordinator LLM step into a CoordinatorDecision.
 *
 * Accepts either:
 *   - a fenced ```json … ``` block in the assistant text, or
 *   - a bare JSON object string
 *
 * Returns null if the assistant text doesn't carry a parseable step.
 * The host should treat null as "coordinator confused; abort or retry"
 * and emit an `agent_job_event { event_kind: 'error' }`.
 */
export function parseCoordinatorDecision(
  assistantText: string,
  step: number,
): CoordinatorDecision | null {
  const fenced = assistantText.match(/```json\s*\n([\s\S]*?)\n```/);
  const jsonText = fenced ? (fenced[1] ?? '') : assistantText.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;
  const rationale = typeof obj['rationale'] === 'string' ? obj['rationale'] : '';
  const handoffsRaw = obj['handoffs'];
  if (!Array.isArray(handoffsRaw) || handoffsRaw.length === 0) return null;

  const handoffs: AgentHandoff[] = [];
  for (const h of handoffsRaw) {
    if (!h || typeof h !== 'object') continue;
    const r = h as Record<string, unknown>;
    const toAgentKind = r['toAgentKind'];
    const goal = r['goal'];
    const mode = r['mode'];
    if (
      typeof toAgentKind !== 'string' ||
      !['citation', 'editor', 'reviewer', 'researcher', 'custom'].includes(
        toAgentKind,
      )
    )
      continue;
    if (typeof goal !== 'string' || goal.trim().length === 0) continue;
    if (mode !== 'sync' && mode !== 'async') continue;
    const hints =
      r['hints'] && typeof r['hints'] === 'object'
        ? (r['hints'] as Record<string, unknown>)
        : {};
    handoffs.push({
      toAgentKind: toAgentKind as AgentHandoff['toAgentKind'],
      goal,
      hints,
      mode,
      ...(typeof r['blockId'] === 'string' ? { blockId: r['blockId'] } : {}),
      ...(typeof r['passage'] === 'string' ? { passage: r['passage'] } : {}),
    });
  }
  if (handoffs.length === 0) return null;

  return {
    step,
    rationale,
    handoffs,
    ...(typeof obj['scratchpad'] === 'string'
      ? { scratchpad: obj['scratchpad'] }
      : {}),
  };
}

/**
 * Result-handler signature: how the host runs a child sync invocation.
 * Tests stub this with a fake; production wires it to
 * `invokeAgentViaPlugin` against the right kind from the registry.
 */
export type SyncHandoffRunner = (
  handoff: AgentHandoff,
) => Promise<{
  /** Concise human-readable summary the coordinator can read next step. */
  summary: string;
  revisionId?: string;
  errorMessage?: string;
}>;

/**
 * Sequentially run all sync handoffs in a CoordinatorDecision and
 * return their results in declaration order. Async handoffs are
 * **dropped** here — the host inserts agent_job rows for those (with
 * parent_job_id wired) and polls them out-of-band.
 */
export async function dispatchSyncHandoffs(
  decision: CoordinatorDecision,
  runChild: SyncHandoffRunner,
): Promise<HandoffResult[]> {
  const results: HandoffResult[] = [];
  for (const handoff of decision.handoffs) {
    if (handoff.mode !== 'sync') continue;
    try {
      const r = await runChild(handoff);
      results.push({
        toAgentKind: handoff.toAgentKind,
        summary: r.summary,
        ...(r.revisionId !== undefined ? { revisionId: r.revisionId } : {}),
        ...(r.errorMessage !== undefined
          ? { errorMessage: r.errorMessage }
          : {}),
      });
    } catch (err) {
      results.push({
        toAgentKind: handoff.toAgentKind,
        summary: `child failed: ${(err as Error).message}`,
        errorMessage: (err as Error).message,
      });
    }
  }
  return results;
}
