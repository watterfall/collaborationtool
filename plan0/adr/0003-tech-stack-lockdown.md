# ADR-0003: Phase 1 技术栈锁定

- **Status**: Accepted
- **Date**: 2026-05-08（Proposed），2026-05-08（Accepted，Phase 1 D16 收尾时 11 项全部生效）
- **Phase**: 0（关键路径 D6）
- **Deciders**: <项目所有者>
- **Gate cleared by**: Phase 1 D7-D15 全部交付物均使用本 ADR 锁定的 11 项技术栈，无中途切换；D15 双人 e2e 验收 PASS。详见下方 §9 Phase 1 implementation review log。

---

## 1. Context

ADR-0001 / ADR-0002 把"数据形状"和"协作主体形状"锁住后，剩下的就是"用什么具体工具实现这些 schema"。本 ADR 不发明决策——它把 `phase-0-execution-plan.md` D6 章节给的 7 项默认值正式落地，并把 D3 已经用的 4 项（TipTap、React、Vite、Yjs）从"原型用"升格到"Phase 1 锁定"。

**边界**：
- **决定**：11 项 Phase 1 技术选型；每项的回头 trigger 条件。
- **不决定**：UI 设计系统具体配色 / typography（Phase 1 ADR 单独）；CI 平台（Phase 1 接近发布时定）；监控（PostHog vs Mixpanel —— Phase 2）。

**取舍原则**（按优先级）：
1. **可演化性 > 当前 ergonomics**——Phase 1 选型必须扛得住 Phase 3 50 协作者 + 多 agent + 开放评审
2. **数据所有权 > vendor SDK polish**——任何把"用户数据存我们之外"作为产品定位的服务都不选
3. **OSS / 可自托管 > 闭源**——Liveblocks 不能自托管直接出局
4. **稳定 > 前沿**——Yjs over Loro/Automerge 3，Postgres over Convex（Convex 留 future evaluate）
5. **TS 全栈 > 多语言**——降低协作摩擦

---

## 2. Decision（11 项）

### 2.1 编辑器内核：**TipTap v2 (基于 ProseMirror)**

D3 已用，正式锁定。

**选它**：(1) ProseMirror 是论文级结构化编辑的事实标准（schema-driven、节点 / 标记分离、PM steps 是 CRDT 友好的 diff 单元）；(2) TipTap 在 PM 上加 React-friendly extension 模型，不丢可控性；(3) y-prosemirror 集成最成熟（@tiptap/extension-collaboration 是官方包）。

**不选**：
- **BlockNote**：底层是 PM + Yjs 但 schema 不够灵活，原子节点扩展走他们的 Schema API 而非 PM-native，定制深度有限
- **Slate**：CRDT 集成（slate-yjs）不如 y-prosemirror 成熟；PM 的 schema 模型对论文级语义（theorem/proof/citation 这些 first-class）更对路
- **Lexical**：Meta 内部用，但 CRDT 集成弱，社区 yjs binding 不官方

**回头 trigger**：D3 双 tab 手测出现不可绕过的 schema-recovery bug → 评估 BlockNote / Slate-Yjs。

---

### 2.2 前端框架：**Next.js 15 (App Router)**

**选它**：(1) RSC 让"公开论文页 / 评审页 / 引用回链"做 SSR 静态化天然合理（论文是文档不是应用）；(2) Vercel AI SDK + AI Elements 与 Next 集成路径最短；(3) Streaming + Suspense 对 long-horizon agent 任务（"读完整篇 → 列修订清单"）友好；(4) edge runtime 可作为 sync gateway 部署目标之一。

**不选**：
- **TanStack Start**：生态较小、AI SDK 文档少。论文公开页面 SEO 重要——TanStack 是 SPA 优先，RSC 故事不如 Next
- **Remix v2**（已并入 React Router）：方向不明朗
- **Vite + React Router 7 SSR**：自己拼 RSC 太重

**回头 trigger**：Phase 4 公开门户场景（fork / 社区评审）需要 React 19 actions + RSC 重度，但发现 Next 的 build 时间或 hosting 成本失控 → 考虑 SPA 化前端 + 独立 SSR worker。

---

### 2.3 编辑器同步层：**y-sweet 自托管（Jamsocket OSS）**

