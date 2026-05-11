// Contribution-graph attribution model — ADR-0020 §2.5.
//
// Replaces the single "first_author" + "co-authors[]" model with a
// multi-contributor graph that captures *what kind* of contribution each
// participant made and *when*. Reflects:
//   - Merton multiple discovery (idea is environmental; first-to-arrive
//     is not the only contributor of value)
//   - jili 7 大原则 #4 "即兴式科学"
//   - plan §F.2 Pattern 4 "Multiple parallel paths > single greedy"
//   - 反 priority race per Council Iteration 4

import type { PrincipalId, IsoDateTime } from './_shared';

// Open list of contribution kinds. Adding a new kind goes through plugin
// tag mechanism (ADR-0010), not schema migration — keeps the core enum
// stable per ADR-0020 §1.5.
export type ContributionKind =
  | 'first-proposer' // 提出原始 idea (NOT a ranking factor — order is data, not prize)
  | 'question' // 提出关键问题
  | 'metaphor' // 引入隐喻 (mode A)
  | 'contradiction' // 发现矛盾 (mode B)
  | 'reframing' // 重新提问 (mode C)
  | 'analogy' // 跨域类比 (mode D)
  | 'thought-experiment' // 提出思想实验 (mode E)
  | 'experiment' // 跑实验 / 产数据
  | 'analysis' // 数据分析
  | 'synthesis' // 综合理解
  | 'refinement' // 精化 / 提炼
  | 'translation' // 跨域翻译 (connector 角色)
  | 'review' // 评审 / 反馈
  | 'replication'; // 复现

export interface Contribution {
  principalId: PrincipalId;
  kind: ContributionKind;
  contributedAt: IsoDateTime;
  // Optional: which sub-part of the artifact (block id / section / line).
  scope?: string;
  // Optional: free-form note for human readers.
  note?: string;
}

export interface ContributionGraph {
  // Append-only log. Order matters for display ("X first proposed; Y
  // added metaphor on date Z; A surfaced contradiction...").
  contributions: readonly Contribution[];
}

export function createContributionGraph(initial: Contribution): ContributionGraph {
  return { contributions: [initial] };
}

export function addContribution(
  graph: ContributionGraph,
  contribution: Contribution,
): ContributionGraph {
  return { contributions: [...graph.contributions, contribution] };
}

// Get distinct contributors (deduplicated by principalId, preserving
// first-seen order). Use for display: "by Alice, Bob, Carol".
export function distinctContributors(graph: ContributionGraph): PrincipalId[] {
  const seen = new Set<PrincipalId>();
  const result: PrincipalId[] = [];
  for (const c of graph.contributions) {
    if (!seen.has(c.principalId)) {
      seen.add(c.principalId);
      result.push(c.principalId);
    }
  }
  return result;
}

// Count contributions of a specific kind across the entire graph.
export function countByKind(
  graph: ContributionGraph,
  kind: ContributionKind,
): number {
  return graph.contributions.filter((c) => c.kind === kind).length;
}

// Build a per-contributor summary (principalId → kinds[]).
export function summariseByContributor(
  graph: ContributionGraph,
): Map<PrincipalId, ContributionKind[]> {
  const map = new Map<PrincipalId, ContributionKind[]>();
  for (const c of graph.contributions) {
    const existing = map.get(c.principalId);
    if (existing) {
      existing.push(c.kind);
    } else {
      map.set(c.principalId, [c.kind]);
    }
  }
  return map;
}
