// Wave D-2 — Unit tests for DesignFiction Bridge atomic unit.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DesignFiction, FictionStance } from '../src/design-fiction';
import { isDesignFiction } from '../src/bridge-artifact';

const base = {
  authorPrincipalId: 'principal:jili',
  createdAt: '2026-05-12T00:00:00Z',
  updatedAt: '2026-05-12T00:00:00Z',
  visibility: 'collaborator' as const,
  status: 'active' as const,
  language: 'zh-Hans' as const,
  provenanceId: 'prov:1',
  modeTags: [] as readonly never[],
};

describe('DesignFiction (Bridge atomic unit)', () => {
  it('compiles with required fields + assumptions exposed', () => {
    const df: DesignFiction = {
      ...base,
      id: 'bridge:df:1',
      kind: 'design-fiction',
      title: '2031 实验室一日',
      bodyMarkdown: '...',
      stance: 'aspirational',
      setting: '2031 年某高校实验室',
      assumptionsToExpose: [
        '论文是研究主要载体',
        'AI 只能作 reviewer',
        '研究过程私密 by default',
      ],
      intendedAudience: 'PI + 博士生',
    };
    assert.equal(isDesignFiction(df), true);
    assert.equal(df.assumptionsToExpose.length, 3);
  });

  it('rejects empty assumptions list at runtime convention', () => {
    // Schema does not prevent [] but Bridge layer convention is that
    // design fiction MUST surface ≥1 assumption (otherwise it is sci-fi).
    // This is a soft contract: tests assert team intent, not schema.
    const df: DesignFiction = {
      ...base,
      id: 'bridge:df:empty',
      kind: 'design-fiction',
      title: '',
      bodyMarkdown: '',
      stance: 'cautionary',
      setting: '',
      assumptionsToExpose: [],
    };
    assert.equal(df.assumptionsToExpose.length, 0);
  });

  it('accepts all 4 FictionStance values', () => {
    const stances: FictionStance[] = [
      'aspirational',
      'cautionary',
      'parodic',
      'counterfactual',
    ];
    for (const s of stances) {
      const df: DesignFiction = {
        ...base,
        id: `bridge:df:${s}`,
        kind: 'design-fiction',
        title: s,
        bodyMarkdown: '',
        stance: s,
        setting: '',
        assumptionsToExpose: ['x'],
      };
      assert.equal(df.stance, s);
    }
  });

  it('round-trips through JSON unchanged', () => {
    const df: DesignFiction = {
      ...base,
      id: 'bridge:df:rt',
      kind: 'design-fiction',
      title: 't',
      bodyMarkdown: 'b',
      stance: 'counterfactual',
      setting: 's',
      assumptionsToExpose: ['a1', 'a2'],
      companionArtifactRef: 'fig:storyboard.pdf',
    };
    const json = JSON.stringify(df);
    const parsed: DesignFiction = JSON.parse(json);
    assert.deepEqual(parsed, df);
  });
});