**选它**：(1) Yjs 官方推荐的生产同步服务；(2) Rust + S3 持久化，可自托管或托管在 Jamsocket cloud；(3) 文档级 token 鉴权 → 我们在前面再加自己的 sync gateway shim（ADR-0002 §2.4）实现 capability 检查；(4) 与 ADR-0002 的"网关 shim Phase 1 就在"决策对齐（y-sweet 不替代我们的 gateway，它是 gateway 之后的 Yjs persistence）。

**不选**：
- **Liveblocks**：MAU 计费 + 不可自托管 → 数据所有权违例
- **Cloudflare Durable Objects**（自己搭）：DO 把我们锁死在 CF，未来出走成本高；y-sweet 同样 OSS 但 backend-agnostic（S3-compat）
- **Convex**：协作模型不是 Yjs-first，要把我们的 schema 适配过去，且 Convex 是闭源 backend
- **partykit**：好玩但运营层不成熟

**回头 trigger**：50+ 协作者实测 y-sweet 单进程 awareness 风暴瓶颈 → Phase 4 评估 Loro/Automerge + 自研同步。

---

### 2.4 Auth：**better-auth**

**选它**：(1) 框架无关，TS 全栈；(2) `organization` plugin 自带 roles / member capabilities，与 ADR-0002 capability 模型可桥接（不是直接用，是用作底层 user identity）；(3) 自托管 / 数据归用户；(4) 2025 起社区活跃度超过 Lucia。

**不选**：
- **Lucia**：作者宣布弃维（2024.10），不能新启项目用
- **Clerk**：MAU 计费；用户数据存 Clerk 服务器 → 数据所有权违例；价格在 Phase 4 开放评审场景下不可控
- **Supabase Auth**：好用但绑定 Supabase 全栈（PG 实例 + Storage），与"PG 自选实例"冲突
- **Auth.js (NextAuth)**：能用，但 capability 层要全自写；better-auth 的 organization plugin 是更接近的起点

**回头 trigger**：better-auth API surface 不稳（v1.x 还在快速演进）阻碍 Phase 1 → fallback Auth.js + 自写 organization 层。

---

### 2.5 Provenance 存储：**Hybrid（Y.Map in-flight + Postgres committed）**

ADR-0001 已锁定的总策略；这里把 Phase 1 实现细节钉死：

- **In-flight**：`Y.Map('provenance:in-flight')`，TTL 60s，客户端定期清理；广播给协作者看到"agent X 正在 block Y 上跑"
- **Committed**：commit boundary 时一行 INSERT 进 PG `provenance` 表
- **Prompt registry**（Phase 1 单独表）：`prompt_template_id` → 版本化 prompt 文本（immutable），用 promptHash 校验
- **不实现**：完整 prompt 文本回放 UI（Phase 2）；按 modelId 跨 user 聚合的 agent quality dashboard（Phase 3）

**不选**：
- 完全 PG only：丢失协作者实时可见 agent 工作的 UX
- 完全 Yjs awareness：reload 即丢，audit 不可靠

---

### 2.6 文档持久化：**y-indexeddb（client）+ y-sweet 后端 binary（S3-compat）+ PG snapshot（备份）**

三层：

- **客户端**：`y-indexeddb` 让离线编辑成立（第一性原理 #1 Local-first）
- **服务端实时**：y-sweet 把 Y.Doc binary 推到 S3-compat（R2 / Tigris / MinIO），按 doc-id 分片
- **审计 / 灾难 / fork base**：commit boundary 周期性（默认每 N 分钟空闲）把 Y.Doc 完整 binary dump 到 PG `document.yjs_doc_binary`（bytea，>1MB 外移到对象存储）

**不选**：纯 PG 存 Y.Doc binary —— 大文档下 PG bytea I/O 成为瓶颈；纯 S3 不存 PG —— history 重建依赖额外 reconcile job 复杂度高。

---

### 2.7 数据库 + ORM：**Postgres + Drizzle ORM**

**选 Postgres**：开放标准、JSONB 给 cslJson / agentContext / toolCalls 数组场景、bytea 给 Yjs binary、强 indexing、生态成熟。

**选 Drizzle**：(1) TS-first schema（与 packages/schema 风格一致）；(2) 没有 runtime overhead（生成 SQL）；(3) 比 Prisma 更 SQL-native，复杂查询不需要 raw escape；(4) bytea / JSONB 类型支持好。

