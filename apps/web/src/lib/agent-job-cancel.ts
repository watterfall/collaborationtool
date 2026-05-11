// Phase 5 Wave A A2 — ADR-0008 §93 / §156 agent-job cancel validator.
//
// Mirrors apps/web/src/lib/maintenance.ts pattern: pure logic for the
// state machine + ownership check, consumed by:
//   - POST /api/agent/job/[jobId]/cancel route (HTTP)
//   - any future Server Action that surfaces a cancel button
//
// State machine for cancel:
//
//   queued      → cancelling      ✓  (worker hasn't picked up yet)
//   running     → cancelling      ✓  (worker will see flip at next poll)
//   cancelling  → cancelling      ✓  (idempotent: noop; same response)
//   done        → REJECT  409        (terminal)
//   error       → REJECT  409        (terminal)
//   cancelled   → REJECT  409        (terminal)
//
// Ownership: caller's principalId must equal the job's
// triggering_principal_id. Cross-user cancel is not a Phase 5 use
// case — Wave B / C may add per-document or org-level admin override
// (when we have admin roles to lean on).

// AgentJobStatus is defined in apps/agent-worker/src/job-types.ts as
// the worker-side TS mirror of the (text) `agent_job.status` column.
// apps/web does not depend on agent-worker, so we re-declare the union
// here. The PG column is the actual SoT — both apps agree on the
// vocabulary via that contract, not via a shared TS import.
export type AgentJobStatus =
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'done'
  | 'error'
  | 'cancelled';

/** Statuses where a cancel request can still take effect. */
export const CANCELLABLE_STATUSES: ReadonlySet<AgentJobStatus> = new Set([
  'queued',
  'running',
]);

/** Statuses where the cancel succeeds as a no-op (already requested). */
export const ALREADY_CANCELLING_STATUSES: ReadonlySet<AgentJobStatus> = new Set([
  'cancelling',
]);

/** Statuses that lock the row — caller gets 409. */
export const TERMINAL_STATUSES: ReadonlySet<AgentJobStatus> = new Set([
  'done',
  'error',
  'cancelled',
]);

export type CancelRejectReason =
  | 'not-found'
  | 'unauthorized'
  | 'terminal-state';

export interface CancelValidationInput {
  /** Snapshot of the agent_job row, or null when the lookup missed. */
  job:
    | {
        id: string;
        status: AgentJobStatus;
        triggeringPrincipalId: string;
      }
    | null;
  /** The principal who is asking to cancel. */
  callerPrincipalId: string;
}

export type CancelValidation =
  | {
      ok: true;
      /** When false, the row is already in `cancelling`; caller treats
       * the request as idempotent success (no DB write needed). */
      applyCancelling: boolean;
      /** Status the API returns to the client. */
      effectiveStatus: AgentJobStatus;
    }
  | {
      ok: false;
      reason: CancelRejectReason;
      /** Current status echoed back when reason='terminal-state'. */
      currentStatus?: AgentJobStatus;
    };

export function validateCancel(input: CancelValidationInput): CancelValidation {
  if (!input.job) {
    return { ok: false, reason: 'not-found' };
  }
  if (input.job.triggeringPrincipalId !== input.callerPrincipalId) {
    return { ok: false, reason: 'unauthorized' };
  }
  const { status } = input.job;
  if (TERMINAL_STATUSES.has(status)) {
    return { ok: false, reason: 'terminal-state', currentStatus: status };
  }
  if (ALREADY_CANCELLING_STATUSES.has(status)) {
    return {
      ok: true,
      applyCancelling: false,
      effectiveStatus: 'cancelling',
    };
  }
  if (CANCELLABLE_STATUSES.has(status)) {
    return {
      ok: true,
      applyCancelling: true,
      effectiveStatus: 'cancelling',
    };
  }
  // Defensive: any unknown status falls through as terminal so we don't
  // half-cancel a row we don't understand.
  return { ok: false, reason: 'terminal-state', currentStatus: status };
}
