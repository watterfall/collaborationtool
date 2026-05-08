# Phase 1 计划 · 协作论文平台两人 MVP

> Phase 0 已 6/6 交付（D1–D6 + 综合报告 + dual-tab 自动化解锁 ADR-0001 → Accepted）。本计划把 Phase 0 的图纸变成"两位用户在自托管 staging 写一篇双语论文、AI 帮核查引用、能导出投稿格式"的可用产品。

> Phase 1 的核心承诺：**Phase 0 锁定的 8 实体 schema + 36 capability + 双管线渲染 + Provenance 闭环全部在生产代码里跑起来，不重写、不打折**。

---

## 一、Context · Phase 0 → Phase 1 衔接

### 已完成（继承）

- **ADR-0001（数据模型）** — Accepted；8 实体 schema verbatim 在 `packages/schema/src/*.ts`
- **ADR-0002（权限模型）** — Proposed；36 capability + 5 default role + 3 Phase 3 场景走查
- **ADR-0003（技术栈锁定）** — Proposed（§3 双管线渲染 Accepted）；11 项决策 + 回头 trigger
- **三个原型实证**：
  - proto-a：y-prosemirror 异构 schema → CRDT 收敛 PASS / 双 tab Playwright 自动化 3/3 PASS / 0 warnings
  - proto-b：MyST vs Typst CJK → Typst 印刷胜出（115 KB / <1s / 0 warning vs mystmd LaTeX 远端 fragile）
  - proto-c：MCP + Skill + Provenance → 端到端闭环 / Provenance 全字段命中 / Skill progressive disclosure
- **综合报告**：`plan0/prototypes-report.md`（H1–H5 答案 + 12 个已知 Phase 1 工作项）

### Phase 1 范围边界（用户已确认）

- **AI 闭环**：Inline 改写 + Citation Agent 单 DOI 核查；**不做** 全文异步 agent / Reviewer Agent / Research Agent
- **Local-first 硬度**：IndexedDB 持久化 + Yjs WebSocket 同步必需；**不是** 纯 P2P / 云优先
- **协作规模**：两人深度共写（论文）；50 人开放评审是 Phase 3
- **章节级隔离**：**不做**（ADR-0002 §2.4 已记录为 Phase 3 升级路径，Phase 1 网关连接级即可）
- **fork/merge UI**：**不做**（Document.forkedFrom* 字段加在 schema，UI 留 Phase 3）

### Phase 1 验收的"产品级"标准（与 Phase 0 不同）

Phase 0 是"图纸验证"，所以验收用 prototype + ADR；Phase 1 起进入**生产代码**。
判据切换：

| 维度 | Phase 0 | Phase 1 |
|---|---|---|
| 代码 | 抛弃式 prototype | 持续维护的 packages/apps |
| 测试 | 手动 + stress test | 单元 ≥70% / E2E 覆盖 critical path / CI 全过 |
| 部署 | 本地 dev only | 至少 1 个 staging（自托管 or Vercel） |
| 安全 | demo 不查 capability | gateway 强制 capability 检查 / better-auth signed JWT |
| 文档 | findings.md | API 文档 + ADR 升 Accepted + 用户级 README |

---

## 二、Phase 1 关键设计决策

### 2.1 继承自 Phase 0 的决策（不重新讨论）

参考 ADR-0001 / 0002 / 0003 + `prototypes-report.md §1`。本节只列**Phase 1 必须落地实施**的部分：

| 决策 | Phase 1 实施位置 |
|---|---|
| Y.Doc-as-tree + PG-as-graph | `packages/editor-core` + Drizzle migrations |
| Hybrid Provenance（Y.Map in-flight + PG committed） | `packages/ai-runtime` + `apps/sync-gateway` commit hook |
| 36 capability 词汇 + Principal 前缀编码 | `packages/permissions/src/capabilities.ts`（常量）+ JWT subject |
| 5 default role bundle | `packages/permissions/src/roles.ts` |
| 双管线渲染（MyST web/Word/JATS + Typst 印刷） | `packages/render-myst` + `packages/render-typst` |
| TipTap + ProseMirror + y-prosemirror | `packages/editor-core`（从 proto-a 提炼） |
| Next.js 15 App Router | `apps/web` |
| y-sweet 自托管 + S3-compat | `infra/docker/y-sweet` + R2/MinIO |
| better-auth + organization plugin | `apps/web` route + Principal bridge |
| Postgres + Drizzle ORM | `infra/drizzle/migrations/*` |
| Server-default Agent runtime | `packages/ai-runtime`（Vercel function） |
| MCP server 服务端代理 | `mcp-servers/*` Node 进程 + `packages/ai-runtime/mcp-client` |

### 2.2 Phase 1 新增决策（待写 ADR）

#### ADR-0004 · 部署拓扑 + 安全基线（Phase 1 Week 1 起草）

**待答**：
- 部署 target：纯 self-hosted docker-compose / Vercel + Neon + R2 / 混合？
- TLS：Caddy / Traefik / Cloudflare 前置？
- JWT 签发：better-auth 内置 / 单独 issuer？
- WebSocket 鉴权：cookie / Bearer query string？
- MCP server 间的鉴权（platform → CrossRef / Zotero）：API key 怎么管理 + rotate？
- Sentry / 日志：Phase 1 起开启还是 Phase 1.5？

#### ADR-0005 · 编辑器与渲染器之间的 API 边界（Phase 1 Week 3 起草）