**不选**：
- **Prisma**：runtime overhead + JSONB 处理较弱 + Phase 1 要做的 contribution DAG / capability_grant 多键复合查询用 Drizzle 更顺
- **Kysely**：query builder 强但 schema migration 工具不如 Drizzle
- **手写 SQL + node-postgres**：Phase 1 太累

**回头 trigger**：Phase 3 contribution DAG 查询性能瓶颈 → 引入 specialized graph extension（Apache AGE）或迁部分到 ClickHouse 做 time-series provenance 分析。

---

### 2.8 Agent 运行位置：**服务端默认（Vercel function / Next API route）**

Schema 已含 `Agent.runtime: 'server' | 'client'`（ADR-0001 §2.3.8）。Phase 1 默认 server。

**为什么 server-default**：
- API key 不在客户端
- prompt template / skill registry 在服务端权威
- MCP server 调用集中鉴权
- Provenance 写入路径短（agent → 同进程 PG client）

**Phase 3 client-side 路径预留**：用户 BYO 模型（本地 Ollama）走 client runtime；Agent 实体在 PG 标记，编辑器侧加载 client agent SDK；Provenance 仍走 commit boundary（client 把 AgentExecutionContext 塞进 commit payload）。

**不选**：
- Phase 1 client-side 默认：API key 处理 + skills 同步成本高、不必要
- Edge runtime：Vercel function 默认，Edge 留 Phase 2 优化（短延迟 inline 改写）

---

### 2.9 MCP server 宿主：**服务端代理（Phase 1）+ 自挂 localhost 留 Phase 3**

**Phase 1**：所有 MCP server 调用走服务端代理。`mcp-servers/` 目录里的 server（CrossRef / Zotero / Semantic Scholar / arXiv 等）都是服务端 Node 进程。Agent invoke 时走 Vercel function → MCP server。

**Phase 3 加**：用户挂自己的 localhost MCP server（私有数据、领域工具、实验设备）。需要：
- 桌面伴侣（local daemon）或浏览器扩展桥
- 端到端鉴权（user 给 platform 颁 cert，platform 调 user-localhost MCP 时带 cert）
- Sandbox（用户挂的 server 可能恶意，按 system-prompt §7）

**不选**：
- Phase 1 直接放开用户挂 localhost：鉴权 + 沙箱模型还没设计完，先服务端集中
- 永远不开放：违反第一性原理 #5（可组合）和系统提示词 §6（扩展点契约）

**Phase 1 mcp-servers/ 目录结构**：

```
mcp-servers/
├── crossref-mock/           # D5 用，CrossRef DOI lookup mock
├── crossref/                # Phase 1 真实接入
├── zotero/                  # Phase 1，user OAuth
├── arxiv/                   # Phase 1
├── semantic-scholar/        # Phase 1
└── csl-styles/              # Phase 2，CSL JSON style 库
```

---

### 2.10 公式：**KaTeX 渲染 + MathLive 输入（Phase 2）**

D3 已用 KaTeX。

- **Phase 1**：KaTeX 渲染（display + inline）；输入靠纯 LaTeX 文本（编辑器侧 highlight）
- **Phase 2**：MathLive 作为公式输入面板（手写 / 语音 / 键盘 mixed），输出仍是 LaTeX 字符串存 attrs

**不选**：MathJax —— 渲染慢，KaTeX 50ms 内完成（满足质量门槛）；纯 LaTeX 一直保留作为底层 source（markup-as-source）。

---

### 2.11 Marimo / 可执行单元：**molab iframe（Phase 1/2）+ Pyodide-inline 留 Phase 3**

ADR-0001 §2.3 + plan H5。`ComputationalCell.kernel` 字段从 Phase 0 起就含三个值：

- `'molab'`（Phase 1/2 默认；iframe embed `?embed=true`）
- `'pyodide-inline'`（Phase 3，自建 React 组件直接用 Pyodide）
- `'remote-jupyter'`（Phase 2，Jupyter Server API）
- `'marimo-server'`（Phase 2，自托管 Marimo runtime）

**不选 Pyodide-inline 现在**：直接调 Marimo `PyodideSession` 内部类没有 React 组件级 SDK，3+ 月 rabbit hole。schema 预留即可。

---

## 3. 关于双管线渲染（D4 决定，本 ADR 暂记默认）

