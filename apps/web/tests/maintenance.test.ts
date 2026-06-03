// Phase 4 W4 maintenance dashboard transition matrix tests.
//
// Pure validator — no DB / HTTP. Both the API route and the dashboard
// Server Action call validateTransition(); these tests lock the
// allowed-transition matrix and the per-action update shape so a
// future change to the matrix is caught here.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALLOWED_TRANSITIONS,
  FINDING_STATUSES,
  parseMaintenanceFilter,
  validateTransition,
} from '../src/lib/maintenance';

const FIXED_NOW = new Date('2026-05-10T12:00:00Z');
const ACTOR = 'principal:user-1';

describe('parseMaintenanceFilter', () => {
  it('parses status plus document / claim / finding targets', () => {
    const f = parseMaintenanceFilter(
      new URLSearchParams({
        status: 'acknowledged',
        documentId: 'doc:1',
        claimId: 'claim:1',
        findingId: 'finding:1',
      }),
    );
    assert.equal(f.status, 'acknowledged');
    assert.equal(f.documentId, 'doc:1');
    assert.equal(f.claimId, 'claim:1');
    assert.equal(f.findingId, 'finding:1');
  });

  it('drops invalid status and blank target params', () => {
    const f = parseMaintenanceFilter(
      new URLSearchParams({
        status: 'reopened',
        documentId: ' ',
        claimId: '',
      }),
    );
    assert.deepEqual(f, {});
  });

  it('accepts Next.js searchParams object shape', () => {
    const f = parseMaintenanceFilter({
      status: ['resolved', 'open'],
      findingId: ['finding:target', 'finding:other'],
    });
    assert.equal(f.status, 'resolved');
    assert.equal(f.findingId, 'finding:target');
  });
});

describe('ALLOWED_TRANSITIONS matrix', () => {
  it('open → 3 targets; acknowledged → 2; terminal states lock', () => {
    assert.deepEqual([...ALLOWED_TRANSITIONS['open']].sort(), [
      'acknowledged',
      'dismissed',
      'resolved',
    ]);
    assert.deepEqual([...ALLOWED_TRANSITIONS['acknowledged']].sort(), [
      'dismissed',
      'resolved',
    ]);
    assert.equal(ALLOWED_TRANSITIONS['resolved'].length, 0);
    assert.equal(ALLOWED_TRANSITIONS['dismissed'].length, 0);
  });

  it('every status is in the matrix', () => {
    for (const s of FINDING_STATUSES) {
      assert.ok(ALLOWED_TRANSITIONS[s], `missing ${s} in matrix`);
    }
  });
});

describe('validateTransition — happy paths', () => {
  it('open → acknowledged: stamps acknowledgedAt + acknowledgedBy', () => {
    const v = validateTransition({
      currentStatus: 'open',
      to: 'acknowledged',
      reason: null,
      actorPrincipalId: ACTOR,
      now: FIXED_NOW,
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.updates.status, 'acknowledged');
    assert.equal(v.updates.acknowledgedAt?.toISOString(), FIXED_NOW.toISOString());
    assert.equal(v.updates.acknowledgedBy, ACTOR);
    assert.equal(v.updates.resolvedAt, undefined);
    assert.equal(v.updates.dismissedAt, undefined);
  });

  it('acknowledged → resolved: stamps resolvedAt + resolvedBy', () => {
    const v = validateTransition({
      currentStatus: 'acknowledged',
      to: 'resolved',
      reason: null,
      actorPrincipalId: ACTOR,
      now: FIXED_NOW,
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.updates.status, 'resolved');
    assert.equal(v.updates.resolvedBy, ACTOR);
  });

  it('open → dismissed: stamps dismissReason verbatim', () => {
    const v = validateTransition({
      currentStatus: 'open',
      to: 'dismissed',
      reason: '  误报：source 仍在更新  ',
      actorPrincipalId: ACTOR,
      now: FIXED_NOW,
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.updates.dismissReason, '误报：source 仍在更新');
    assert.equal(v.updates.dismissedBy, ACTOR);
  });
});

describe('validateTransition — denials', () => {
  it('rejects unknown target', () => {
    const v = validateTransition({
      currentStatus: 'open',
      to: 'reopened',
      reason: null,
      actorPrincipalId: ACTOR,
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'invalid-target');
  });

  it('rejects resolved → anything', () => {
    const v = validateTransition({
      currentStatus: 'resolved',
      to: 'acknowledged',
      reason: null,
      actorPrincipalId: ACTOR,
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'transition-not-allowed');
    assert.equal(v.from, 'resolved');
    assert.deepEqual(v.allowedFromCurrent, []);
  });

  it('rejects dismissed → resolved (terminal lock)', () => {
    const v = validateTransition({
      currentStatus: 'dismissed',
      to: 'resolved',
      reason: null,
      actorPrincipalId: ACTOR,
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'transition-not-allowed');
  });

  it('rejects acknowledged → acknowledged (no-op not allowed)', () => {
    const v = validateTransition({
      currentStatus: 'acknowledged',
      to: 'acknowledged',
      reason: null,
      actorPrincipalId: ACTOR,
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'transition-not-allowed');
  });

  it('rejects dismissed without reason', () => {
    const v = validateTransition({
      currentStatus: 'open',
      to: 'dismissed',
      reason: null,
      actorPrincipalId: ACTOR,
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'reason-required-for-dismissed');
  });

  it('rejects dismissed with whitespace-only reason', () => {
    const v = validateTransition({
      currentStatus: 'open',
      to: 'dismissed',
      reason: '   ',
      actorPrincipalId: ACTOR,
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'reason-required-for-dismissed');
  });

  it('treats unknown currentStatus as open (forward-compatible)', () => {
    // If a new status is added to the DB without updating this lib,
    // we degrade to "treat as open" rather than silently allowing.
    // Caveat: this still validates the to-target.
    const v = validateTransition({
      currentStatus: 'in-review' /* not a real status */,
      to: 'resolved',
      reason: null,
      actorPrincipalId: ACTOR,
    });
    // Treated as open → resolved is allowed.
    assert.equal(v.ok, true);
  });
});
