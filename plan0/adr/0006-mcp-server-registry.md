# ADR-0006: MCP server 注册表 + 发现 + 生命周期 + capability gating

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 2 W1
- **Deciders**: tech-lead
- **Gated on**: Phase 2 W3 dogfood gate（与 ADR-0010 同步）；本 ADR 与
  ADR-0010 §2.5 plugin 安装流程协调，MCP server 是 4 类 plugin 之一

---

## 1. Context

### 1.1 现状（review-project-goals-TpFuH 诊断）

Phase 1 D13 + Phase 1.5 #6 落地了：

- `mcp-servers/crossref/`（real stdio MCP server，HTTPS https://api.crossref.org）
- `mcp-servers/crossref-mock/`（in-memory，CI / 离线 demo）
- `packages/ai-runtime/src/mcp-client.ts` 维护 `McpServerSet`（per-invocation）
- `packages/ai-runtime/src/transports.ts` 提供 `inMemoryServerTransport` +
  `stdioServerTransport` 工厂

但**注册/发现/生命周期都是 ad-hoc**：

- `apps/web` 路由读 `CROSSREF_MCP_COMMAND/ARGS/CWD` 环境变量构造 spec —
  无法承载多个 MCP server，更不能让用户挂自己的
- `McpServerSpec` 由 caller 当场构造，没有"哪些 MCP 已安装、当前可用、
  健康状况如何"的全局视图
- skill `allowed_mcp_servers: [crossref]` 只是 SKILL.md frontmatter，
  **运行时没有 enforcement** — 如果 caller 误传一个 spec id 不在 allow
  list 内，没人挡
- 失败行为不一致：stdio process 启动失败时调 caller 抛；HTTP MCP server
  Phase 2 还没定义（Phase 3 才用）
- ADR-0010 §2.2 把 MCP Server 列为 plugin 4 类之一 — 本 ADR 把它具体化

### 1.2 哲学约束（user 2026-05-09）

1. **平台性** → 用户 Phase 3 能挂自己 MCP server（Zotero / 本地文件 /
   私有数据库 / 实验室设备）；Phase 2 必须把这条路径**预留**好，不留 ad-hoc 债
2. **避免过多兼容性** → 不为存量 npm-based MCP package / non-stdio 协议
   写兼容层；仅支持 MCP 官方 SDK 的 transport（stdio / http-sse）
3. **新技术** → http-sse 是 MCP 2024 spec 的远端协议，Phase 3 评估；
   stdio 是 Phase 2 默认

---

## 2. Decision

### 2.1 注册表存储：**PG `mcp_server` 表 + `mcp-servers/registry.json` 启动 seed**

| 角色 | 实现 |
|---|---|
| **Source of truth** | PG `mcp_server` 表（content-addressable，有 `installed_by` 用户字段） |
| **Built-in seed** | `mcp-servers/registry.json`（项目内置 MCP 列表，第一次启动时 import） |
| **运行时缓存** | ai-runtime 启动时全表扫一次 + listen NOTIFY `mcp_server_changed` 触发刷新 |

**rejected**: 纯静态 JSON（不能让用户安装）/ 纯 PG（开发体验差，built-in seed
难维护）。

**`mcp_server` 表 schema**（PG，新 migration）：

```ts
mcp_server: {
  id: text (pk),                     // e.g. "crossref" / "@anthropic/zotero"
  version: text,                      // SemVer
  transport: enum('stdio', 'http', 'http-sse'),
  command: text[],                    // stdio 时；e.g. ['tsx', 'mcp-servers/crossref/src/bin.ts']
  args: text[],                       // 显式 args（即使 command 已含也分开，便于覆盖）
  cwd: text,                          // 可选
  url: text,                          // http/http-sse 时
  env_vars_required: text[],          // e.g. ['CROSSREF_API_KEY']（启动时校验存在性）
  declares_tools: text[],             // 静态声明，install 时校验，运行时再 cross-check
  required_capabilities: text[],      // ADR-0002 词汇；调 MCP 时检查 caller 有哪些
  origin: enum('built-in', 'user', 'team'),
  installed_by: principal_id (nullable),
  installed_at: timestamptz,
  enabled: boolean default true,
  health_status: enum('unknown','healthy','degraded','failed') default 'unknown',
  last_health_check_at: timestamptz,
}
```

**migration 顺序**：先建表，seed `mcp-servers/registry.json`（含 crossref +
crossref-mock），再砍 env-var 路径。

### 2.2 Skill ↔ MCP 运行时绑定

**当前**: skill `allowed_mcp_servers: [crossref]` 只是 metadata，无 enforcement。

**Phase 2**: ai-runtime invocation 时三步验证：

1. 加载 skill set（per ADR-0010 §2.4 dispatch）→ 合并 `allowed_mcp_servers` 求并集
2. 查 `mcp_server` 表交集（`enabled=true AND id IN (union)`）→ 这是 MCP `allow set`
3. 构造 `McpServerSet` 时只用 allow set 的 spec；试图调集合外的 server → 运行时
   抛 `McpAccessDenied` + 写 provenance（actor=agent，denied_capability）