| 输出 | Backend | 状态 |
|---|---|---|
| HTML（公开论文页） | mystmd | ✅ 锁定（生态成熟、journal 模板多） |
| Word / .docx | mystmd | ✅ 锁定 |
| JATS XML | mystmd | ✅ 锁定（投 NCBI / Crossref pipeline） |
| 印刷 PDF | **Typst.ts**（默认） | ⏳ pending D4 实证 |
| 屏幕 PDF | mystmd → wkhtmltopdf or similar | ⏳ pending D4 实证 |

D4 完成后本 ADR §3 转 Accepted；如果 Typst 翻车则 fallback xeCJK + mystmd LaTeX template。

---

## 4. 锁定决策矩阵（速查）

| 层 | 决策 | Phase 1 用什么 | 回头 trigger |
|---|---|---|---|
| 编辑器 | 内核 | TipTap v2 + ProseMirror | D3 schema recovery 不可控 |
| 编辑器 | UI 框架 | React 18 + Vite | React 19 stable 后 Phase 2 升 |
| 编辑器 | CRDT | Yjs 13 | 50+ 协作者性能 → Loro/Automerge |
| 前端 | 应用框架 | Next.js 15 App Router | RSC build 时间或 hosting 成本失控 |
| 同步 | Yjs 后端 | y-sweet 自托管 + S3-compat | 单进程 awareness 风暴 |
| 同步 | gateway | 自建 sync-gateway shim（Node/CF Worker） | 永远是 capability 入口 |
| Auth | identity | better-auth + organization plugin | API 不稳 → Auth.js |
| 数据 | DB | Postgres | / |
| 数据 | ORM | Drizzle ORM | / |
| 数据 | 对象存储 | S3-compat（R2 / Tigris / MinIO） | / |
| Agent | runtime 默认 | server (Vercel function) | / |
| Agent | client 路径 | schema 预留，Phase 3 实现 | / |
| MCP | 宿主 | 服务端代理 | Phase 3 加 user-localhost |
| 渲染 | web/Word/JATS | mystmd | / |
| 渲染 | 印刷 PDF | Typst.ts（pending D4） | D4 实证 |
| 公式 | 渲染 | KaTeX | / |
| 公式 | 输入 | LaTeX 文本（Phase 1）/ MathLive（Phase 2） | / |
| 计算 | kernel default | molab iframe | / |
| 计算 | inline 路径 | Pyodide-inline 留 Phase 3 | / |
| Provenance | 存储 | Hybrid Y.Map + PG | / |
| 监控 | error | Sentry（Phase 1.5 后接） | / |
| 监控 | analytics | PostHog（Phase 2） | / |
| 监控 | agent quality | 自建 dashboard（Phase 3） | / |

---

## 5. Consequences

### Good

- 11 项决策都来自 Phase 0 plan / 已用过的工具（D3）/ 充分调研，没有"试试看"的赌博
- 4 项（TipTap / React / Vite / Yjs）已 D3 实证可工作
- 数据所有权全程不让步：y-sweet 自托管 + better-auth + Postgres + S3-compat 全可自托管
- agent 行为 / MCP 调用第一天就在服务端 → capability 检查 + provenance 写入路径同进程
- schema-level 预留（`Agent.runtime` / `ComputationalCell.kernel`）让 Phase 3 BYO 模型 / inline 计算是"加 renderer"而非"改数据模型"

### Bad / Trade-offs

- **better-auth API surface 还在快速演进**（v1.x）—— Phase 1 实施前要锁版本；准备 fallback Auth.js
- **y-sweet 单 Rust 进程 + S3** 在 50+ 协作者大文档时 awareness 仍是单点；Phase 3 拆 subdocument 是必经之路
- **Drizzle 比 Prisma 流行度低** —— 招人 / Stack Overflow 答案少；但 SQL native 性 + 性能值得
- **molab iframe 跨域**——cookie / auth 传递需要 postMessage 桥；Phase 1.5 实施
- **Vercel 锁定**：Next.js 15 + AI SDK + Vercel function 让初期非常快，但深度依赖；Phase 3 评估自托管路径（开源 Vercel 替代如 OpenNext）

### Neutral / Need watching

- **Typst 的中英文排版边角**——D4 实证时如果差距太大，预留 LaTeX 双线
- **Yjs 13 → Yjs 14**（如果 2026 年内发布 major）——升级路径需测
- **React 18 → 19** 升级——Suspense / actions 改进对 agent UI 有用，但 18 的 ecosystem 现在最稳

---