**待答**：
- `packages/editor-core` 暴露什么类型给 `packages/render-*`？（PM tree / Y.Doc 序列化 / packages/schema BlockShape）
- 渲染是流式（每段 incremental）还是全文（导出时一次性）？
- 公式 LaTeX 字符串作为唯一 source of truth；renderer 各自转 KaTeX / MathML / Typst math
- 引用（citation-ref atom）的元数据从哪来：editor 嵌入 CSL-JSON 还是 export 时再 join PG？
- Phase 2 加 reactive Marimo cell 时如何不破坏边界

#### ADR-0006 · MCP server 注册与发现（Phase 1 Week 4 起草，可推 Phase 2 起草）

**待答**：
- MCP server 注册表存哪？（PG `mcp_server` 表 / 静态 `mcp-servers/registry.json`）
- 用户挂自己的 MCP（Phase 3）的 capability 是 `agent.invoke:custom`，鉴权流程
- skill ↔ allowedMcpServers 的运行时校验

### 2.3 Phase 1 不写 ADR 的细节决策（直接写在代码注释 / commit message）

- UI 组件库：shadcn/ui（已在 ADR-0003 隐含），Tailwind v4
- 状态管理：Zustand 局部 + URL state
- TanStack Query 服务端状态
- 路由结构：app/auth/* / app/docs/* / app/editor/[docId]/*
- 图标：lucide-react

---

## 三、Phase 1 交付物（10 项，按依赖排序）

| # | 交付物 | 工作量 | 关键路径 | 依赖 |
|---|--------|------|---------|------|
| D7  | Postgres + Drizzle schema + migrations（含 Phase 1 字段补充） | 2 天 | ✅ | ADR-0001 |
| D8  | `packages/permissions` + `apps/sync-gateway` shim | 3 天 | ✅ | ADR-0002 / D7 |
| D9  | `apps/web` Next.js 15 skeleton + better-auth + Principal bridge | 3 天 | ✅ | D7 / D8 |
| D10 | `packages/editor-core`（从 proto-a 提炼）+ Y.Doc snapshot worker | 4 天 | ✅ | proto-a / D7 |
| D11 | y-sweet 自托管 + S3-compat 持久化 + 网关↔y-sweet 链路 | 2 天 | ✅ | D8 / D10 |
| D12 | `packages/render-{myst, typst, typography}` + `templates/myst/` 镜像 | 4 天 | — | D10（与 D13 并行） |
| D13 | `mcp-servers/crossref` 真实 + `packages/ai-runtime` + Citation Agent + Inline Editor Agent | 5 天 | ✅ | D8 / D10 |
| D14 | Approval flow UI + commit boundary Provenance 写入（前后端联通） | 3 天 | ✅ | D10 / D13 |
| D15 | 两人协作 E2E（Playwright）+ 双语 demo 文档样张 + 投稿格式导出 | 3 天 | ✅ | D9–D14 |
| D16 | ADR-0004（部署）+ ADR-0005（render API）+ ADR-0001/0002/0003 升 Accepted + Phase 2 plan stub | 1.5 天 | ✅ | All |

**总工作量**：串行 ~30.5 天；D12 与 D13 并行后 ~25 天（单人全职 ~5 周）。

**预算守门点**：
- Week 3 末检查 D7–D11 是否完成；超出原计划 30% 立刻砍 D15 的"投稿格式"或"双语样张"中的一项
- Week 4 末若 D12/D13 任一翻车，先把另一个收尾，把翻车的退到 prototype 验证再实施
- D16 不可砍——Phase 2 plan 存在的目的是让 Phase 1 不留尾巴

---

### D7 · Postgres + Drizzle schema + migrations

**目标**：把 ADR-0001 的 8 实体 + 关联表用 Drizzle 落到 Postgres，能起 docker-compose、能跑 migration、能在 sandbox 写读 row。

**输入**：ADR-0001 §2.3 全部 TS 形状 + ADR-0002 §2.5 Mermaid ER 图 + ADR-0003 §2.7 Drizzle 选型

**输出**：
- `infra/docker/docker-compose.yml`（Postgres 16 + MinIO + y-sweet 占位）
- `infra/drizzle/schema.ts`（10+ 表：document / block_metadata / citation / annotation_thread / annotation_comment / revision / contribution / provenance / agent / principal / capability_grant / document_acl / prompt_template）
- `infra/drizzle/migrations/0001_initial.sql`
- `infra/drizzle/seed.ts`（基础 system principal + 1 个 demo user 的 fixtures）
- 单元测试：`infra/drizzle/tests/*.test.ts`（每张表 insert/select round-trip）

**Phase 1 字段补充（来自原型 / 走查）**：
- `Document.forkedFromContributionId?` / `Document.forkedFromDocumentId?`（场景 C）
- `prompt_template` 表（ADR-0003 §2.5）：id / version / hash / immutable body
- `document_acl`（ADR-0002 §2.5）：物化 capability bundle，trigger 从 capability_grant 同步

**验收**：
- docker-compose up 一键起 Postgres
- Drizzle migrate 跑通 + seed 跑通
- 每张表至少 1 个 round-trip test 过
- Schema diff 与 ADR-0001 §2.3 对齐（CI 用 `drizzle-kit introspect` 比对）

**失败模式**：bytea 大字段（Y.Doc binary）影响表设计；提前做 1 GB 文档测试

---

### D8 · `packages/permissions` + `apps/sync-gateway` shim

**目标**：把 ADR-0002 的 capability 检查器 + 网关 shim 落到能跑的代码。Phase 1 网关连接级鉴权（已知 limitation），但 shim 接口必须为 Phase 3 节点级留出。

**输入**：ADR-0002 §2.1（36 词汇）/ §2.2（5 role）/ §2.4（网关执行策略）

**输出**：
- `packages/permissions/src/capabilities.ts`（36 条 capability 字符串常量；导出 `Capability` enum + `RESOURCE_TYPES` enum）
- `packages/permissions/src/roles.ts`（5 个 default role bundle）
- `packages/permissions/src/checker.ts`（`canApplyUpdate(principalId, documentId, update) → boolean`）
- `packages/permissions/src/jwt.ts`（签发 + 校验，对接 better-auth）
- `apps/sync-gateway/src/server.ts`（WebSocket server，y-sweet 之前的 shim）
- `apps/sync-gateway/src/auth.ts`（JWT verify + capability load + connection mode classify）
- `apps/sync-gateway/src/capability-gate.ts`（按 connection mode 过滤 Y.Doc update：reader / proposer / writer）
- 单元测试：每个 role 的 capability bundle / 每个 capability 的检查
- E2E 测试：reader 客户端尝试写入被拒；writer 客户端写入成功

**验收**：
- 36 capability 没有 string literal 出现在 `packages/permissions` 之外的代码
- gateway shim 接口稳定（Phase 3 升级是替换实现，不加新概念）
- E2E 三种 role（reader / proposer / writer）行为一致

**失败模式**：
- y-sweet 透明代理 vs gateway 解析 Yjs update 的兼容（gateway 必须能 inspect update 找出 affected blockIds）
- `expiresAt` 检查频率：连接握手时 + 60s 心跳重检（ADR-0002 §4 已记录）

---

### D9 · `apps/web` Next.js 15 skeleton + better-auth + Principal bridge

**目标**：把 Next.js 15 主应用搭起，用户能 signup/login/创建 organization；user 的 Principal 在 PG 里同步。

**输入**：ADR-0003 §2.4（better-auth）+ D7（Principal 表）

**输出**：
- `apps/web/package.json` + `next.config.ts`
- `apps/web/src/app/layout.tsx` + `globals.css`（Tailwind v4）
- `apps/web/src/app/(auth)/signup/page.tsx` / `(auth)/login/page.tsx`
- `apps/web/src/lib/auth.ts`（better-auth 配置，含 `organization` plugin）
- `apps/web/src/lib/principal-bridge.ts`（better-auth user 创建时 trigger → 写 Principal row）
- `apps/web/src/app/(app)/docs/page.tsx`（docs 列表，简最小版）
- `apps/web/src/app/(app)/docs/new/page.tsx`（创建文档）
- `apps/web/src/app/api/auth/[...all]/route.ts`（better-auth handler）
- `apps/web/middleware.ts`（路由守卫）

**验收**：
- 新用户 signup 后 PG 里有 `principal { kind:'user', principalId:'user:<uuidv7>' }`
- user 创建 organization → org 也有对应 Principal kind='org'（如果 ADR-0002 没列 'org'，加为新 kind）
- 登录后能看到 docs 列表

**失败模式**：
- better-auth v1.x API 不稳 → 锁版本 + 准备 Auth.js fallback（已在 ADR-0003 §2.4）
- organization plugin 与 Principal 抽象不完全对齐 → bridge layer 处理；不要直接用 better-auth 的 organization id 当 PrincipalId

**Phase 1 范围限定**：
- 不实施 OAuth provider（Google / ORCID 推 Phase 1.5）
- 不实施 invitation flow（Phase 1.5）
- 不实施 password reset（Phase 1.5）
- email + password + organization owner 切换够了

---

### D10 · `packages/editor-core` + Y.Doc snapshot worker

**目标**：把 proto-a 的 9 个 PM extension 提取成生产 package，加上 Y.Doc → Postgres 周期 snapshot worker。

**输入**：proto-a 全部代码 + ADR-0001 §2.6（commit boundary）+ proto-c findings §1（PM steps payload Phase 1 落实）

**输出**：
- `packages/editor-core/src/extensions/{equation, inline-equation, citation-ref, dataset-ref, computational-cell, annotation-anchor, figure, footnote-ref}.ts`
- `packages/editor-core/src/schema.ts`（所有 extension 的 PM schema 总装）
- `packages/editor-core/src/sync/setup.ts`（替换 proto-a 的 setup-sync.ts，对接 sync-gateway 而非 webrtc）
- `packages/editor-core/src/commit.ts`（PM steps 序列化 + Y.Doc state vector + Provenance commit boundary）
- `packages/editor-core/src/utils/ids.ts`（uuidv7 newBlockId）
- `apps/web/src/app/(app)/editor/[docId]/page.tsx`（消费 editor-core 的 Editor 组件）
- `apps/snapshot-worker/`（独立小 service，每 N 分钟读 Y.Doc binary 写 PG document.yjs_doc_binary）
- 单元测试：每个 extension 的 PM schema validate / 序列化 round-trip
- E2E 测试：迁移 proto-a 的 Playwright dual-tab cases 到 editor-core 上重跑

**验收**：
- proto-a 的 3 个 dual-tab cases 在 editor-core 上重跑全 PASS
- PM step + Y.Doc state vector 序列化能 round-trip（写 PG bytea → 读出 → reconstruct PM doc）
- snapshot worker 在 docker-compose 中跑，PG row 周期更新
- proto-a 目录在 D10 完成后**保留作为 reference**，不删（Phase 0 反模式 §10 写过"保留 findings 不保留 prototype"，但 Phase 1 D10 复用了 proto-a 代码，所以保留有依据）

**失败模式**：
- TipTap extension API 在 v3 升级时不兼容 → 锁 v2 版本
- y-prosemirror schema-recovery 在生产文档（更复杂）触发 → log + alert + 大量 e2e 覆盖

---

### D11 · y-sweet 自托管 + S3-compat 持久化

**目标**：替换 proto-a 的 sync-server.mjs（开发用 y-websocket relay）为生产级 y-sweet。

**输入**：ADR-0003 §2.3（y-sweet）+ §2.6（持久化三层）

**输出**：
- `infra/docker/y-sweet/` Dockerfile + 配置（持久化到 MinIO 本地 / R2 生产）
- `apps/sync-gateway/src/y-sweet-proxy.ts`（gateway 鉴权后 proxy 给 y-sweet）
- `infra/docker/docker-compose.yml` 加入 y-sweet + MinIO
- `apps/snapshot-worker/src/sync.ts`（从 y-sweet S3 binary 同步到 PG bytea）
- 集成测试：起 docker-compose → web 客户端连接 → 编辑 → 关浏览器 → 重开看到上次内容

**验收**：
- 本地 docker-compose 一键 reproducible
- 文档级 token 由 sync-gateway 签发，y-sweet 接受
- 客户端断网重连数据无损（IndexedDB → reconnect → S3 → PG snapshot 三层闭环）

**失败模式**：
- y-sweet rust binary 与本地 musl/glibc 不兼容 → docker 解决
- S3-compat 跨 endpoint 偏差（MinIO vs R2 vs Tigris）→ 用 AWS SDK v3，配置 endpoint 即可

---

### D12 · `packages/render-{myst, typst, typography}` + `templates/myst/`

**目标**：把 proto-b 的 D4 决策落地：MyST 出 web/Word/JATS，Typst 出印刷 PDF，CJK pre-pass 处理 mystmd 缺口。

**输入**：proto-b/findings.md（6 个具体发现 + 3 个 Phase 1 工程任务）

**输出**：
- `packages/render-myst/src/{ast-from-pm, html, word, jats, markdown}.ts`（PM tree → MyST AST，再 → 各格式）
- `packages/render-typst/src/{source-from-pm, compile}.ts`（PM tree → Typst source，调本地 typst CLI 或 typst.ts WASM）
- `packages/typography/src/{cjk-spacing, smart-quote-by-lang, font-tokens}.ts`（CJK pre-pass：标点挤压、smart-quote、font fallback chain）
- `templates/myst/{plain_latex, default_word, jats_journal}/`（mystmd templates 镜像，避开远端 registry）
- `apps/web/src/app/(app)/editor/[docId]/export/route.ts`（API endpoint，触发渲染）
- `apps/web/src/app/(app)/editor/[docId]/components/ExportDrawer.tsx`（UI 抽屉）
- 单元测试：每个 transformer 用 fixture（小段双语文档）验证输出
- 集成测试：proto-b 的双语 specimen 跑通 4 个格式（HTML/Word/JATS/PDF）

**验收**：
- 双语 specimen 4 个格式全输出无错；CJK 标点挤压、引号一致性可视化对比 baseline 正确
- 离线（无 api.mystmd.org）可跑（本地 templates）
- Typst PDF < 2s for 10 页文档

**失败模式**：
- typst.ts WASM bundle 太大（>10 MB） → 服务端 typst CLI 默认，WASM 留 Phase 2 在浏览器试
- mystmd Node API 不稳定 → CLI subprocess fallback

---

### D13 · `mcp-servers/crossref` 真实 + `packages/ai-runtime` + Citation Agent + Inline Editor Agent

**目标**：把 proto-c 的 D5 闭环升到生产代码，加上 Inline Editor Agent（agent.invoke:editor），两个 agent 都走 server-side runtime + Provenance 完整字段。

**输入**：proto-c/findings.md + ADR-0001 §2.3.7（Provenance）+ ADR-0002 §2.2 role 4/5（agent role）

**输出**：
- `mcp-servers/crossref/src/server.ts`（真实 https://api.crossref.org/works/{doi}）
- `mcp-servers/crossref-mock/`（已有，保留 CI / 离线 demo）
- `mcp-servers/zotero/src/server.ts`（OAuth flow + user-collection 拉取，**Phase 1 P1 推 Phase 1.5 如果时间不够**）
- `mcp-servers/arxiv/src/server.ts`
- `mcp-servers/semantic-scholar/src/server.ts`
- `packages/ai-runtime/src/{agent-runner, mcp-client, skills-loader, provenance-writer}.ts`（提炼 proto-c）
- `packages/ai-runtime/src/agents/{citation, inline-editor}.ts`（两个 Phase 1 agent）
- `apps/web/src/app/api/agent/invoke/route.ts`（接收前端 invoke + capability 检查 + 调 ai-runtime）
- `apps/web/src/app/(app)/editor/[docId]/components/AgentPanel.tsx`（侧边面板：触发 + 查看进度）
- `skills/inline-editor/SKILL.md`（新加）
- 单元测试：mock LLM + mock MCP，PromptHash + ToolCallHash + ProvenanceRow round-trip
- E2E 测试：用户选段落 → invoke citation agent → 看 propose → accept → PG provenance row + contribution row 都对

**验收**：
- 选 5 个 DOI 候选（含 typo）→ Citation Agent 正确 lookup + propose
- Inline Editor Agent 把 "这段不够正式" 改成 "更正式" → propose
- 每条 commit 在 PG provenance 表里字段全（actorPrincipalId / agentContext / inputBlockIds / toolCalls[]）
- agent 没 capability 时被网关拒（401）

**失败模式**：
- Anthropic API rate limit（生产）→ 退让 + 指数 backoff；Phase 1 起初不开放 unbounded invoke
- prompt_template 表第一次 commit 必须先存 immutable prompt（D7 schema 已加）

---

### D14 · Approval flow UI + commit boundary Provenance 联通

**目标**：proto-c demo 是 auto-accept，Phase 1 必须真 review UI（per ADR-0002 §2.2 role 2 paper-reviewer 走 propose）。

**输入**：D13 / ADR-0001 §2.5（commit boundary）/ ADR-0002 §2.2 role 2

**输出**：
- `apps/web/src/app/(app)/editor/[docId]/components/RevisionInbox.tsx`（待评审 Revision 列表）
- `apps/web/src/app/(app)/editor/[docId]/components/RevisionDiff.tsx`（diff 视图，PM steps 渲染前后对比）
- `apps/web/src/app/api/revision/[id]/accept/route.ts`（capability 检查：block.review or block.commit → acceptRevisionToContribution）
- `apps/web/src/app/api/revision/[id]/reject/route.ts`
- `apps/web/src/app/api/revision/[id]/modify/route.ts`（reviewer 提反提议，新 revision）
- `packages/editor-core/src/commit.ts`（D10 起手；D14 完成 Provenance 真实写入）
- E2E 测试：作者 A 创建文档；reviewer C invoke citation agent → revision；A 看到 revision；A accept → 文档变化 + provenance row 落库

**验收**：
- propose → review → accept 完整 round-trip 在 docker-compose 中跑通
- accept 失败时事务回滚（revision 不变 status='proposed'，provenance / contribution 不写）
- reject / modify 路径同样有测试

---

### D15 · 两人协作 E2E + 双语 demo + 投稿格式导出

**目标**：用 D7–D14 的所有件，把"两位用户写一篇双语论文 + AI 帮核查引用 + 导出投稿格式"端到端跑通。

**输入**：D7–D14

**输出**：
- `tests/e2e/two-author-mvp.spec.ts`（Playwright，两个 BrowserContext = 两个用户）
  - User A signup → 创建 doc → 邀请 User B（grant paper-author role）
  - 双方编辑：A 写中文段落，B 写英文段落
  - B invoke citation agent on 一段含 3 个 DOI 候选（含 typo）的段落
  - A 查看 revision → accept
  - A 点导出 → JATS + Word + PDF（Typst CJK + 拉丁）
  - 断言：CRDT 收敛 / Provenance row 4 个字段全 / PDF 文件 size > 0 / JATS 包含 `xml:lang="zh"`
- `apps/web/public/demo/specimen-bilingual.{md, json}`（提交样张：500 字中英混排，含 5 引用 / 1 公式 / 1 figure / 1 annotation）
- `docs/USER_GUIDE.md`（README 替代品；两人协作怎么用 / 导出 / agent 怎么唤起）
- `docs/SELF_HOST.md`（docker-compose 起手 + 环境变量 + 字体安装）

**验收**：
- E2E 测试在 CI 跑通（GitHub Actions docker-compose 起 Postgres + y-sweet + MinIO）
- README + 用户指南足够 onboarding 一个新人在 1 小时内 self-host

**失败模式**：
- Playwright 在 CI 启 docker-compose 太慢（> 5 min） → seed 数据 cache + 起 hot 容器
- 投稿格式细节（DOI、出版社模板）走 mystmd 标准不够 → 文档化为已知 limitation，留 Phase 2 加期刊模板

---

### D16 · ADR-0004 + ADR-0005 + 升 Accepted + Phase 2 plan stub

**目标**：把 Phase 1 学到的 / 改动的写回 ADR；Phase 0 三个 Proposed ADR 升 Accepted；起草 Phase 2 plan stub。

**输出**：
- `plan0/adr/0004-deployment-and-security.md`（Accepted）
- `plan0/adr/0005-render-api-boundary.md`（Accepted）
- `plan0/adr/0001-data-model-and-crdt-split.md` review log 加 Phase 1 实施反馈
- `plan0/adr/0002-permission-model.md` 状态升 Accepted（gate cleared by D8 实施）
- `plan0/adr/0003-tech-stack-lockdown.md` 状态升 Accepted（gate cleared by D7–D14 实施）
- `plan0/phase-2-plan-stub.md`（200 字，列 Phase 2 头三件事：reviewer agent / molab embed / spatial canvas Phase 3 推 → review）
- 更新 `plan0/prototypes-report.md` §5 → 加 Phase 1 收尾段；标 Phase 0 prototypes 是否保留 / 删除

**验收**：
- 4 个 ADR 全 Accepted
- ADR-0001 / 0002 / 0003 的 review log 含 Phase 1 实施期发现的修订
- Phase 2 plan stub 不超过 1 页（不要变成 Phase 2 的完整 plan）

---

## 四、路线图（5 周）

| 周 | 主任务 | 并行 | 守门 |
|---|---|---|---|
| W1 | D7（schema/migrations）+ D8 起手（capabilities + checker） | — | docker-compose up + seed 跑通 |
| W2 | D8 完成（gateway）+ D9（web skeleton + auth）+ D11 起手（y-sweet） | — | signup → 创建 doc → 进编辑器看到空白 |
| W3 | D10（editor-core 提取）+ D11 完成（持久化闭环）+ D12 起手（render） | D12 与 D13 起手并行 | 两 tab 编辑通；y-sweet 持久化通；HTML 导出 minimal works |
| W4 | D12 完成（render 全 pipeline）+ D13 完成（agent + MCP）+ D14 起手（approval UI） | — | citation agent invoke + propose 跑通；HTML/Word/JATS/PDF 全格式可导 |
| W5 | D14 完成 + D15 + D16 + buffer | — | 两人 E2E PASS + ADR 全 Accepted |

**预算守门点（重要）**：
- Week 3 末若 D7–D11 没完成 → 砍 D11 的 R2 生产部署（留本地 MinIO only）
- Week 4 末若 D13 翻车 → 砍 Inline Editor Agent，只保 Citation Agent；Inline Editor Agent 推 Phase 1.5
- Week 5 末若 D15 不全 → 砍"投稿格式"或"双语 demo"中的一项

---

## 五、Phase 1 反模式（继承 Phase 0 + 新增）

### 继承自 Phase 0 §五

仍然有效，特别是这几条：

3. 不做 agent UI 之外的 spatial canvas（Phase 3）
4. 不集成 Marimo（Phase 2）
5. 不打磨 typography 边角（"过关"即可）
9. 不做移动端
13. 不切 Loro / Automerge
14. 不加 Activity / Notification 表（派生）

### Phase 1 新增

16. **不做章节级隔离 / Yjs subdocument**（Phase 3）—— 即便 Phase 1 用户提两位作者协作可能有"section 私有"诉求，明确说明这是 Phase 3 才有
17. **不做 fork/merge UI**（schema 字段加，UI 留 Phase 3）
18. **不做 Reviewer / Researcher Agent**（推 Phase 2）
19. **不开放用户挂 localhost MCP server**（Phase 3 桌面伴侣）
20. **不做 MathLive 输入**（Phase 2；Phase 1 LaTeX 文本输入即可）
21. **不实施 ORCID / OAuth provider**（Phase 1.5）
22. **不实施 invitation email flow**（Phase 1.5）
23. **不做 PostHog / Sentry 集成**（Phase 1.5；先用 console + 简单日志）
24. **不做 agent quality dashboard**（Phase 3）
25. **不做 prompt registry UI**（Phase 2；Phase 1 表存 + 写）
26. **不在 Phase 1 自实现 capability check policy DSL**（Phase 1 自写 ~150 行 TS；Phase 4 评估 OPA/Cedar，已记录在 ADR-0002 §5.B）
27. **不在 Phase 1 投稿到真期刊**（demo 投稿格式生成；用户自己投）
28. **不开放 capability `agent.invoke:custom`**（Phase 3 用户挂自己 agent 时再开）
29. **不做 client-side BYO 模型**（Phase 3；Phase 1 schema 含 Agent.runtime='client' 但 runtime 实施 Phase 3）
30. **不做 sub-document 拆分**（Phase 3；100+ 协作者性能问题 Phase 3 才出现）

---

## 六、Phase 1 → Phase 2 验收门槛

**Phase 1 完成判据（全部满足才推进 Phase 2）：**

- [ ] D7：Postgres schema 落地，全表 round-trip test 过；docker-compose 一键起
- [ ] D8：sync-gateway 在 connection-level 强制 capability 检查；3 种 connection mode 行为正确
- [ ] D9：用户 signup → Principal row 自动创建；登录 → 看 docs 列表
- [ ] D10：proto-a 3 个 dual-tab cases 在 editor-core 上重跑全 PASS；Y.Doc snapshot worker 周期写 PG
- [ ] D11：客户端断线重连数据无损（IndexedDB ↔ y-sweet ↔ PG 三层闭环验证）
- [ ] D12：双语 specimen 4 格式全输出，CJK 标点挤压 / 引号一致性 / 字体 fallback 都过关
- [ ] D13：Citation Agent + Inline Editor Agent 都从 invoke → propose → Provenance row 全字段命中
- [ ] D14：propose → review → accept round-trip + 事务回滚都覆盖
- [ ] D15：两人 E2E（Playwright）在 CI PASS；docker-compose 起 / Postgres seed / web 编辑 / 导出全过
- [ ] D16：ADR-0001 / 0002 / 0003 全 Accepted；ADR-0004 / 0005 写完 Accepted；Phase 2 plan stub
- [ ] 两位真人内测：作者本人 + 1 位邀请用户在 staging 环境写一篇 < 5 页的双语论文，AI 用至少 1 次

---

## 七、Phase 1 关键文件清单（新增 / 改动）

```
collaborationtool/
├── pnpm-workspace.yaml             # 已有
├── package.json                     # 已有；加 web/sync-gateway 脚本
├── tsconfig.base.json               # 已有
├── plan0/
│   ├── phase-0-execution-plan.md            # 已有
│   ├── prototypes-report.md                  # 已有；D16 时加 Phase 1 收尾
│   ├── phase-1-execution-plan.md             # ⭐ 本文件
│   ├── phase-2-plan-stub.md                  # ⭐ D16
│   ├── paper-platform-system-prompt.md       # 已有
│   ├── paper-platform-landscape.md           # 已有
│   └── adr/
│       ├── 0000-template.md                  # 已有
│       ├── 0001-data-model-and-crdt-split.md # 已 Accepted
│       ├── 0002-permission-model.md          # → Accepted (D8)
│       ├── 0003-tech-stack-lockdown.md       # → Accepted (D7–D14)
│       ├── 0004-deployment-and-security.md   # ⭐ D16
│       └── 0005-render-api-boundary.md       # ⭐ D16
├── packages/
│   ├── schema/                      # 已有；Phase 1 加 forkedFromContributionId 等
│   ├── permissions/                 # ⭐ D8
│   ├── editor-core/                 # ⭐ D10（从 proto-a 提取）
│   ├── doc-store/                   # ⭐ D10（CRDT 抽象层；Phase 4 换 Loro 留）
│   ├── render-myst/                 # ⭐ D12
│   ├── render-typst/                # ⭐ D12
│   ├── typography/                  # ⭐ D12
│   ├── ai-runtime/                  # ⭐ D13
│   └── ui-elements/                 # ⭐ D9（共享 UI 组件，shadcn/ui 起手）
├── apps/
│   ├── web/                         # ⭐ D9（Next.js 15）
│   ├── sync-gateway/                # ⭐ D8
│   ├── snapshot-worker/             # ⭐ D10/D11
│   └── prototypes/                  # 已有；D10 完成后 proto-a 保留作为 reference
│       ├── proto-a-yjs-schema/      # 保留
│       ├── proto-b-cjk-render/      # 保留
│       └── proto-c-mcp-skill/       # 保留
├── mcp-servers/
│   ├── crossref-mock/               # 已有
│   ├── crossref/                    # ⭐ D13
│   ├── zotero/                      # ⭐ D13（OAuth；可推 Phase 1.5）
│   ├── arxiv/                       # ⭐ D13
│   └── semantic-scholar/            # ⭐ D13
├── skills/
│   ├── _registry.json               # 已有
│   ├── citation-lookup/             # 已有
│   └── inline-editor/               # ⭐ D13
├── templates/
│   ├── myst/                        # ⭐ D12（mystmd 模板镜像）
│   └── typst/                       # ⭐ D12（journal-style 模板）
├── infra/
│   ├── docker/                      # ⭐ D7/D11（compose + Dockerfile）
│   └── drizzle/                     # ⭐ D7（schema + migrations + seed）
├── tests/
│   └── e2e/                         # ⭐ D15
├── docs/
│   ├── USER_GUIDE.md                # ⭐ D15
│   ├── SELF_HOST.md                 # ⭐ D15
│   └── ARCHITECTURE.md              # ⭐ D16（综合 ADR 0001-0005 的工程师 onboarding 文档）
└── tools/
    └── seed-demo-data/              # ⭐ D15（生成双语 demo 文档）
```

---

## 八、Phase 1 风险登记 + 缓解

| ID | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | better-auth API 在 Phase 1 期间不稳 | 中 | 中 | 锁版本 + Auth.js fallback；W1 先做 spike |
| R2 | y-sweet 自托管运营复杂 | 中 | 中 | docker-compose 起手；准备 Jamsocket cloud 作为 fallback |
| R3 | mystmd 远端 template 镜像滞后 | 低 | 低 | 钉死 fork 版本 + CI 周期 diff（W4 加 cron）|
| R4 | Typst.ts WASM bundle 太大 | 中 | 低 | 服务端 typst CLI 默认（已可行）；浏览器 WASM 留 Phase 2 |
| R5 | PM steps 序列化边角 case | 高 | 高 | proto-a + proto-c 已做基础；W3-4 大量单元测试 + Playwright e2e |
| R6 | 一个月预算超出 30% | 中 | 高 | W3 末守门点；超出立刻砍范围（D15 双语 / D13 Inline Editor / D11 R2 任选） |
| R7 | LLM API 成本失控 | 低 | 中 | quota 限制（默认 user 每日 N 次 invoke）；mock mode CI 默认 |
| R8 | y-prosemirror 新发现 schema-recovery bug | 中 | 高 | proto-a Playwright 已有 baseline；生产 log + alert；evaluator BlockNote / Slate 留作 fallback（ADR-0003 §2.1）|
| R9 | better-auth organization plugin 不能直接对应 Principal kind='org' | 中 | 中 | bridge layer 解耦；不直接复用 organization id 当 PrincipalId |
| R10 | docker-compose 在用户机器上不可重现 | 低 | 中 | W5 找 1 位测试用户独立 self-host；issue 反馈作为 USER_GUIDE 修订 |
| R11 | 字体许可不清 | 低 | 低 | Source Han / Noto CJK 都 OFL；docker image 装一份；不做闭源字体 |
| R12 | Phase 1 结束发现需要 Phase 0 没预留的 schema 字段 | 中 | 高 | D14/D15 加 ADR-0001 review log；如果发现就升级 schema migration（不重写 8 实体框架）|

---

## 九、开放问题（请用户在执行前确认）

下列问题影响 Phase 1 的具体落地。建议 W1 起手前过一遍：

1. **部署 target**：
   - (a) 纯 self-hosted docker-compose（数据所有权最强；但 demo URL 需要域名 + TLS）
   - (b) Vercel + Neon + R2（最快上线；但 better-auth 自托管 vs Vercel 部署有 friction）
   - (c) 混合：web on Vercel + DB/y-sweet self-host
   - **推荐**：(a) docker-compose 本地 + (c) 一个 staging URL；Phase 2 再考虑 Vercel
2. **字体**：Source Han Serif（OFL）+ Source Han Sans（OFL）+ Noto Sans CJK（OFL）打包进 docker image 默认。如果偏好其他（思源宋 / 方正字库），现在说
3. **demo 论文方向**：CS / 教育 / 跨学科？影响双语 specimen 的内容（不影响代码）
4. **第二位测试用户**：作者本人 + ?（W5 W5 验收需要）
5. **默认 LLM**：Phase 1 用 Claude Sonnet 4.6 / Opus 4.7？还是用户 BYO key 路径（Phase 1 不做 BYO，只让 admin 配 platform key）
6. **MCP server 范围**：D13 列了 4 个（crossref real / zotero / arxiv / semantic-scholar）；Zotero 需要 OAuth flow，5 天工作量。如果时间紧，砍 Zotero 推 Phase 1.5（保留 crossref / arxiv / semantic-scholar）？
7. **better-auth organization 是否对应 Principal `kind='org'`**：ADR-0002 当前没列 'org'，需要加为新 kind 还是把 organization 看作"user 集合 + role bundle"？
8. **Phase 1 是否需要 ORCID 登录**：开放评审 / DeSci 场景核心。Phase 1 不实现，但 Phase 1.5 加是否？

---

## 十、Phase 2 之后（前瞻，不在本计划承诺）

- **Phase 1.5（两周补丁）**：ORCID OAuth、invitation flow、PostHog/Sentry、prompt registry UI、Inline Editor Agent（如 W4 砍掉）
- **Phase 2（一个月）**：Reviewer Agent + Research Agent（异步长 horizon）、版本/diff 语义级展示（PM steps 可视化）、Marimo iframe 嵌入、MathLive 输入、prompt registry 公开 UI、agent quality dashboard 起手
- **Phase 3**：spatial canvas、agent 自主任务、fork/merge 工作流、Yjs subdocument 拆分（章节级隔离）、Pyodide-inline、客户端 BYO 模型（local Ollama）、用户挂 localhost MCP（桌面伴侣 / 浏览器扩展桥）
- **Phase 4+**：开放协作、社区评审、声誉图、Loro / Automerge 3 切换评估

---

## 十一、与 Phase 0 plan 的对齐校验

本 Phase 1 plan 必须显式回答 `phase-0-execution-plan.md §6 验收门槛` 之外的事项；逐项对账：

| Phase 0 §五（不做） | Phase 1 是否解锁 | 备注 |
|---|---|---|
| 1. 不要先起后端 | ✅ 解锁 | D7 + D8 + D11 都是后端 |
| 2. 不要先选编辑器再定 schema | ✅ 已守住 | ADR-0001 schema 是 source of truth |
| 3. 不要做 agent UI | 部分解锁 | D13/D14 做 propose/approval UI；spatial canvas 仍 Phase 3 |
| 4. 不在 Phase 0 集成 Marimo | 仍守住 | Phase 1 不做；Phase 2 |
| 5. 不打磨排版 | 部分放开 | D12 做"过关"；polish 仍留 Phase 2 |
| 6. 不选设计系统 | 解锁 | D9 起 shadcn/ui + Tailwind v4 |
| 7. 不写用户文案 | 解锁 | D15 USER_GUIDE.md（中英双语 README） |
| 8. 不扩 schema 8 实体 | 仍守住 | Phase 1 加 forkedFrom 字段 + prompt_template 表，但不加新实体 |
| 9. 不做移动端 | 仍守住 | Phase 3+ |
| 10. 不先搭 monorepo + 空包 | 已破 | Phase 0 D3 已搭，Phase 1 顺势用 |
| 11. 不让 schema 绑定 UI 库 | 仍守住 | packages/schema 不依赖 TipTap/React |
| 12. 不在每次 keystroke 写 provenance | 仍守住 | D14 commit boundary only |
| 13. 不选 Loro/Automerge 3 | 仍守住 | Phase 4 评估 |
| 14. 不加 Activity/Notification 表 | 仍守住 | 派生 |
| 15. 不在 Phase 0 polish typography | 部分放开 | D12 做"过关"；polish 留 Phase 2 |

---

## 十二、Phase 1 commit 计划

按 D7-D16 顺序，每个 D 一个 PR（或几个 PR），每 PR 含：
- 该 D 的代码改动
- 该 D 的单元 / E2E 测试
- 该 D 的 findings / runtime issue 记录到 docs/ARCHITECTURE.md（D16 一次性整理）

**提交命名约定**：`Phase 1 D<N>: <short summary>`（与 Phase 0 commit 保持一致）

---

> **状态**：本计划是 Phase 1 起执行的"作战图"。等用户 review §九的 8 个开放问题、批准后，从 D7 起手。预算 5 周，超出 30% 立刻 escalate 砍范围。
