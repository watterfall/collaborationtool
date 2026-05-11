// Wave D-2 — Unit tests for AnalogyMapping Bridge atomic unit.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AnalogyMapping,
  AnalogyValidationStatus,
  MappedRelation,
} from '../src/analogy-mapping';
import { isAnalogyMapping } from '../src/bridge-artifact';

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

describe('AnalogyMapping (Bridge atomic unit)', () => {
  it('compiles with mapped relations + known disanalogies', () => {
    const relations: MappedRelation[] = [
      {
        sourceRelation: '蚁群觅食搜索路径',
        targetRelation: '分布式系统负载均衡',
        confidence: 'strong',
        rationale: '都基于本地反馈与信息素 / heartbeat',
      },
      {
        sourceRelation: '蚂蚁个体死亡',
        targetRelation: '节点 crash',
        confidence: 'plausible',
      },
    ];
    const am: AnalogyMapping = {
      ...base,
      id: 'bridge:am:1',
      kind: 'analogy-mapping',
      title: '蚁群觅食 → 分布式负载均衡',
      bodyMarkdown: '',
      sourceMetaphorId: 'night:m:ants',
      sourceDomain: 'ant colony foraging',
      targetDomain: 'distributed load balancing',
      mappedRelations: relations,
      knownDisanalogies: [
        '蚂蚁无法直接通信，分布式节点可以广播',
        '蚂蚁基因决定行为，节点可被重编程',
      ],
      generatedPredictions: ['信息素挥发 = TTL 衰减'],
      validationStatus: 'productive',
    };
    assert.equal(isAnalogyMapping(am), true);
    assert.equal(am.mappedRelations.length, 2);
    assert.equal(am.knownDisanalogies.length, 2);
  });

  it('records broken analogy without losing it (反例仍是产出)', () => {
    const am: AnalogyMapping = {
      ...base,
      id: 'bridge:am:broken',
      kind: 'analogy-mapping',
      title: '"细胞是工厂" — broken',
      bodyMarkdown: '',
      sourceMetaphorId: 'night:m:factory',
      sourceDomain: 'industrial factory',
      targetDomain: 'living cell',
      mappedRelations: [],
      knownDisanalogies: [
        '工厂有 top-down 调度，细胞无中央控制',
        '工厂物料定向流动，细胞内主要靠扩散',
      ],
      validationStatus: 'broken',
    };
    assert.equal(am.validationStatus, 'broken');
    assert.equal(am.mappedRelations.length, 0);
  });

  it('accepts all 4 AnalogyValidationStatus values', () => {
    const statuses: AnalogyValidationStatus[] = [
      'proposed',
      'reviewed',
      'productive',
      'broken',
    ];
    for (const s of statuses) {
      const am: AnalogyMapping = {
        ...base,
        id: `bridge:am:${s}`,
        kind: 'analogy-mapping',
        title: s,
        bodyMarkdown: '',
        sourceMetaphorId: 'night:m:x',
        sourceDomain: 'a',
        targetDomain: 'b',
        mappedRelations: [],
        knownDisanalogies: [],
        validationStatus: s,
      };
      assert.equal(am.validationStatus, s);
    }
  });

  it('round-trips through JSON unchanged', () => {
    const am: AnalogyMapping = {
      ...base,
      id: 'bridge:am:rt',
      kind: 'analogy-mapping',
      title: 't',
      bodyMarkdown: 'b',
      sourceMetaphorId: 'night:src',
      sourceDomain: 'sd',
      targetDomain: 'td',
      mappedRelations: [
        {
          sourceRelation: 'r1',
          targetRelation: 'r2',
          confidence: 'speculative',
        },
      ],
      knownDisanalogies: ['d1'],
      validationStatus: 'proposed',
    };
    const json = JSON.stringify(am);
    const parsed: AnalogyMapping = JSON.parse(json);
    assert.deepEqual(parsed, am);
  });
});
