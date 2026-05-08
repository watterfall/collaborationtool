// Agent is a registered AI collaborator. Each Agent has a Principal
// (kind='agent') so capability grants on it work the same as on users.

import type { AgentId, IsoDateTime, PrincipalId } from './_shared';

export type AgentKind =
  | 'editor'         // 改写 / 润色
  | 'reviewer'       // 批判性审阅
  | 'citation'       // 引用核查与发现
  | 'researcher'     // 文献调研 / 数据分析
  | 'coordinator'    // 多 agent 调度
  | 'custom';        // 用户自建

export interface Agent {
  id: AgentId;                          // [PG]
  ownerPrincipalId: PrincipalId;        // [PG] platform / user / org
  name: string;                         // [PG]
  kind: AgentKind;                      // [PG]
  runtime: 'server' | 'client';         // [PG] Phase 1 default: 'server'
  defaultModelId: string;               // [PG] e.g. 'claude-opus-4-7'
  defaultSkillIds: string[];            // [PG]
  allowedMcpServerIds: string[];        // [PG]
  defaultMaxTokens: number;             // [PG]
  defaultTimeoutMs: number;             // [PG]
  principalId: PrincipalId;             // [PG] = 'agent:<agentId>'
  createdAt: IsoDateTime;               // [PG]
  archivedAt?: IsoDateTime;             // [PG]
}