## 6. Alternatives summarized

| 替代方案 | 不选原因 | 何时回头 |
|---|---|---|
| BlockNote | schema 灵活度有限 | D3 翻车 |
| Slate + slate-yjs | y-prosemirror 集成更成熟 | D3 翻车 |
| TanStack Start | 生态小、SSR 不如 Next | Next build 痛 |
| Liveblocks | 不能自托管 | 永远不回 |
| Cloudflare Durable Objects | 锁定 CF | y-sweet 实证撑不住 |
| Lucia | 弃维 | 永远不回 |
| Clerk | 数据所有权 + MAU 计费 | 永远不回 |
| Supabase Auth | 绑全栈 | 永远不回 |
| Prisma | runtime overhead + JSONB 弱 | 招人难 |
| Convex | 闭源 + 数据所有权 | 永远不回 |
| Loro / Automerge 3 (Phase 1) | 非生产就绪 | Phase 4 重新评估 |
| Pyodide-inline (Phase 1) | 3+ 月 rabbit hole | Phase 3 |
| User-localhost MCP (Phase 1) | 安全模型未成熟 | Phase 3 |

---

## 7. Decision log

- **2026-05-08**: 决定 D6 在 D3 stress PASS 后即写，不等用户跑完双 tab 手测——理由：本 ADR 11 项决策中 8 项与 D3 PM 集成无关，剩下 3 项（TipTap / React / Vite）D3 已用就是验证。如果手测翻车，回头修 §2.1。
- **2026-05-08**: better-auth 取代了原 plan §52 的 "Clerk 或 Lucia"。理由：Clerk 数据所有权违例；Lucia 弃维；better-auth 的 organization plugin 是 capability 层最近的起点。
- **2026-05-08**: 决定 Drizzle 而非 Prisma。理由：JSONB / bytea 类型支持 + SQL-native 查询性能 + TS-first schema 与 packages/schema 风格一致。
- **2026-05-08**: 决定 Phase 1 不开放 user-localhost MCP server。理由：安全 + 沙箱模型未设计完。Phase 3 加桌面伴侣 / 浏览器扩展桥。

---

## 8. References

- ADR-0001 §2.3.8（Agent.runtime） / §2.3.5（ComputationalCell.kernel）
- ADR-0002 §2.4（同步网关执行策略）
- ADR-0004（部署拓扑 + 安全基线）
- ADR-0005（render API 边界，§2.6 render pipeline 的实施面）
- `plan0/phase-0-execution-plan.md` D6 章节
- `plan0/paper-platform-system-prompt.md` §52-95（技术基线）
- y-sweet: https://github.com/jamsocket/y-sweet
- better-auth: https://better-auth.com/
- Drizzle ORM: https://orm.drizzle.team/
- Vercel AI SDK: https://ai-sdk.dev
- Marimo embedding: https://docs.marimo.io/guides/publishing/embedding/

---

## 9. Phase 1 implementation review log

> 加于 D16 close-out。回放 11 项决策的实际落地状态。

| # | 决策 | Phase 1 落地 | 备注 |
|---|---|---|---|
| 2.1 | TipTap v2 / ProseMirror | ✅ D10 | 9 PM extension + paperSchema()，无 schema-recovery bug |
| 2.2 | Next.js 15 (App Router) | ✅ D9-D15 | RSC + Server Actions + middleware，路由 stable |
| 2.3 | y-sweet 自托管 | ✅ D11 | BodyBackend 抽象（InMemory + YSweet），YSWEET_URL 切换 |
| 2.4 | better-auth | ✅ D9 | 7 better-auth 表迁移 + Principal bridge，signup/login/session 跑通 |
| 2.5 | Drizzle + postgres-js | ✅ D7 | 13 表 + 18 round-trip 测；drizzle 0.45 transaction 类型 quirk 已记录 |
| 2.6 | render pipeline (MyST + Typst) | ✅ D12 | 5 格式（HTML/JATS/MD/Typst/PDF）+ ADR-0005 锁定 API |
| 2.7 | Anthropic SDK + MCP | ✅ D13/D14 | InMemory + stdio MCP 双 transport，mock fallback |
| 2.8 | typography pre-pass | ✅ D12 | CJK spacing + smart quote + font tokens，幂等 |
| 2.9 | Vitest + Playwright | ✅ D7-D15 | 单元 / 集成 / e2e 三层；2-author MVP e2e 22.8s |
| 2.10 | pnpm workspace | ✅ D7 | 11 workspace package + 3 app + 1 e2e suite |
| 2.11 | TypeScript strict | ✅ 全程 | 无 `any` 通过；`strict: true` + `noUncheckedIndexedAccess: true` |

