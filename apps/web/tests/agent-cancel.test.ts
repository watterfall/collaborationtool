// Phase 5 Wave A A2 — pure-logic tests for the agent-job cancel
// validator. The HTTP route + future Server Actions both consume
// validateCancel(); locking the state machine + ownership behaviors
// here means a regression is caught before it reaches the route.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALREADY_CANCELLING_STATUSES,
  CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
  validateCancel,
  type AgentJobStatus,
} from '../src/lib/agent-job-cancel';

const OWNER = 'principal:alice';
const STRANGER = 'principal:bob';

describe('cancel matrix', () => {
  it('queued + running are the only cancellable starts', () => {
    assert.deepEqual([...CANCELLABLE_STATUSES].sort(), ['queued', 'running']);
  });

  it('cancelling is the idempotent loop state', () => {
    assert.deepEqual([...ALREADY_CANCELLING_STATUSES], ['cancelling']);
  });

  it('done / error / cancelled are terminal', () => {
    assert.deepEqual(
      [...TERMINAL_STATUSES].sort(),
      ['cancelled', 'done', 'error'],
    );
  });

  it('every status the worker emits is in some bucket', () => {
    const all: AgentJobStatus[] = [
      'queued',
      'running',
      'cancelling',
      'done',
      'error',
      'cancelled',
    ];
    for (const s of all) {
      const hit =
        CANCELLABLE_STATUSES.has(s) ||
        ALREADY_CANCELLING_STATUSES.has(s) ||
        TERMINAL_STATUSES.has(s);
      assert.ok(hit, `status ${s} is not classified`);
    }
  });
});

describe('validateCancel — happy paths', () => {
  it('queued → cancelling: applies + returns cancelling status', () => {
    const r = validateCancel({
      job: { id: 'j1', status: 'queued', triggeringPrincipalId: OWNER },
      callerPrincipalId: OWNER,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.applyCancelling, true);
    assert.equal(r.effectiveStatus, 'cancelling');
  });

  it('running → cancelling: applies', () => {
    const r = validateCancel({
      job: { id: 'j1', status: 'running', triggeringPrincipalId: OWNER },
      callerPrincipalId: OWNER,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.applyCancelling, true);
    assert.equal(r.effectiveStatus, 'cancelling');
  });

  it('cancelling → cancelling: idempotent no-op (applyCancelling=false)', () => {
    const r = validateCancel({
      job: { id: 'j1', status: 'cancelling', triggeringPrincipalId: OWNER },
      callerPrincipalId: OWNER,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.applyCancelling, false);
    assert.equal(r.effectiveStatus, 'cancelling');
  });
});

describe('validateCancel — rejections', () => {
  it('not-found when job is null', () => {
    const r = validateCancel({ job: null, callerPrincipalId: OWNER });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'not-found');
  });

  it('unauthorized when caller != triggering principal', () => {
    const r = validateCancel({
      job: { id: 'j1', status: 'running', triggeringPrincipalId: OWNER },
      callerPrincipalId: STRANGER,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'unauthorized');
  });

  it('terminal-state on done', () => {
    const r = validateCancel({
      job: { id: 'j1', status: 'done', triggeringPrincipalId: OWNER },
      callerPrincipalId: OWNER,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'terminal-state');
    assert.equal(r.currentStatus, 'done');
  });

  it('terminal-state on error', () => {
    const r = validateCancel({
      job: { id: 'j1', status: 'error', triggeringPrincipalId: OWNER },
      callerPrincipalId: OWNER,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'terminal-state');
    assert.equal(r.currentStatus, 'error');
  });

  it('terminal-state on cancelled', () => {
    const r = validateCancel({
      job: { id: 'j1', status: 'cancelled', triggeringPrincipalId: OWNER },
      callerPrincipalId: OWNER,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'terminal-state');
    assert.equal(r.currentStatus, 'cancelled');
  });

  it('ownership check beats terminal check (still 403 on terminal+stranger)', () => {
    // The stranger doesn't get to learn that the job is in a terminal
    // state — return 403 unauthorized rather than 409 terminal.
    const r = validateCancel({
      job: { id: 'j1', status: 'done', triggeringPrincipalId: OWNER },
      callerPrincipalId: STRANGER,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'unauthorized');
  });

  it('not-found beats ownership (no job to own)', () => {
    const r = validateCancel({ job: null, callerPrincipalId: STRANGER });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'not-found');
  });
});
