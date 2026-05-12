# ADR-0008: Long-horizon agent runtime + reviewer/research agent shape

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 2
- **Deciders**: tech-lead
- **Gated on**: Phase 1.5 close-out（done）；Phase 2 W1 ADR draft + W2-W3 implementation

---

## 1. Context

Phase 1 D13 落地了 ai-runtime 的 **single-shot** 路径：用户点 Run → POST `/api/agent/invoke` → 同步阻塞数秒 → 返 proposal。两个 agent（citation / inline-editor）都在 ~10s 内完成，HTTP 同步够用。

Phase 2 三个新 agent（ADR-0002 §2.1 已登记 verb）需要 **long-horizon**——分钟到小时：

- **reviewer agent**：读完整篇 → 列修订清单 + 评审意见。预算 ≥ 5 分钟（10K tokens 输入 + 多轮 tool 调用）
- **research agent**：调多个 MCP server（CrossRef + arxiv + Zotero） → 综合 ≥ 20 篇文献 → 给出方法学建议。预算 ≥ 15 分钟
- **future computational analysis agent**（不在本 ADR 范围）：Phase 3+

HTTP 同步会被反向代理 timeout（默认 30s–60s）杀掉；用户也不愿盯着加载圈 5 分钟。**必须**异步队列。

phase-2-plan-stub §3.1 三个开放问题：

1. 异步任务暴露给前端怎么做？SSE / pgboss / temporal / inngest？
2. reviewer agent 身份：匿名 "Reviewer 1" 还是具名 "Citation Reviewer v1.2"？影响 `Provenance.actorPrincipalId.displayName` 策略
3. reviewer agent 拒一个 revision 时是否产 `annotation_thread{kind:'reviewer-note'}`？

本 ADR 答以上三件事 + 失败/重试语义 + capability 边界。**不决定**：具体 agent 的 prompt（Phase 2 W2 实施时由 prompt registry 落）；reviewer agent 的"专长"分化（citation-reviewer vs methodology-reviewer，Phase 2 W3 评估）；多 agent 协作的 handoff（Phase 3 ADR）。

---

## 2. Decision

### 2.1 Runtime：pgboss + SSE

