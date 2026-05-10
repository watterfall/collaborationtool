// Phase 3 W6 Coordinator agent handoff protocol.
//
// Background: essay §6 mentions "AI 是知识对象操作器"（不是聊天助手）。
// Phase 2 我们有 4 个 single-purpose agent（citation / inline-editor /
// reviewer / researcher）+ 1 个 ingestion agent（source-extractor）。
// Phase 3 W6 起 Coordinator agent，它本身不写 revision，而是判断"该
// 调谁"+ 把 sub-task 派给具体 agent，最后聚合结果。
//
// 与 ADR-0008 long-horizon agent runtime 的关系：coordinator 也走 pgboss
// queue 'coordinator'；handoff 的子任务是新 agent_job 行（job.kind 不是
// 'coordinator' 而是被派的 'reviewer'/'citation' 等）。父子 job 通过
// `agent_job.parent_job_id` 字段关联（W6 加该字段的 schema migration
// 实施时落）。
//
// 本文件仅定义类型契约。具体的 LLM-driven dispatch 逻辑在
// plugins/coordinator-agent/agent.ts（W6 实施）。

import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

/** 一个 handoff = coordinator 派给某 agent kind 的子任务声明。 */
export interface AgentHandoff {
  /** 派给哪个 agent kind。必须能在 plugins/registry.json 找到对应行。 */
  toAgentKind:
    | 'citation'
    | 'editor'
    | 'reviewer'
    | 'researcher'
    | 'custom';
  /** 用人话写的 sub-goal（被派 agent 的 prompt 看到）。 */
  goal: string;
  /** 子 agent 的 hint payload（透传给 invokeAgentViaPlugin.hints）。 */
  hints: Record<string, unknown>;
  /** 子 agent 在哪个 block / passage 上工作（可选，整 doc 时为 null）。 */
  blockId?: string;
  passage?: string;
  /** 同步 vs 异步：sync = 在 coordinator invocation 内 await；
   * async = enqueue agent_job + parent_job_id 关联，立即返回；
   * coordinator 后续可 poll 子 job 状态再决定 next handoff。 */
  mode: 'sync' | 'async';
}

/** Coordinator 决策记录：每条对应一次 LLM 决定调用哪些 agent。
 * 持久化到 agent_job_event payload 给 SSE 客户端展示决策过程。 */
export interface CoordinatorDecision {
  /** Decision 序号。 */
  step: number;
  /** Coordinator 用人话解释为什么选这些 handoff。 */
  rationale: string;
  /** 本步派出去的 handoff（≥1）。 */
  handoffs: AgentHandoff[];
  /** Coordinator 内部状态摘要（继续决策时复用）。 */
  scratchpad?: string;
}

/** 子 job 完成后回写到 coordinator scratchpad 的结果摘要。 */
export interface HandoffResult {
  toAgentKind: AgentHandoff['toAgentKind'];
  /** Coordinator 用 LLM 把子 proposal 摘要成短文给下一步决策看。 */
  summary: string;
  /** 子 job 的 agent_job.id；UI 可点回原始 proposal。 */
  childJobId?: string;
  /** 子 agent 产出的 revisionId（如有）。 */
  revisionId?: string;
  /** 错误时填；其它字段空。 */
  errorMessage?: string;
}

/** Coordinator job input — 整个会话的初始 goal。 */
export interface CoordinatorJobInput {
  kind: 'coordinator';
  documentId: DocumentId;
  triggeringPrincipalId: PrincipalId;
  /** 用户用人话写的 goal，例如 "把这一节改投 Nature submission 风格 +
   * 补全所有引用 + 评审一遍"。 */
  goal: string;
  /** 最大决策步数，防止 loop（默认 6）。 */
  maxSteps?: number;
  /** 受限 agent kind 集合（若用户限制只用 reviewer 和 citation）。 */
  allowedAgentKinds?: AgentHandoff['toAgentKind'][];
}

/** 终态：coordinator 结束时把所有子 proposal 聚合成一条总结。 */
export interface CoordinatorFinalReport {
  goal: string;
  steps: CoordinatorDecision[];
  handoffResults: HandoffResult[];
  /** 用户视角的 takeaway：哪些 revision 已 propose / 哪些 thread 已开。 */
  summary: string;
}
