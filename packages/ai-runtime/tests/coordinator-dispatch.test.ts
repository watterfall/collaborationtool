// Phase 3 W6 closeout: parseCoordinatorDecision + dispatchSyncHandoffs.
// No LLM, no PG; pure in-process logic.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dispatchSyncHandoffs,
  parseCoordinatorDecision,
  type AgentHandoff,
  type CoordinatorDecision,
  type SyncHandoffRunner,
} from '../src/coordinator';

describe('parseCoordinatorDecision', () => {
  it('parses a fenced JSON block with one sync handoff', () => {
    const text = [
      'Picking the next agent...',
      '```json',
      JSON.stringify({
        rationale: 'Citations look stale; verify DOIs first.',
        handoffs: [
          {
            toAgentKind: 'citation',
            goal: 'verify DOIs in §3',
            hints: { flaggedDoiCandidates: ['10.1145/abc'] },
            mode: 'sync',
          },
        ],
      }),
      '```',
    ].join('\n');
    const decision = parseCoordinatorDecision(text, 1);
    assert.ok(decision);
    assert.equal(decision!.step, 1);
    assert.equal(decision!.handoffs.length, 1);
    assert.equal(decision!.handoffs[0]!.toAgentKind, 'citation');
    assert.equal(decision!.handoffs[0]!.mode, 'sync');
    assert.match(decision!.rationale, /verify/);
  });

  it('parses bare JSON (no fence)', () => {
    const text = JSON.stringify({
      rationale: 'r',
      handoffs: [
        {
          toAgentKind: 'reviewer',
          goal: 'tone pass',
          hints: {},
          mode: 'async',
        },
      ],
    });
    const decision = parseCoordinatorDecision(text, 2);
    assert.ok(decision);
    assert.equal(decision!.handoffs[0]!.mode, 'async');
  });

  it('rejects unknown agent kinds', () => {
    const text = JSON.stringify({
      rationale: 'r',
      handoffs: [
        { toAgentKind: 'tweet-writer', goal: 'x', hints: {}, mode: 'sync' },
      ],
    });
    assert.equal(parseCoordinatorDecision(text, 1), null);
  });

  it('rejects empty handoffs array', () => {
    const text = JSON.stringify({ rationale: 'idle', handoffs: [] });
    assert.equal(parseCoordinatorDecision(text, 1), null);
  });

  it('rejects malformed JSON', () => {
    assert.equal(parseCoordinatorDecision('not json', 1), null);
  });

  it('preserves blockId / passage when supplied', () => {
    const text = JSON.stringify({
      rationale: 'r',
      handoffs: [
        {
          toAgentKind: 'editor',
          goal: 'rewrite paragraph',
          hints: {},
          mode: 'sync',
          blockId: 'block-42',
          passage: 'old text…',
        },
      ],
    });
    const decision = parseCoordinatorDecision(text, 1);
    assert.equal(decision!.handoffs[0]!.blockId, 'block-42');
    assert.equal(decision!.handoffs[0]!.passage, 'old text…');
  });
});

describe('dispatchSyncHandoffs', () => {
  function makeDecision(handoffs: AgentHandoff[]): CoordinatorDecision {
    return { step: 1, rationale: 't', handoffs };
  }

  it('runs sync handoffs in declaration order', async () => {
    const seen: string[] = [];
    const runChild: SyncHandoffRunner = async (h) => {
      seen.push(h.toAgentKind);
      return { summary: `${h.toAgentKind}-done` };
    };
    const decision = makeDecision([
      { toAgentKind: 'citation', goal: 'a', hints: {}, mode: 'sync' },
      { toAgentKind: 'reviewer', goal: 'b', hints: {}, mode: 'sync' },
    ]);
    const results = await dispatchSyncHandoffs(decision, runChild);
    assert.deepEqual(seen, ['citation', 'reviewer']);
    assert.equal(results.length, 2);
    assert.equal(results[0]!.summary, 'citation-done');
    assert.equal(results[1]!.summary, 'reviewer-done');
  });

  it('skips async handoffs (host inserts agent_job rows separately)', async () => {
    let calls = 0;
    const runChild: SyncHandoffRunner = async () => {
      calls += 1;
      return { summary: 's' };
    };
    const decision = makeDecision([
      { toAgentKind: 'citation', goal: 'a', hints: {}, mode: 'async' },
      { toAgentKind: 'reviewer', goal: 'b', hints: {}, mode: 'sync' },
    ]);
    const results = await dispatchSyncHandoffs(decision, runChild);
    assert.equal(calls, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0]!.toAgentKind, 'reviewer');
  });

  it('captures thrown errors as errorMessage instead of bubbling', async () => {
    const runChild: SyncHandoffRunner = async (h) => {
      if (h.toAgentKind === 'citation')
        throw new Error('crossref returned 503');
      return { summary: 'ok' };
    };
    const decision = makeDecision([
      { toAgentKind: 'citation', goal: 'a', hints: {}, mode: 'sync' },
      { toAgentKind: 'reviewer', goal: 'b', hints: {}, mode: 'sync' },
    ]);
    const results = await dispatchSyncHandoffs(decision, runChild);
    assert.equal(results.length, 2);
    assert.match(results[0]!.errorMessage ?? '', /503/);
    assert.equal(results[1]!.summary, 'ok');
  });

  it('passes through revisionId from child runner', async () => {
    const runChild: SyncHandoffRunner = async () => ({
      summary: 'done',
      revisionId: 'rev-123',
    });
    const decision = makeDecision([
      { toAgentKind: 'editor', goal: 'a', hints: {}, mode: 'sync' },
    ]);
    const results = await dispatchSyncHandoffs(decision, runChild);
    assert.equal(results[0]!.revisionId, 'rev-123');
  });
});