**capability 进一步约束**：MCP server `required_capabilities` 字段如包
`network.fetch:domains`，agent 调用前必须有该 capability grant；网关层
（per ADR-0002 §2.4）已支持，本 ADR 不增新机制。

### 2.3 生命周期：stdio per-invocation spawn vs process pool

**Phase 2**：**per-invocation spawn**（与 Phase 1 一致）

- agent invocation 开始 → spawn stdio child → connect MCP client → call
  tools → invocation 结束 → child 退出
- **不**做 process pool（Phase 3 评估）—— 理由：
  - 单 invocation 通常 < 30s，spawn 开销 < 200ms 可接受（user 哲学：避
    免过度兼容性投入）
  - pool 引入 stale-state / leak / cross-invocation 安全问题
  - Phase 3 实测瓶颈再加

**HTTP MCP server**：keep-alive HTTP client，per-invocation 连接池由
`@modelcontextprotocol/sdk` 处理；本 ADR 不细化（Phase 3 重点）。

### 2.4 Health check + degradation

**Health check 策略**（每个 enabled MCP server）：

- **被动**：每次 invocation 失败时更新 `health_status='degraded'` + 增计
  `consecutive_failures`，连续 3 次 → `failed`
- **主动**：sync-gateway 启动 + 每小时 cron 走 MCP `tools/list` ping →
  成功 `healthy`，失败 `degraded`/`failed`
- **UI 暴露**：apps/web `/admin/mcp` 列表（P2，仅 admin role）；agent
  invocation 时如某 MCP `failed`，**该次调用不阻塞** — 走"该 MCP 不可用"
  分支，agent 用其他 MCP（例如 crossref failed → fall through to
  semantic-scholar），并在 provenance 写 `degraded_servers[]`

**反模式排除**：不做"自动 retry MCP server 重启"（Phase 1 stdio 是
per-invocation 一次性，没有重启概念）；HTTP MCP server failed 时也不重连，
留给运维。

### 2.5 用户安装 MCP（Phase 2 仅打地基）

**Phase 2 实现**：API / CLI 接口存在但**仅 admin role 可调**（普通用户不能装）：

```
POST /api/mcp-server/install
  body: { source: 'git-url' | 'registry-id', url: '...', accept_capabilities: [...] }
  → server validates capability declarations subset of caller's role bundle
  → INSERT mcp_server with origin='user' or 'team', installed_by=caller
  → seed health check
```

**Phase 3 才开放给普通 user role**——届时需要：
- Sandbox 强化（user-supplied stdio process 的 OS 隔离 / cgroup / seccomp）
- Capability 提示 UI（用户能看到该 MCP 要什么权限，对应 system-prompt
  §六.6.7 安全模型）
- 跨设备同步（用户在 desktop / web 都能用同一个 MCP）

**Phase 2 不做**：marketplace、自动更新、签名验证、多版本并存。

### 2.6 与 ADR-0010 plugin 系统的关系

MCP server 作为 plugin 4 类之一（ADR-0010 §2.2），**两套机制对齐**：

| 维度 | ADR-0010 通用 | ADR-0006 MCP 特化 |
|---|---|---|
| Manifest | plugin.yaml | mcp-server.yaml（`type: mcp-server`）+ `mcp_server` PG 表 |
| 安装 | Git URL → `~/.platform/plugins/<id>/` | Git URL → `~/.platform/mcp-servers/<id>/` + INSERT 表 |
| 加载 | ai-runtime plugin loader | ai-runtime mcp-client（已有） |
| Capability | manifest `required_capabilities` | 同 + 运行时 skill `allowed_mcp_servers` 二次校验 |
| Sandbox | 4 种（Skill/Agent/MCP/UI） | 进程隔离（OS 边界，Phase 3 加 OS 沙箱） |

**实施层面**：plugin loader（ADR-0010 W1 末骨架）在加载 MCP plugin 时，
**调本 ADR 定义的 mcp-client 注册流程**——ADR-0006 是 ADR-0010 §2.5 的
"specialized branch for MCP"。

### 2.7 迁移：env-var → 注册表

Phase 1.5 的 `CROSSREF_MCP_COMMAND/ARGS/CWD` 环境变量路径在 Phase 2 W2 砍：

1. W1：建 `mcp_server` 表 migration + seed `mcp-servers/registry.json`
   （crossref + crossref-mock 两条记录）
2. W2：apps/web `/api/agent/invoke` 改读注册表，env-var 路径仅在 dev mode
   保留作为 override（标 deprecated，Phase 3 删）
3. W3：dogfood gate 一并验证 MCP plugin 加载与 hardcode env-var 路径行为
   一致（per ADR-0010 §2.7）

---

## 3. Consequences

### 3.1 正面

