# role-ai：AI 协作子系统评审

> 评审范围：`packages/ai-runtime` (5122 LOC) + `plugins/*` (6 个) + `skills/*` (6 个)
> + `apps/web/api/agent/*` + `apps/agent-worker` + ADR-0008/0010/0011/0013。
> 结论先行：**架构骨架是真的，"AI 是协作者不是侧边栏"在数据层 80% 兑现，
> 但在用户接触面 (UX) 和 long-horizon 治理层 (quota/cancel/observability)
> 是 30% 兑现**。系统 ready 讲一个有说服力的 multi-agent 故事，但"协作动作"
> 这第一性原理还没在 UI 落地。

## 1. AI 协作护城河（已交付的真东西）

| 能力 | 路径 | 真度 |
|---|---|---|
| **Provenance 全链路** | `packages/ai-runtime/src/provenance-writer.ts:54-194` | **真**。`actorPrincipalId / actorKind / agentContext{agentId, modelId, modelProvider, promptTemplateId, promptHash, inputSkillIds, temperature} / toolCalls[] / approvalChain[]` 全 schema 落 PG，三表事务（prompt_template + provenance + revision），accept/reject/supersede 都 append 到 approvalChain。这一层是项目最强的护城河——比 Cursor / Copilot / Notion AI 都更彻底。 |
| **Coordinator 多步真 loop** | `packages/ai-runtime/src/coordinator/loop.ts:79-178` + `dispatch.ts` | **真但单元测试级**。`runCoordinatorLoop` 真做 sync + async 混合 dispatch、scratchpad 累积、`[final]` 终止、`maxSteps` 硬停、`allowedAgentKinds` 二次过滤。但 STATUS §1 W3 写明 "真 multi-agent 跑通推迟"——目前只 7 个单元测试 + mock LLM。 |
| **Plugin / Skill / MCP 三层组合** | `plugins/registry.json` + `skills/_registry.json` + `mcp-servers/crossref` + `packages/ai-runtime/src/plugins/manifest.ts` (581 LOC) + `mcp-client.ts` | **真**。6 个内置 plugin 都通过 `invokeAgentViaPlugin` 路径走（hardcoded `agents/citation.ts` 已删）；plugin yaml 解析 capability + quota + tools + prefers_provider；MCP 默认 in-memory mock + stdio 切换。 |
| **BYO model 4 wireFormat** | `packages/ai-runtime/src/providers/{anthropic, openai-compat, ollama, custom-http}.ts` (~1080 LOC) + `resolver.ts` 4 档优先级 | **真**。manifest 上的 `prefers_provider` (coordinator 偏好长上下文) + `user_model_pref` + `document_model_override` + env 兜底，全代码路径打通。**但 4 endpoint 真 round-trip dogfood 推迟到 W2 末 require API key**。 |
| **Long-horizon SSE 流 + reconnect cursor** | `apps/web/src/app/api/agent/job/[jobId]/stream/route.ts` | **真**。15 min 上限 + `cursor` 重放 `agent_job_event`，long-horizon 体验已经能跑。 |
| **Schema 反 pointsification**：revision 状态机 (proposed → accepted/rejected/superseded)、reviewer 反提议 = 新 revision + 新 provenance | `provenance-writer.ts:supersedeRevisionWithModified` | **真**。`approvalChain[]` 双向 link (`supersedesRevisionId` ↔ `supersededByRevisionId`)，审计图天然成形。 |

## 2. "AI 是协作者"真假检查

| 场景 | 实际路径 | 判定 |
|---|---|---|
| 用户 select 一段 → inline-editor 提议改写 | `apps/web/.../components/AgentPanel.tsx:36-225` | **半假**。`AgentPanel` 名字就是 "panel"，UX 是开侧边栏 → **手动粘贴段落** → 选 kind → 点 Run。`grep useSelection / view.state.selection / posFrom` 在整个 web + editor-core **零命中**。第一性原理 #3 "协作动作不是聊天框" 在 UI 完全没落地，是 textarea + button。 |
| Reviewer agent 通读全文列出逻辑跳跃 | `agent-runner.ts:128-142` (mock) + `runAnthropicAgent` (实) | **形 ✓ 实 ✗**。real 路径有 8-iter Anthropic tool loop 走 MCP；但 mock 里 reviewer 是按 200 字符 window 简单 wrap，并不"长程通读"。生产侧需 Anthropic API key + crossref 真 MCP 才是真 long-horizon。 |
| Coordinator 真 dispatch 多 agent | `coordinator/loop.ts:87-170` | **真但纸面**。loop 实现完整、可测；但 `STATUS Phase4 W3` 明确 "端到端真 multi-agent 跑通推迟"，没有真实跑过 5 个子 agent 串起来的 trace。 |
| Provenance 覆盖每段文字 / 每次介入 / 每个 prompt hash | `provenance-writer.ts:73-85` (insert) + `agent-runner.ts:179-191` (compute) | **真**。promptHash = sha256(skill.body + passage + userInstruction)，inputDocumentIds + tool argHash 都落库。这一层比 LangSmith / Braintrust 等纯 trace 工具更有"协作者"味——它是数据库 first-class，不是事后 telemetry。 |

