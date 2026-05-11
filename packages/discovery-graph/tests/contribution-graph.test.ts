// Wave D-1 — Unit tests for the contribution-graph attribution model
// (ADR-0020 §2.5). Reflects 反 priority race per Council Iteration 4
// + Merton multiple discovery + jili "组织即兴".

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createContributionGraph,
  addContribution,
  distinctContributors,
  countByKind,
  summariseByContributor,
  type Contribution,
  type ContributionGraph,
} from '../src/contribution-graph';

const T0: Contribution = {
  principalId: 'principal:alice',
  kind: 'first-proposer',
  contributedAt: '2026-05-12T10:00:00Z',
};
const T1: Contribution = {
  principalId: 'principal:bob',
  kind: 'metaphor',
  contributedAt: '2026-05-13T11:00:00Z',
};
const T2: Contribution = {
  principalId: 'principal:alice',
  kind: 'refinement',
  contributedAt: '2026-05-14T12:00:00Z',
};
const T3: Contribution = {
  principalId: 'principal:carol',
  kind: 'contradiction',
  contributedAt: '2026-05-15T13:00:00Z',
};

describe('ContributionGraph (ADR-0020 §2.5)', () => {
  it('creates graph with single initial contribution', () => {
    const g = createContributionGraph(T0);
    assert.equal(g.contributions.length, 1);
    assert.deepEqual(g.contributions[0], T0);
  });

  it('addContribution appends immutably (does not mutate input)', () => {
    const g0 = createContributionGraph(T0);
    const g1 = addContribution(g0, T1);
    assert.equal(g0.contributions.length, 1);
    assert.equal(g1.contributions.length, 2);
  });

  it('preserves order of contributions (反 priority race — order is data, not prize)', () => {
    let g = createContributionGraph(T0);
    g = addContribution(g, T1);
    g = addContribution(g, T2);
    g = addContribution(g, T3);
    assert.equal(g.contributions[0]!.principalId, 'principal:alice');
    assert.equal(g.contributions[1]!.principalId, 'principal:bob');
    assert.equal(g.contributions[2]!.principalId, 'principal:alice');
    assert.equal(g.contributions[3]!.principalId, 'principal:carol');
  });

  it('distinctContributors deduplicates by principalId, preserves first-seen order', () => {
    let g = createContributionGraph(T0);
    g = addContribution(g, T1);
    g = addContribution(g, T2);
    g = addContribution(g, T3);
    assert.deepEqual(distinctContributors(g), [
      'principal:alice',
      'principal:bob',
      'principal:carol',
    ]);
  });

  it('countByKind sums contributions per kind', () => {
    let g = createContributionGraph(T0);
    g = addContribution(g, T1);
    g = addContribution(g, T2);
    g = addContribution(g, T3);
    assert.equal(countByKind(g, 'first-proposer'), 1);
    assert.equal(countByKind(g, 'metaphor'), 1);
    assert.equal(countByKind(g, 'refinement'), 1);
    assert.equal(countByKind(g, 'contradiction'), 1);
    assert.equal(countByKind(g, 'review'), 0);
  });

  it('summariseByContributor groups kinds per principal', () => {
    let g = createContributionGraph(T0);
    g = addContribution(g, T1);
    g = addContribution(g, T2);
    g = addContribution(g, T3);
    const m = summariseByContributor(g);
    assert.deepEqual(m.get('principal:alice'), ['first-proposer', 'refinement']);
    assert.deepEqual(m.get('principal:bob'), ['metaphor']);
    assert.deepEqual(m.get('principal:carol'), ['contradiction']);
    assert.equal(m.has('principal:nobody'), false);
  });

  it('serialises to JSON losslessly (Wave D-3 will store as jsonb)', () => {
    let g = createContributionGraph(T0);
    g = addContribution(g, T1);
    const json = JSON.stringify(g);
    const parsed: ContributionGraph = JSON.parse(json);
    assert.deepEqual(parsed, g);
  });

  it('supports optional scope + note fields', () => {
    const c: Contribution = {
      principalId: 'principal:dan',
      kind: 'review',
      contributedAt: '2026-05-16T14:00:00Z',
      scope: 'block:abc-123',
      note: 'Section §3 needs more evidence.',
    };
    const g = createContributionGraph(c);
    assert.equal(g.contributions[0]!.scope, 'block:abc-123');
    assert.equal(g.contributions[0]!.note?.includes('Section'), true);
  });
});