- 用户/团队 Phase 3 挂自己 MCP server 不用回头改 ai-runtime
- skill `allowed_mcp_servers` 真正 enforce，agent 越权调 MCP 被拒
- health-degraded MCP 不阻塞 agent，agent 能 fallback 到其他 server
  （agent prompt 需感知 degraded 列表 — Phase 2 W2 落实）
- `mcp_server` 表的 `origin / installed_by / installed_at` 给 audit log
  + 治理打基础

### 3.2 负面

- 多 1 张 PG 表 + 1 个 migration（与 Phase 1 D7 加表方式一致）
- env-var fallback 砍掉前需用户在 SELF_HOST.md 文档 + 1 条 migration note
  指导
- per-invocation spawn 在大并发场景（>10 agent invocations/sec）会成瓶颈
  → Phase 3 评估 process pool

### 3.3 长期债

- HTTP / http-sse MCP transport 的细节（连接池、auth、重试）推 Phase 3
- User-installed MCP 的 OS 沙箱推 Phase 3
- 跨设备 MCP 同步推 Phase 4

---

## 4. Alternatives considered

### 4.1 纯静态 JSON 注册表（rejected）

`mcp-servers/registry.json` 编辑后重启 ai-runtime 生效。
**拒绝原因**：(a) 用户安装路径不通；(b) `installed_by` / `health_status`
等运行时字段写文件容易竞态；(c) 不能 join 其他 PG 表（principal /
capability_grant）做权限决策。

### 4.2 把 MCP 注册放进 ADR-0010 通用 plugin 表（rejected）

**拒绝原因**：MCP 有特殊字段（transport / command / declares_tools /
health_status），通用表会变成"宽表 + 大量 NULL"。两表分开，通过 `plugin_id`
软外键关联（plugin 表存 plugin metadata，mcp_server 表存 MCP-specific 字段）。

### 4.3 本 ADR 一并定义 HTTP/http-sse 协议细节（rejected）

**拒绝原因**：Phase 2 实际只需要 stdio + in-memory（内置 mock）。HTTP
是 Phase 3 用户挂远端 MCP 时的事，届时再 ADR-0006 review log 加内容或
开 ADR-0011。**user 哲学：避免过多兼容性投入。**

### 4.4 让 skill 直接挂 MCP（不通过 ai-runtime mcp-client）（rejected）

**拒绝原因**：(a) 破坏 ai-runtime 是 MCP 唯一 owner 的简化；(b) skill 是
数据 only（ADR-0010 §2.6），不应执行 transport；(c) provenance
`toolCalls[]` 当前由 ai-runtime 写，绕开它就丢 audit。

---

## 5. Open questions（W1 实施时落实）

- **`mcp_server` 表名是 `mcp_server` 还是 `mcp_server_registry`**：倾向
  `mcp_server`（表名表示一行=一个 MCP server，复数语义在 SQL 不必要）
- **registry.json seed 时机**：每次 `pnpm db:migrate` 末尾还是独立
  `pnpm mcp:seed`？倾向独立命令，与 db:seed 同节奏
- **Health check cron 谁跑**：sync-gateway 进程内还是 snapshot-worker？
  倾向 snapshot-worker（已是周期任务 owner）
- **degraded 列表怎么注入 agent prompt**：在 agent invocation context 加
  `degraded_mcp_servers: ['crossref']`，prompt 里指引"crossref 当前不可用，
  改用 semantic-scholar"——具体 prompt 模板 W2 实施时落

---

## 6. 与其他 ADR 的关系

- **ADR-0001（数据模型）**：`mcp_server` 是新表，但不是 8 实体之一（是
  infra 表，与 `prompt_template` 同类）；schema review log 加注
- **ADR-0002（权限模型）**：本 ADR §2.5 admin-only install 用 ADR-0002
  的 `mcp.install` capability（**新增**，Phase 2 加进 36 词汇 → 37）
- **ADR-0003（技术栈）**：与 `@modelcontextprotocol/sdk` Node 实现绑定；
  WASI / 浏览器 MCP 推 Phase 3
- **ADR-0004（部署）**：MCP stdio 子进程的资源限制（CPU / mem / 时长）
  在 ADR-0004 §2.7 quota 框架内；本 ADR 不重述
- **ADR-0008（long-horizon agent）**：reviewer / research agent 可能调
  数十次 MCP，per-invocation spawn 性能成本要在 W3 spike 时实测
- **ADR-0010（扩展系统）**：MCP server 是 plugin 4 类之一；本 ADR 是
  ADR-0010 §2.5 install flow 的 MCP 特化分支

---

## 7. Review log

（W3 dogfood gate 后填；预期内容：(a) MCP plugin 路径与 env-var 路径
行为一致性测试结果；(b) per-invocation spawn 在 reviewer agent
（ADR-0008 异步长任务）下的实测开销；(c) `mcp.install` capability 是
否进入 ADR-0002 词汇正式版；(d) §5 open questions 答案）