**总结**：data plane 是真协作者；UI plane 还是侧边栏。这是当前最大的认知差。

## 3. Phase 5+ 会被卡住的位置

| 风险 | 评级 | 理由 |
|---|---|---|
| **Quota 解析了但从未 enforce** | **P0**。`plugins/manifest.ts:317-327` 解析 `dailyInvocations / timeoutSeconds`，但 `apps/web/.../api/agent/invoke/route.ts` + `apps/agent-worker/src/index.ts` 全 grep "quota" **零执行**。Coordinator yaml 写 `daily_invocations:30 timeout:1800s` 全是装饰。 |
| **零 cancel API** | **P0**。ADR-0008 §93 明确写 `POST /api/agent/job/<jobId>/cancel`，`find apps/web -path '*cancel*'` **零结果**；`agent_job.status='cancelled'` 在 enum 里却没人能写入。Phase 5 长任务（cell-execute / cross-device 同步）撞上必裂。 |
| **AgentExecutionContext 没记 maxIterations 实际消耗 / token cost** | **P1**。Provenance 漂亮，但少了"这次跑了 3 次 tool / 烧了 1.2k token / 触发了 2 次重试"——Phase 5 用户面板没法做。 |
| **plugin 与 skill 边界模糊** | **P1**。`plugin.yaml` 自己声明 `kind: citation` + `skillId: citation-lookup`，绑定一对一。用户自定义时一个 plugin 能不能挂多 skill / 一个 skill 能不能被多 plugin 共享，没决策。Phase 4 W1 已交付安装但没 stress 多 skill。 |
| **观察性 (observability)** | **P1**。SSE stream 推 `agent_job_event` 是好的，但没有 timeline view、trace view、跨子 job 父子链 UI（`parent_job_id` 已落库但前端零消费）。Phase 5 ORCID + 公共评审进来后，普通用户没法回溯"为什么 reviewer agent 拒了我"。 |
| **AgentPanel 不是协作动作** | **P2**（但战略意义 P0）。整个项目的 differentiation 卖点没在 UX 兑现。 |

## 4. 强化建议（具体落地点）

1. **`apps/web/.../editor-core/src/extensions/agent-trigger.ts`（新建）**：把 inline-editor 改成 PM `Mark` 触发——选区 → ⌘K 弹 floating menu → 内联预览 → 接受/拒绝就在文中 inline，**不开侧边栏**。这一条上线就把第一性原理 #3 兑现了。
2. **`packages/ai-runtime/src/quota-enforcer.ts`（新建）**：Phase 1.5 Redis counter；invoke 路由前置 + agent-worker dispatch 前置；超 quota 直接 429 + 写 `agent_job_event{kind='quota_blocked'}`。补 ADR-0008 §122 的承诺。
3. **`apps/web/src/app/api/agent/job/[jobId]/cancel/route.ts`（新建）+ worker tool-call 边界 polling**：补 ADR-0008 §93。worker 在每个 MCP `callTool` 前查 `agent_job.status === 'cancelling'`，是则 graceful shutdown。
4. **`packages/ai-runtime/src/provenance-writer.ts`：扩 AgentExecutionContext**：加 `actualIterations / promptTokens / completionTokens / retries[]`。Phase 5 Maintenance dashboard 直接消费。
5. **`apps/web/src/app/(app)/editor/[docId]/components/AgentTimeline.tsx`（新建）**：消费 `agent_job_event` + `parent_job_id` 渲染父子树，每个节点点开看 promptHash + toolCalls + scratchpad。把 coordinator 多步从纸面变可见。

## 5. 特色叙事建议（对外讲故事）

不要讲 "AI agent for papers"——LangChain / Cursor / Cline 都讲烂了。讲三层组合的**第一个 first-class provenance graph**：

> **"协作论文工具：每段 AI 介入都进数据库，每次 prompt 都进审计图。
> Provenance 不是 trace，是 schema。"**

支撑骨架：
1. **Provenance graph as schema, not telemetry**：`provenance.approvalChain[]` 就是审计 DAG，AI / human / org / agent 4 种 actorKind 同图。
2. **Plugin + Skill + MCP 三层 BYO**：不锁模型（4 wireFormat）、不锁工具（MCP）、不锁能力（plugin manifest + capability prompt）。
3. **Coordinator 是 long-horizon agent 不是 router**：scratchpad + sync/async handoff + parent_job_id，多 agent 不是 prompt-routing 而是真 dispatch。
4. **Local-first + self-host**：API key 进 env-var 不进 PG（`lib/byo-model.ts`），Ollama 一档无需任何外部服务。

最锐的差异化：**provenance graph + 可审计 approvalChain + plugin/MCP/skill 三层 + BYO 资源面板**——这组合 Inkeep / Braintrust / CrewAI 都没做齐。Phase 5 把 "AI 协作动作 inline 在 PM tree" 落地后，可以直接面向 AI 圈讲 "next-gen multi-agent UX = collaborator, not sidebar"。

---

**最大短板一句话**：Provenance / Plugin / Coordinator 三栋楼盖好了，但用户进门的那扇门 (`AgentPanel.tsx`) 还是侧边栏 textarea。先拆这扇门，再讲故事。