**实施过程中触发的"轻微决策修正"**（不构成回头改 ADR）：

- **drizzle-orm 版本**：从 plan §52 的 ^0.40 升到 ^0.45.2 因为 better-auth peer
  依赖。本 ADR §2.5 文本未变。
- **React 19 重复 types**：pnpm overrides pin `@types/react@^19.2.0` 解决 18.3 +
  19.2 共存。本 ADR §2.2 未提 React 版本细节，无需修改。
- **playwright 命令**：`pnpm --filter ... -- --port 3100` 的 `--` 被 pnpm 吃掉；
  改用 `pnpm exec next dev --port 3100` + cwd。本 ADR §2.9 未约束启动脚本细节。

**未触发回头 trigger 的决策**：

- TipTap：D3 + D10 + D15 全程 PASS，未见 schema-recovery 不可绕过 bug
- Next.js 15：build 成本可控（dev startup ~3s，prod build ~30s）
- y-sweet：Phase 1 是 InMemory 默认；YSweetBackend 已实测 docker-compose 路径
  打通；50 协作者压测留 Phase 4
- better-auth：Phase 1 实测无重大 bug；organization plugin Phase 1.5 启用

**Phase 2 起需要重新评估的决策**（写在这里作为 watch list，不立即修）：

- §2.6 mystmd 官方 transformer 替换我们自写的 ast-from-pm（Phase 1.5）
- §2.6 mystmd-to-docx 加 .docx 导出（Phase 1.5）
- §2.7 Vercel AI SDK 采用还是延后（D14 用了 Anthropic SDK 直接，未引入 AI SDK）—
  Phase 2 reviewer agent 落地时再决定
- §2.3 y-sweet horizontal scale 评估（Phase 4 50+ 人开放评审场景）

---

## Phase 5 Wave B Spike-1 review log（2026-05-11）

- 加 **Tauri 2.x** 到 tech stack（desktop shell；webview 套 Next.js + Rust 系统集成层）
- 加 **Rust toolchain 1.75+** 到 build prereq（host 已实测 cargo 1.95 + rustc 1.95）
- 加 **reqwest 0.12 / mockito 1.5 / tokio 1** 到 Rust deps（Ollama HTTP detect + 单元测试）
- 加 **tauri-plugin-{shell, notification, os, deep-link, updater}** plugin set
- 加 **GitHub Actions matrix build pipeline**（4 platforms：macOS arm64/x64 + Linux x64 + Windows x64）
- **minisign keypair** 用于 Tauri Updater 签名（私钥放 GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY*`）
- **icon / notarization / Windows signing** 当前是 placeholder / 占位，Phase 6 W2 真补
- **frontendDist** Spike-1 用 `../dist` 占位（gitignored），dev 走 devUrl `http://localhost:3000`；
  Phase 6 W1 决议切到 `apps/web/.next/standalone`
- `tauri::feature: macos-private-api` 未启用（与 tauri.conf.json allowlist 不匹配，Spike-1 webview shell 用不到，
  Phase 6 W1 决议是否启用）
- `tauri-plugin-shell::Shell::open` deprecation warning 已留，Phase 6 W1 替换为 `tauri-plugin-opener`

**新增 wire-format / 模块边界**：

- TS 侧 `apps/web/src/lib/local-ollama.ts`：`detectOllamaInBrowser` / `chatCompletion` /
  `parseStreamChunk`（直 fetch `http://localhost:11434`，绕过 server-side ai-runtime ollama provider）
- TS 侧 `apps/web/src/lib/desktop-bridge.ts`：`isTauri()` + `safeInvoke<T>()`，window.__TAURI_INTERNALS__
  探测 + 优雅降级到 null（非 Tauri 环境）
- Rust 侧 `commands::ollama::detect_ollama_available` + `commands::system::open_external_url`

**Spike-1 验收**：3 Rust 单元测试 + 14 web node:test 全 PASS；cargo check 全 PASS；
跨平台 CI matrix 上线；端到端 GH Actions binary 验证 + 真 ollama smoke 留 task 11/13 实测填写。