**Server-side queue**：[pg-boss](https://github.com/timgit/pg-boss)。它是 PG-backed 的 Node.js job queue（用 PG 当后端，无 Redis / 无单独服务），契合 ADR-0004 §2.1 单 host docker-compose 拓扑——不引入新进程。

- 队列存在 `pgboss` schema（与现有 schema 隔离）
- 一个新进程 `apps/agent-worker`：从 pgboss 拉 job → 调 ai-runtime → 写 PG → 标完成
- worker 进程数水平可扩；Phase 2 默认 1 个，Phase 3 加 quota

**Client-side stream**：Server-Sent Events（SSE）走 `/api/agent/job/<jobId>/stream`。每条消息是一个 progress / partial / done / error 事件；Next.js App Router `Response` body 直接是 ReadableStream。

为什么不选 temporal / inngest / custom WebSocket：见 §4 Alternatives。

**Job lifecycle**（PG 表 `agent_job` + pgboss）：

```sql
CREATE TABLE agent_job (
  id text PRIMARY KEY,                      -- uuidv7
  kind text NOT NULL,                       -- 'reviewer' | 'researcher'
  document_id uuid NOT NULL REFERENCES document(id),
  triggering_principal_id text NOT NULL REFERENCES principal(id),
  agent_principal_id text NOT NULL REFERENCES principal(id),  -- the agent itself
  status text NOT NULL DEFAULT 'queued',    -- queued|running|done|error|cancelled
  progress_fraction numeric DEFAULT 0,      -- 0..1
  progress_message text,                    -- last user-visible status line
  output_revision_ids text[] DEFAULT '{}',  -- revisions produced
  output_thread_ids text[] DEFAULT '{}',    -- reviewer-note threads
  cost_token_input integer DEFAULT 0,
  cost_token_output integer DEFAULT 0,
  cost_usd_milli integer DEFAULT 0,         -- thousandths of a USD
  started_at timestamptz,
  finished_at timestamptz,
  error_class text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_job_doc_status ON agent_job(document_id, status);
CREATE INDEX agent_job_triggerer ON agent_job(triggering_principal_id, created_at DESC);
```

The pgboss row holds the queue / dedupe / retry state；**`agent_job` 是用户层面的视图**，由 worker 在生命周期事件里写入。两表 1:1 通过 `id` 关联（同一 uuid）。

**HTTP 接口**（capability gates 见 §2.4）：

```
POST /api/document/<docId>/agent-job
  body: { kind: 'reviewer' | 'researcher', input: {...} }
  → 201 { jobId, statusUrl, streamUrl }

GET  /api/agent/job/<jobId>
  → 200 { status, progress, outputs, cost }

GET  /api/agent/job/<jobId>/stream
  → text/event-stream:
       event: progress  data: {fraction, message}
       event: partial   data: {revisionId, thread?}
       event: done      data: {outputRevisionIds, outputThreadIds, cost}
       event: error     data: {errorClass, errorMessage}

POST /api/agent/job/<jobId>/cancel
  → 200 (sets status to cancelling; worker checks each tool-call boundary)
```

**SSE re-connect**：客户端断网重连时，`GET /api/agent/job/<jobId>/stream?cursor=<eventId>` 从最后看到的事件接着推。worker 把 progress 事件每条都写到 `agent_job_event` append-only 表（PG）；流端口读这个表，不再依赖 in-process pubsub。

### 2.2 Reviewer agent 身份：**具名 + 版本号**

Provenance.actorPrincipalId.displayName 形如 `"Citation Reviewer Agent v1.2"`，**不**是 "Reviewer 1"。

理由：

1. **审计**：revision 落地后，文档作者点开 Provenance trail 必须能复现"哪个 agent 在哪个 prompt template 上跑"——匿名严重削弱可追溯性
2. **信任校准**：reviewer agent 不是匿名同行评审；它是 LLM。把它伪装成匿名人类有伦理问题
3. **citation-reviewer ≠ methodology-reviewer**——具名让作者知道"这条意见来自哪个专长"
4. **数据模型对齐**：ADR-0001 §2.3.7 已要求 agent 有自己的 Principal kind=`agent` + 自己的 displayName

**结构**：每个 agent 一个 `principal` 行（kind=`agent`） + 一个 `agent` 行（kind=`reviewer` / `researcher`）。displayName 在 principal 行（用户看的）；agent 行里带 `version` + `runtime` + `allowedMcpServerIds`。

```ts
{
  principal: { id: '...', kind: 'agent', displayName: 'Citation Reviewer Agent v1.2' },
  agent: {
    principalId: '...',
    kind: 'reviewer',                 // ADR-0001 §2.3.7 enum 加 'researcher'
    runtime: 'long-horizon',          // 新 enum 值；single-shot 是 Phase 1 默认
    version: '1.2',
    promptTemplateId: 'tmpl_...',     // 指向 prompt_template 表
    allowedMcpServerIds: ['crossref', 'arxiv'],
    quotaPerDay: 50,                  // 每个 user 每日触发上限
  }
}
```

`AgentKind` 现有 enum `'inline-editor' | 'citation' | 'custom'`；本 ADR 加 `'reviewer'` + `'researcher'`（schema migration `0006_agent_kind_extend.sql`，只动 enum）。

### 2.3 Reviewer reject 走 annotation_thread{kind:'reviewer-note'}

reviewer agent 跑完后输出可能含三类项：

| 输出类型 | 落地位置 | reviewer 操作 |
|---|---|---|
| 修改建议（具体改字） | `revision` row（status=pending）+ `proposal_metadata` jsonb | 作者 accept / reject |
| 评审意见（不具体改字，是论述） | `annotation_thread{kind:'reviewer-note'}` + N comment | 作者回复 / 标 resolved |
| 拒掉作者已有的 revision | `revision.status='rejected'` + 同时产一条 `annotation_thread{kind:'reviewer-note'}` 解释 why | 作者读 thread，可改后再 propose |

第三种是 phase-2-plan-stub §3.1 的开放问题答案：**是**，reviewer agent 拒一条 revision 必须留一条 `reviewer-note` thread；拒绝本身只动 status 不留理由是反模式。

`AnnotationKind` 现有 enum 已含 `'reviewer-note'`（packages/schema/src/annotation.ts:13），无需 migration。

### 2.4 Capability gates

新 verbs 已经在 ADR-0002 §2.1 注册：`agent.invoke:reviewer`、`agent.invoke:researcher`。本 ADR 不加 capability 词汇，但补充语义：

- 触发 reviewer/researcher job：`agent.invoke:<kind>` 必须在 caller 的 capability bag 里（per-document scope）
- agent worker 自身：用 `agent` kind 的 principal 跑；它的 `principal_acl` 行授予 `block.read` / `block.propose` / `annotation.create`（与 inline-editor/citation agent 一致）。**不**给 `block.commit` —— reviewer agent 不直接落 revision，produces propose-only
- cancel job：`agent.invoke:<kind>` 即可（同 verb；cancel 自己排队的 job 是默认权利）
- quota：`agent.quotaPerDay` 在 agent 行里；service 层做 Redis（Phase 1.5 加）或 PG counter

### 2.5 失败 / 重试 / 超时

- pgboss 重试：默认禁用（`retryLimit: 0`）。LLM 失败大多是 prompt-deterministic（context too long / tool call malformed），重试只烧钱
- worker 内部超时：reviewer 默认 10 分钟，researcher 默认 30 分钟（per-kind override 在 agent 行的 `executionEnv`）
- 用户 cancel：worker 在每次 MCP tool-call 的边界检查 `agent_job.status === 'cancelling'`，是则 graceful shutdown + 标 `status='cancelled'`
- LLM API rate-limit / 5xx：单条 tool-call 内部走 exponential backoff（最多 3 次）；外层 job 不重试

### 2.6 成本上限

每个 job 跑前预估：`avg_cost_per_kind * (1 + safety_factor)`。**默认禁止**单 job 成本 > $5 USD（agent 行的 `maxCostUsd` 字段）。worker 在每次 tool 调用结束累加 `cost_token_input/output/usd_milli`；超限即 graceful shutdown + 标 `error_class='cost-limit-exceeded'`。

ADR-0004 §2.7 写过日预算；这里加单 job 上限是第二道防线。

---

## 3. Consequences

### Good

- **零新基础设施进程**：pgboss 复用 Postgres，单 host docker-compose（ADR-0004 §2.1）拓扑不变；6 进程拓扑加一个 `agent-worker` = 7 进程
- **SSE 比 WebSocket 简单**：单向 server→client，无握手 / 无 ping-pong 维护；浏览器 EventSource 内建 reconnect
- **重连不丢事件**：`agent_job_event` append-only + cursor 模型；用户关电脑再回来还能看到完整进度
- **具名 agent 直接喂进 Provenance**：不需要"匿名包装"层；Phase 1 的 Provenance 写入路径继续工作
- **reviewer-note thread 与现有 annotation 系统统一**：作者回复、resolve、展示都走同一套 UI（不用建第二个评审视图）

### Bad / Trade-offs

- **pgboss 不是分布式编排**：长时跨机器流（reviewer → researcher → cell-execute 一条龙）不在 pgboss 范围；Phase 3 多 agent handoff 时评估 temporal / 自写 saga
- **PG-backed 队列在高并发会成瓶颈**：每次 dequeue 是 advisory lock + UPDATE；50+ 并发 reviewer 就开始竞争。Phase 2 单进程 worker 不会触发；Phase 3 多 worker 时实测临界点
- **SSE 不能从客户端推数据**：cancel / pause 只能走单独 POST。不是缺点，是规约，但需要 UI 知道
- **agent_job_event 表的写入放大**：reviewer 每次进度更新一行，10 分钟可能写 200+ 行/job。100 jobs/day = 20K 行/day，PG 撑得起；Phase 4 加 7 天清理 cron
- **具名 agent 的 displayName 不能改**：换 prompt 等于换版本（principal + agent 都是新行），老 Provenance 还指向旧 displayName。这是 immutable audit 的特征不是 bug

### Neutral / Need watching

- **prompt registry 表**（ADR-0003 §2.5 已规划，Phase 1 D13 含字段）必须在本 ADR 实施前 ready；`prompt_template` 表 Phase 1 已建（schema.ts:454）
- **reviewer agent 触发的 Provenance 容量**：每个 reviewer job 可能产 10–20 条 contribution（每条 revision/thread 各一条）。`provenance` 表 schema 已能容下，但 reviewer 一次跑可能让单 doc 的 provenance 行数翻倍——Phase 2 实测 query 性能
- **SSE 与反向代理的兼容**：Caddy / Traefik 默认对 EventSource 支持良好（不缓冲）；nginx 需要 `proxy_buffering off; proxy_read_timeout 1h`。SELF_HOST.md 加注。

---

## 4. Alternatives considered

### A: Temporal

Workflow engine with retries, timeouts, signals, side-effect semantics built in。

**为什么不选**：

1. **运营成本太重**：单独 Postgres + 单独 server + 单独 UI；ADR-0004 §2.1 单 host docker-compose 直接破坏
2. **学习曲线**：team 不熟，3+ 周才到能用；Phase 2 不能延这么久
3. **过度工程**：Phase 2 的两个 agent 不需要 complex workflow（read 文章 → 想 → 输出）；durable workflow 是给"调外部 webhook → 等回调 → 第二天再跑"这种场景

**什么情况会回头**：Phase 3 多 agent handoff（reviewer → research → cell-execute）+ 跨小时 / 跨机器协调；那时 Temporal 的 saga 模式才合算

### B: Inngest

Hosted SaaS workflow runner with TypeScript-native step functions。

**为什么不选**：

1. **vendor lock-in**：开放评审 / 自托管时选 SaaS 队列违反 ADR-0004 §2.1 的"6 进程全自托管"原则
2. **数据隐私**：job payload 含 LLM prompt + 部分 paper 内容；外发到 inngest server 不通过 ADR-0001 §2.5（隐私优先）
3. **成本**：按 step 计费，reviewer/researcher 每个 job 100+ steps，按当前价跑日预算 50 jobs/day 月费 ≥ $500

### C: 自写 setInterval + PG row poll

最简：worker 是 setInterval(pollJobs, 5s) 的 Node script。

**为什么不选**：

1. **没有 dequeue 原子性**：两个 worker 同时拉同一行 → race；要自己写 advisory lock，本质就是写半个 pgboss
2. **没有重试 / 失败语义**：worker crash 后 job 卡在 `running`；要自己做 stale-job 探测
3. **pgboss 已经把这些写好了，4MB 一个 dependency**

### D: WebSocket 代替 SSE

主页面与 agent worker 走 WebSocket；进度 / cancel 双向

**为什么不选**：cancel 一年用一次，多走一个独立 POST 不亏；WebSocket 与现有 sync-gateway 又一条 WS 通道，资源管理复杂；SSE 的 EventSource API 浏览器内建重连，开发量小

### E: Reviewer 匿名 "Reviewer 1"

模拟人类盲审。

**为什么不选**：见 §2.2 四条理由。**LLM 不是人类同行**，假装匿名有伦理 / 法律 / 信任 / 审计四类问题。如果用户希望"读评审时不知道哪条是 LLM 哪条是人"，那是另一种产品决策（Phase 3 评估），不通过身份匿名实现，而是通过显示层选择性折叠

---

## 5. Decision log（决策过程中的关键讨论）

- **2026-05-09**: pgboss over temporal —— 关键判据是"6 进程拓扑不破坏"；temporal 进 Phase 3 评估
- **2026-05-09**: SSE over WebSocket —— EventSource 浏览器原生 reconnect + Next.js App Router ReadableStream 直接生成；WebSocket 是 sync-gateway 已用，加第二条 WS 通道增 burdens
- **2026-05-09**: 具名 agent over 匿名 —— 审计 + 信任 + ADR-0001 §2.3.7 一致；匿名不通过的伦理 bar
- **2026-05-09**: reviewer reject 必须留 reviewer-note —— 匿名拒掉是反模式；reviewer-note 是 AnnotationKind 既有值，零 schema 改动
- **2026-05-09**: 单 job $5 USD hard cap + 默认 retryLimit=0 —— LLM 失败重试通常烧钱不解决问题；prompt 改才管用
- **2026-05-09**: agent_job_event append-only 表（不用 in-process pubsub）—— 跨 worker 重启 / 客户端重连都能拿历史

---

## 6. References

- ADR-0001 §2.3.7（Agent / Principal kind=agent）
- ADR-0002 §2.1（capability vocab：`agent.invoke:reviewer/researcher`）
- ADR-0003 §2.5（prompt registry，Phase 1 D13 字段已就位）
- ADR-0004 §2.1（6 进程拓扑），§2.7（Anthropic API 成本控制 / quota）
- `plan0/phase-2-plan-stub.md §3.1`（开放问题，本 ADR 答）
- `packages/ai-runtime/src/agent-runner.ts`（Phase 1 single-shot runner，Phase 2 复用为 worker 内核）
- pg-boss: https://github.com/timgit/pg-boss
- MDN EventSource: https://developer.mozilla.org/docs/Web/API/EventSource

---

## 7. Implementation review log

### Phase 5 Wave A A1 — quota enforcer 落地（2026-05-11）

补 §122 / §150 quota 承诺（Phase 4.5 evidence tier = `mock` → `real`，CLAUDE.md §5.7 红线达成 quota 维度）。

**新加 schema**（migration `0013_agent_quota.sql`）：

- `agent.quota_per_day integer NOT NULL DEFAULT 50`：mirrors §122 promise；现有行 backfill via DEFAULT
- `agent_invocation_log (id, triggering_principal_id, kind, created_at)`：append-only counter；rolling 24h window 由 quota-enforcer.ts 计算。索引 `(triggering_principal_id, kind, created_at DESC)` 满足 hot-path COUNT 查询

**新加代码**：

- `packages/ai-runtime/src/quota-enforcer.ts`：纯逻辑 `checkAndConsumeQuota` + `enforceQuotaOrThrow` + `QuotaExceededError` + `createDbQuotaCounter(db)` PG 适配器；语义关键点：
  - 拒绝路径 **不消耗** counter（quota reset 时间保鲜）
  - quota 按 `(principalId, kind)` 分区，partition skew = 0
  - `quotaPerDay = 0` 是合法 kill-switch；`< 0` 走 `Error` 抛出（防止配置注入回避）
  - `resetAt` = 窗口内最早一条 invocation + 24h（实现可选实现 `earliestIn`，默认 null）
- `apps/web/src/app/api/agent/invoke/route.ts` 前置：principal + kind 拿到后立即校验，超 quota 返 `429` + `Retry-After` 头 + observability `agent.invoke.quota_blocked` 事件
- `apps/agent-worker/src/index.ts` `handleOne` 防御式再校验：超 quota → `markError(jobId, 'quota-exceeded')` + `agent_job_event{kind:'error', errorClass:'quota-exceeded'}` + 立即 return（不走 `invokeAgentViaPlugin`）

**为什么 worker 也校验**：HTTP 路由是默认入口，但 pgboss 队列可以由内部 caller（coordinator handoff / 未来 cron）填入；defense-in-depth 防止任何绕过 invoke 路由的入队对 quota 视而不见。

**为什么不一次写 Redis**：§150 把 Redis 标"Phase 1.5 加"，但项目实际 Redis 部署被推到 Phase 6+；PG counter 在当前 Phase 5 用量下 amply 够用（单机 pgboss + agent_job 表已经承担过同等量级写）。Redis swap 留 `QuotaCounter` 接口稳定，未来一行替换。

**为什么 invoke 路由用 `DEFAULT_QUOTA_PER_DAY` 而非 `agent.quota_per_day`**：sync invoke（citation / inline-editor）暂无对应 `agent` 行；Phase 5 Wave B 落 agent 注册路径后再切。worker dispatch 路径同样目前未读 `agent.quota_per_day`（保留为 Wave A 收尾或 Wave B 工作）。

**测试覆盖**（11 单元测试，纯 in-memory counter）：
- DEFAULT_QUOTA_PER_DAY === 50
- 第 1 次允许 + counter +1
- 1..50 全允许
- 51 拒绝 + currentCount = 50 + counter 不变
- 24h window 切分（23h ago 计 / 25h ago 不计）
- (principal, kind) 分区
- 单 agent override `quotaPerDay = 5`
- killswitch `quotaPerDay = 0` → 立即拒绝
- 负数 quotaPerDay → throw
- resetAt = 最早 in-window invocation + 24h
- QuotaExceededError 结构化字段（principalId / kind / currentCount / limit / resetAt / name）

**剩余 caveat**（Evidence Tier 仍 `mixed`）：
- A2 cancel route：`POST /api/agent/job/<jobId>/cancel` + worker `callTool` 前 poll `agent_job.status='cancelling'`（1-2 天）
- A3 AgentExecutionContext 扩 `actualIterations/promptTokens/completionTokens/retries[]`
- A4 AgentTimeline.tsx 渲染 `agent_job_event` + parent/child 树
- reviewer / researcher path stub → 真 LLM round-trip（W9 G3 跑通后 `real`）

### Phase 5 Wave A A2 — cancel API + worker poll（2026-05-11）

补 §93 / §156 承诺。CLAUDE.md §5.7 红线"agent 必须有 quota + timeout + **可中断**"中"可中断"维度达成。

**schema**（migration `0013_agent_quota.sql` §3 追）：

- `ALTER TYPE "agent_job_status" ADD VALUE IF NOT EXISTS 'cancelling'`（PG 12+ 幂等；docker-compose 16）
- Drizzle `agentJobStatusEnum` 同步增第 3 档（5→6 档）
- `AgentJobStatus` TS union + `JobEventPayload` union 加 `{kind:'cancelled', reason}`（区别于 `error`：客户端能渲染"被你停了"而非"agent 失败了"）

**状态机**（`apps/web/src/lib/agent-job-cancel.ts` 纯 validator）：

```
queued | running   → cancelling   (applyCancelling=true,  HTTP 200)
cancelling         → cancelling   (applyCancelling=false, HTTP 200 — idempotent)
done | error | cancelled → REJECT (HTTP 409 terminal-state)
not-owner          → REJECT (HTTP 403 unauthorized)
not-found          → REJECT (HTTP 404 not-found)
```

**Ownership > terminal**：stranger 看 done 也返 403，不泄漏 job 当前状态。这是 ACL 信息门最小化。

**worker poll 3 边界**（`apps/agent-worker/src/index.ts` `respectCancellation(db, jobId, boundary)`）：

1. **pre-running**（`markRunning` 前）：queued→running 之间用户 cancel 不浪费 quota 检查
2. **pre-dispatch**（quota check 后 / maintenance-scan 分支前）：紧贴"任何昂贵工作"前
3. **maintenance pre-write**（`scanForFindings` 后 / `writeFindings` 前）：长扫描中途 cancel 不留半写 findings

命中 cancelling 即：`markCancelled` (status='cancelled', finishedAt=now, progressFraction 保留) + `appendEvent({kind:'cancelled', reason: 'worker stopped at boundary: <name>'})` + return。

**为什么 reviewer/researcher 真 invoke path 没接 poll**：当前 W4-W7 stub 直接 markDone；待 reviewer 真 LLM 跑通（Wave B/D）时，在 MCP `callTool` 前后接 `respectCancellation` 同样能用。当前 3 边界已覆盖所有有副作用的 path。

**测试覆盖**（`apps/web/tests/agent-cancel.test.ts` 14 测）：
- CANCELLABLE / ALREADY_CANCELLING / TERMINAL 三集合完备性
- 6 status 全分类
- happy: queued→cancelling apply / running→cancelling apply / cancelling→cancelling 幂等
- reject: not-found / unauthorized / done / error / cancelled
- ownership 先于 terminal（stranger 看 done 也 403）
- not-found 先于 ownership（无 job 即 404）

**剩余 caveat**：
- reviewer/researcher 真 invokeAgentViaPlugin path 接 cancel poll（W4-W7 stub 真化时一起做）

### Phase 5 Wave A A3 — AgentExecutionContext schema 扩（2026-05-11）

补 improvement-plan §五 Wave A A3 承诺。`Provenance.agentContext` 是 jsonb 列（无 PG schema migration），4 个新字段全部 optional 不破现有 callers。

**新字段**（`packages/schema/src/provenance.ts`）：

- `actualIterations?: number` — coordinator loop 实际迭代数（1=single-shot，>1=multi-step）
- `promptTokens?: number` — 该 provenance row 计费的 input tokens
- `completionTokens?: number` — 计费的 completion tokens
- `retries?: RetryRecord[]` — 单条 tool-call 内的 exponential-backoff 重试记录（§2.5 cap 3 次）

**新接口 `RetryRecord`**：

```ts
interface RetryRecord {
  attempt: number;                    // 1-based
  errorClass: string;                 // 'rate-limit' | '5xx' | 'tool-call-malformed' | ...
  errorMessage?: string;
  delayedMs: number;                  // backoff applied before this retry
  occurredAt: IsoDateTime;
}
```

**为什么不加 PG 列**：`Provenance.agentContext` 已经是 jsonb。jsonb schemaless，加字段零 DDL 开销，反序列化为 TS interface 全程类型校验。如 Phase 6+ 需要把这些字段索引（e.g. "top 10 agents by promptTokens last week"），单独抽 SQL 列。

**Producer 填充**：当前 8 个 callers（agent-runner mock + 3 ModelProvider adapter ollama/openai-compat/custom-http + 2 prototype + provenance-writer + types.ts）全部走旧 minimal shape；Wave B/D 真 reviewer/researcher LLM round-trip 时由 Anthropic SDK `response.usage` 块填充。Phase 5 W4-W7 stub 真化前不需要补回填。

**5 contract tests**（`packages/ai-runtime/tests/agent-execution-context-contract.test.ts`）：minimal Phase 1-4 shape + populated A3 shape + JSON 序列化 roundtrip 无损 + RetryRecord minimal/empty-array。

### Phase 5 Wave A A4 — AgentTimeline 父子树视图（2026-05-11）

补 improvement-plan §五 A4 承诺。AgentTimeline 让用户看见"coordinator dispatched 5 sub-jobs"的整个树，是 Wave A dogfood gate 可见验收物。

**Pure tree builder** (`apps/web/src/lib/agent-timeline.ts`)：

- `buildTimelineTree({jobs, events, rootJobId})` → `{root, orphans}` BFS 装配，jobsById Map + childrenByParent Map + visited Set 防 cycle
- Orphan 检测两路径：(a) parentJobId 指向 missing job (b) parentJobId=null 但非 root
- Children 按 `startedAt` ASC 排序（null → Infinity 排尾，新加未跑的 job 不挤前面）
- Events 按 `id` ASC（bigserial = emit order）
- Rollup helper：`totalCostUsdMilli` / `countDescendants` / `classifyJobStatus`（cancelling→in-progress 因 worker 未确认，unknown→error 默认）

**GET /api/agent/job/[jobId]/tree**：根 row 存在性校验 → BFS expand frontier 直到 `MAX_DESCENDANT_FAN_OUT=1024`（防 runaway coordinator OOM）→ inArray 拉所有 events → buildTimelineTree → 200 / 404 / 401。

**AgentTimeline.tsx**：'use client' + fetch tree + 4s poll（terminal status 自动停 poll）+ 节点 expand 看 event 载荷 + cancel button（queued|running 才显示，POST /cancel 后局部 refresh）+ MonoDisc / StatusPill / HairlineRule + 中英 bilingual label + accent ox 错误条 + Design.md tokens（reject grep 全 0）。

**14 测**（`apps/web/tests/agent-timeline.test.ts`）：root-only / 2-level dispatch / 3-level chain / startedAt 排序（null 排尾）/ orphan 两路径 / event bigserial 排序 / classifyJobStatus 6 status + unknown + cancelling 行为 / totalCost rollup / countDescendants 不含 root。

**Wave A 收尾**：A1-A4 commit 全交付；剩 reviewer/researcher 真 LLM round-trip 跑通（Wave B/D）+ A3 字段由真 invoke path 填充。

### Phase 5 ADR-0020 Triadic 影响 — Coordinator 双向 6 交互流（2026-05-12）

ADR-0020 §2.3 把 Coordinator 的工作模型从 "goal-driven multi-step
dispatcher"（本 ADR §2.2）扩到 **6 双向 InteractionMode 的 metabolic
orchestrator**：

| 模式 | Coordinator 行为 |
|---|---|
| hypothesis-output | Night → Bridge → Day 串接（已部分由 reviewer/coordinator 覆盖） |
| anomaly-input | Day → Night 反向 surface（新；maintenance scan finding 给 Explorer 推送 contradiction）|
| constraint-transfer | Day → Night（已知物理 / 经验数据约束新假设空间）|
| metaphor-bridge | Night → Bridge → Day（隐喻精化为 hypothesis-formalization）|
| question-return | Day → Night（resolution 衍生新 question）|
| method-transfer | 双向（跨域算法 / 直觉迁移）|

**Wave D-3 (`5c82f83`) 落地**：

- `withTriadicContext()` / `readTriadicContext()` / `TRIADIC_CONTEXT_KEY='triadic'`
  在 `packages/ai-runtime/src/provenance-writer.ts`。jsonb 侧通道（不动
  PG 表）让任何 AgentProposal 可携带 InteractionMode + CrossLayerReference[]，
  Coordinator dispatch 时记录"这次 dispatch 跨了哪个交互流"。
- 空 crossLayerReferences 写时拒（anti-pollution）；Phase 1-4 老行无
  `triadic` key 读为 undefined（向后兼容）。

**对 §2.2 multi-step dispatch loop 的影响**：

- `runCoordinatorLoop` 当前仍按 ADR-0008 W3 实现（单向 sync + async 混合 +
  `[final]` 终止）；**Wave D 阶段不改 dispatch core**。
- Phase 6 follow-up ADR 才考虑：(a) coordinator decision 加 interaction-mode
  字段（决定本步走哪种交互流）+ (b) Wave D-4 `/triadic/network` surface 真接 PG
  count（`countReferencesByMode`）。

**对 §2.4 quota / cancel / 可中断的影响**：无。Triadic context 是 metadata
扩展，不引入新可中断点 / quota 维度（每次 invoke 仍按 (principal, kind)
分区计 quota）。

**Evidence Tier**：本节 Triadic 部分 `contract`（jsonb 侧通道 + 8 单测）；
真 Coordinator 6-mode dispatch 在 Wave D-5 / Phase 6 升 `mixed` → `real`。

### Phase 6 W2 ADR-0017 — Two-tier agent runtime (client + open-server)（2026-05-12）

ADR-0017 client-first runtime（`b3df724` Proposed）把本 ADR §2.2 single
server agent runtime 扩为 **two-tier**：

| 维度 | client-side (`packages/ai-runtime-client/` Phase 6 W9-W10) | server-side (`apps/open-agent-worker/` renamed from agent-worker) |
|---|---|---|
| 服务对象 | private subdoc (visibility=private/inherit) | public/unlisted subdoc |
| Model provider | local ollama / BYO key（local-ollama 已 Spike-1 `98e3f30`） | server env API key（Anthropic / OpenAI / etc） |
| Plugin sandbox | WASM Extism + per-OS native（ADR-0019 hybrid） | bwrap（既有 ADR-0012） |
| Quota | per-vault local（不入 server） | server-side per-principal（Wave A A1，已 real） |
| Provenance | `.vault/provenance.log` ed25519-signed (ADR-0018) | PG `provenance` table（既有） |
| Dispatch routing | visibility-per-subdoc 前置闸（per ADR-0017 §2.4 F6） | 同左 |

**对本 ADR §2.2 multi-step dispatch loop 的影响**：runCoordinatorLoop
内核**不动**；前置加 visibility routing 决定本次 invoke 走 server 还是
client tier；两 tier 共享 plugin contract + ModelProvider interface
(`packages/ai-runtime-client/` 与 `packages/ai-runtime/` 接口同源，
运行时分叉)。

**对 §2.4 quota / cancel / 可中断的影响**：保留 + 复制到 client tier。
client tier 的 quota 计在本地 .vault/usage.sqlite（不入 server）+ cancel
通过 Tauri command；可中断模型与 server tier 同源。

**与 ADR-0020 Triadic Coordinator 6-mode 关系**：互不冲突。本 ADR §6
review log "Phase 5 ADR-0020 Triadic 影响" 描述的 6 InteractionMode 是
dispatch decision metadata；本 ADR Phase 6 review log 描述的 two-tier
是 dispatch destination split。Coordinator decision 既携带
interaction-mode 又走 visibility routing。

**Evidence Tier**：`contract`（接口契约 + Spike-1 客户端 ollama PoC
real，但 reviewer/researcher 真 LLM round-trip 仍 mock）；Phase 6 W9-W10
两 tier 真接入后升 `mixed` → `real`。

**实证 commit hash**：`b3df724` (ADR-0017 Proposed) + Spike-1 `98e3f30`
inline AI toggle + apps/web/src/lib/local-ollama.ts。
