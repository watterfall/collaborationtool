// Phase 5 Wave A A4 — pure-logic tests for the agent-timeline tree
// builder. The component + route are thin wrappers around this; a
// regression in tree assembly is caught here without spinning up a
// DOM or DB.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTimelineTree,
  classifyJobStatus,
  countDescendants,
  totalCostUsdMilli,
  type TimelineEventRow,
  type TimelineJobRow,
} from '../src/lib/agent-timeline';

function job(
  partial: Partial<TimelineJobRow> & { id: string },
): TimelineJobRow {
  return {
    kind: 'reviewer',
    status: 'running',
    parentJobId: null,
    progressFraction: 0,
    progressMessage: null,
    startedAt: null,
    finishedAt: null,
    errorClass: null,
    errorMessage: null,
    costUsdMilli: 0,
    triggeringPrincipalId: 'principal:alice',
    ...partial,
  };
}

function ev(
  id: number,
  jobId: string,
  kind: string,
  payload: Record<string, unknown> = {},
): TimelineEventRow {
  return {
    id,
    jobId,
    eventKind: kind,
    payload,
    createdAt: new Date(2026, 4, 12, 10, 0, 0, id).toISOString(),
  };
}

describe('buildTimelineTree — root only', () => {
  it('root job + events bucketed', () => {
    const r = buildTimelineTree({
      jobs: [job({ id: 'j1', status: 'done' })],
      events: [
        ev(1, 'j1', 'progress', { fraction: 0.1 }),
        ev(2, 'j1', 'done', {}),
      ],
      rootJobId: 'j1',
    });
    assert.ok(r.root);
    assert.equal(r.root!.job.id, 'j1');
    assert.equal(r.root!.children.length, 0);
    assert.equal(r.root!.events.length, 2);
    assert.equal(r.orphans.length, 0);
  });

  it('returns null root when rootJobId missing from jobs[]', () => {
    const r = buildTimelineTree({
      jobs: [],
      events: [],
      rootJobId: 'gone',
    });
    assert.equal(r.root, null);
    assert.equal(r.orphans.length, 0);
  });
});

describe('buildTimelineTree — parent_job_id hierarchy', () => {
  it('two-level dispatch (coordinator → reviewer + researcher)', () => {
    const r = buildTimelineTree({
      jobs: [
        job({
          id: 'coord',
          kind: 'coordinator',
          status: 'running',
          startedAt: '2026-05-12T10:00:00.000Z',
        }),
        job({
          id: 'rev',
          kind: 'reviewer',
          parentJobId: 'coord',
          startedAt: '2026-05-12T10:00:05.000Z',
        }),
        job({
          id: 'res',
          kind: 'researcher',
          parentJobId: 'coord',
          startedAt: '2026-05-12T10:00:10.000Z',
        }),
      ],
      events: [],
      rootJobId: 'coord',
    });
    assert.ok(r.root);
    assert.equal(r.root!.children.length, 2);
    // Children sorted by startedAt ASC: rev (10:00:05) then res (10:00:10).
    assert.equal(r.root!.children[0]!.job.id, 'rev');
    assert.equal(r.root!.children[1]!.job.id, 'res');
  });

  it('three-level chain (coord → rev → sub-review)', () => {
    const r = buildTimelineTree({
      jobs: [
        job({ id: 'coord' }),
        job({ id: 'rev', parentJobId: 'coord' }),
        job({ id: 'sub', parentJobId: 'rev' }),
      ],
      events: [],
      rootJobId: 'coord',
    });
    assert.ok(r.root);
    assert.equal(r.root!.children[0]!.job.id, 'rev');
    assert.equal(r.root!.children[0]!.children[0]!.job.id, 'sub');
    assert.equal(r.root!.children[0]!.children[0]!.children.length, 0);
  });

  it('children with no startedAt sort to the end of their bucket', () => {
    const r = buildTimelineTree({
      jobs: [
        job({ id: 'coord' }),
        job({ id: 'late', parentJobId: 'coord' }),
        job({
          id: 'early',
          parentJobId: 'coord',
          startedAt: '2026-05-12T10:00:00.000Z',
        }),
      ],
      events: [],
      rootJobId: 'coord',
    });
    assert.equal(r.root!.children[0]!.job.id, 'early');
    assert.equal(r.root!.children[1]!.job.id, 'late');
  });
});

describe('buildTimelineTree — orphan detection', () => {
  it('child pointing to a non-existent parent becomes an orphan', () => {
    const r = buildTimelineTree({
      jobs: [
        job({ id: 'root' }),
        job({ id: 'lost', parentJobId: 'missing' }),
      ],
      events: [],
      rootJobId: 'root',
    });
    assert.equal(r.root!.children.length, 0);
    assert.equal(r.orphans.length, 1);
    assert.equal(r.orphans[0]!.id, 'lost');
  });

  it('child with parentJobId=null but not the root is an orphan', () => {
    const r = buildTimelineTree({
      jobs: [
        job({ id: 'root' }),
        job({ id: 'sibling', parentJobId: null }),
      ],
      events: [],
      rootJobId: 'root',
    });
    assert.equal(r.orphans.length, 1);
    assert.equal(r.orphans[0]!.id, 'sibling');
  });
});

describe('buildTimelineTree — event ordering', () => {
  it('events sort by bigserial id ascending within a job', () => {
    const r = buildTimelineTree({
      jobs: [job({ id: 'j1' })],
      events: [
        ev(5, 'j1', 'progress', { fraction: 0.5 }),
        ev(1, 'j1', 'progress', { fraction: 0.1 }),
        ev(3, 'j1', 'progress', { fraction: 0.3 }),
      ],
      rootJobId: 'j1',
    });
    assert.deepEqual(
      r.root!.events.map((e) => e.id),
      [1, 3, 5],
    );
  });
});

describe('classifyJobStatus', () => {
  it('cancelling collapses into in-progress (worker not yet confirmed)', () => {
    assert.equal(classifyJobStatus('cancelling'), 'in-progress');
  });
  it('cancelled is a distinct terminal bucket', () => {
    assert.equal(classifyJobStatus('cancelled'), 'cancelled');
  });
  it('done / error / queued / running pass through', () => {
    assert.equal(classifyJobStatus('done'), 'done');
    assert.equal(classifyJobStatus('error'), 'error');
    assert.equal(classifyJobStatus('queued'), 'queued');
    assert.equal(classifyJobStatus('running'), 'in-progress');
  });
  it('unknown defaults to error (defensive)', () => {
    assert.equal(classifyJobStatus('martian'), 'error');
  });
});

describe('rollups', () => {
  it('totalCostUsdMilli sums node + descendants', () => {
    const r = buildTimelineTree({
      jobs: [
        job({ id: 'coord', costUsdMilli: 100 }),
        job({ id: 'rev', parentJobId: 'coord', costUsdMilli: 250 }),
        job({ id: 'res', parentJobId: 'coord', costUsdMilli: 75 }),
      ],
      events: [],
      rootJobId: 'coord',
    });
    assert.equal(totalCostUsdMilli(r.root!), 425);
  });

  it('countDescendants does not count the root itself', () => {
    const r = buildTimelineTree({
      jobs: [
        job({ id: 'coord' }),
        job({ id: 'rev', parentJobId: 'coord' }),
        job({ id: 'sub', parentJobId: 'rev' }),
      ],
      events: [],
      rootJobId: 'coord',
    });
    assert.equal(countDescendants(r.root!), 2);
  });
});
