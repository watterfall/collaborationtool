# collaborationtool

> 研究者的**三层知识产出系统**：Night（发散探索）· Bridge（转化桥接）· Day（验证发表）三层等价，
> 论文不再是唯一可 cite 的产出。Client-owns-truth 桌面优先 · CRDT 同步 · AI 协作者一等主体 ·
> 中英双语等权 · Provenance 全链路 · 开放科学（DeSCI 去区块链）。

## 概览

研究者在**桌面端**拥有自己的数据（`~/MyVault/*.md` + Yjs CRDT sidecar 双轨存储），
写作、探索、协作都发生在本地文件之上；服务器退为 relay + replicated cache，
web 端是开放内容 surface（发布 / 评论 / open question / 开放评审）。
文档以结构化 Markdown 为源，Yjs CRDT 实时多人同步，AI agent 通过协作动作介入，
每段内容、每次 AI 介入进入 Provenance 图，发布物 ed25519 签名 + Merkle log 上链可验证（不用区块链）。
导出 HTML / JATS / Markdown / Typst / PDF / Word。服务器关停后用户仍能编辑、渲染、导出。

**定位演化**（诚实标注成熟度）：

| 层 | 内容 | 状态 |
|---|---|---|
| Day（验证/收敛） | 协作论文平台全栈：编辑器 / 权限 / 渲染 / claim-evidence / 评审 | **真实现**（Phase 0-5 landed） |
| 基础设施 | client-first runtime：desktop shell + vault-fs + doc-store + identity + open-content | **substrate 落地中**（Phase 6，ADR-0017/0018/0019 Proposed） |
| Night + Bridge（发散/桥接） | discovery-graph + bridge-layer + 6 InteractionMode + triadic UI | **契约层**（类型 SoT + UI skeleton；等 ADR-0020 30 天 dogfood gate 升 real） |

定位权威文档：[`plan0/adr/0020-night-bridge-day-triadic-architecture.md`](./plan0/adr/0020-night-bridge-day-triadic-architecture.md)（战略 ADR）
+ [`plan0/paper-platform-system-prompt.md`](./plan0/paper-platform-system-prompt.md)（第一性原理 #12/#13）。

---

## 核心能力

### 三层知识产出（ADR-0020）
- **Night**：thought / question / metaphor / sketch / contradiction / thought-experiment 六类原子单元（`packages/discovery-graph`）——默认私密，"夜科学需要未被监视的空间"
- **Bridge**：analogy-mapping / hypothesis-formalization / concept-prototype / design-fiction 四类桥接 artifact（`packages/bridge-layer`）——显式一等层，不是过渡带
- **Day**：论文 / 代码 / 数据 / 评审——原协作论文平台全栈保留为 Day 层 adapter
- **6 种双向交互流**：hypothesis-output / anomaly-input / constraint-transfer / metaphor-bridge / question-return / method-transfer，每条 cross-layer reference 带 `interaction_mode` 标签
- 三层在 attribution / archive / citation / metric 上完全等价；4 角色 surface：Explorer / Bridge-builder / Validator / Connector（AI = Connector）

### Client-first（ADR-0017/0018）
- 桌面端 Tauri 2.x shell（`apps/desktop`）：托盘 + 本地 Ollama 探测；identity / vault-fs 接线进行中
- `packages/vault-fs`：markdown + `.vault/yjs/*.bin` sidecar 双轨、three-way merge、drift 检测、文件监听
- `packages/doc-store`：Yjs / filesystem 双后端抽象（client owns truth，PG 退为 replicated cache）
- `packages/identity`：ed25519 keypair + argon2id + ORCID 绑定
- `packages/open-content`：canonical payload（RFC 8785-style）+ Merkle log + 公开 provenance——DeSCI 去区块链（无 NFT / token / DAO）
- 发布路径：`/api/publish` 单端点 4 entity kind，签名验证 + 反 replay + Merkle 链完整性

### 编辑器 / 协作
- TipTap + ProseMirror；9 个自定义 PM 节点（段落 / 标题 / 公式 / 引用 / 数据集 / 计算单元 / 图 / 注释锚点 / 脚注）+ Claim / Evidence / Counterpoint / Synthesis 论证节点
- Yjs CRDT 文档体 + Postgres 关系图（引用 / claim / evidence / contribution / provenance）
- y-sweet 自托管 + S3-compatible 持久化 + 周期 snapshot worker
- WebSocket sync-gateway 连接级 capability gate
- Document-level invitation；ORCID OAuth；better-auth org → Principal 桥接

### 权限
- capability vocab + 5 role bundle（reviewer / commenter / author / maintainer / owner）
- Principal kind ∈ {user, org, service, agent} —— AI agent 与人类共用同一权限模型
- Capability + Principal 资源粒度：document / block / subdocument / source / agent

### AI 协作
- ai-runtime：plugin host + skill loader + MCP client + Provenance writer
- 6 内置 plugin：citation / inline-editor / reviewer / researcher / source-extractor / coordinator
- ModelProvider 4 wire：anthropic / openai-compat / ollama / custom-http
- BYO 模型 4 档 resolver：`document-override > user-pref > manifest-hint > env-default`
- Coordinator：6 种交互流的双向 metabolic orchestrator（非单向 task scheduler）+ sync / async handoff + scratchpad + maxSteps 硬停 + capability gating；反 always-on——intense engagement 检测 → 建议 incubation break
- Human-in-the-loop：propose → review → accept / modify / reject → commit
- Provenance 全链路 schema：`actorPrincipalId` / `agentContext{agentId, modelId, modelProvider, promptTemplateId, promptHash, inputSkillIds, temperature}` / `toolCalls[]` / `approvalChain[]` 落 PG，三表事务

### 渲染
- 5 emitter：HTML / JATS / Markdown / Typst source / PDF（Typst CLI）
- CJK pre-pass：标点挤压 + smart-quote-by-language + Source Han / Noto fallback chain
- 双语公式 / 中英混排断行 / hyphenation / ligatures
- 端到端导出：`GET /api/export/<docId>/<format>`

### Plugin / Sandbox
- Plugin manifest + 安装 capability prompt UI
- 跨平台路线：WASM Extism 为主（ADR-0019）+ 各 OS 原生沙箱 fallback——bwrap (Linux) 真实现；sandbox-exec (macOS) / AppContainer (Windows) 为公开披露的占位，UI 显式拦截
- https-only git URL 校验 + capability superset 校验

### Source / Maintenance
- Source ingestion 流水线（PDF.js / readability）
- Maintenance scan 6 类 finding：unsupported-claim / outdated-source / unverified-ai-block / contradicted-conclusion / duplicated-claim / broken-citation
- pgboss queue 调度 + Server Component dashboard + 状态机（open / acknowledged / resolved / ignored）

### MCP
- 真 CrossRef stdio MCP server + crossref-mock fallback（CI / 离线）
- `mcp_server` PG 表 + registry seed

---

## 架构

```
apps/desktop/          Tauri 2.x 桌面 shell（client-first 主创作端；identity/vault-fs 接线中）
apps/web/              Next.js 15 + better-auth + Editor + 导出 + AI invoke + open-content surface
apps/sync-gateway/     WebSocket capability gate + Yjs body backend（relay）
apps/snapshot-worker/  周期 Y.Doc → PG bytea（PG = replicated cache，per ADR-0017）
apps/agent-worker/     pgboss subscribe + maintenance-scan + agent dispatch

packages/schema/           数据模型 single source of truth
packages/discovery-graph/  Night 层 6 类原子单元 + InteractionMode 类型 SoT（契约层）
packages/bridge-layer/     Bridge 层 4 类桥接 artifact 类型 SoT（契约层）
packages/vault-fs/         markdown + Yjs sidecar 双轨 · three-way merge · drift 检测
packages/doc-store/        Yjs / filesystem 双后端文档存储抽象
packages/identity/         ed25519 keypair + argon2id + ORCID 绑定
packages/open-content/     canonical payload + Merkle log + 公开 provenance
packages/permissions/      capability + role bundle + JWT + ACL loader
packages/editor-core/      TipTap extension + paperSchema + commit serializer
packages/typography/       CJK pre-pass + font tokens
packages/render-myst/      PM JSON → MyST AST → HTML / JATS / Markdown
packages/render-typst/     PM JSON → Typst source + CLI wrapper
packages/ai-runtime/       plugin host + skill loader + MCP client + ModelProvider + coordinator
packages/molab-protocol/   计算单元 iframe postMessage 协议
packages/import-typst/     Typst → PM
packages/import-latex/     LaTeX → PM
packages/auto-fix/         broken source 自动修复

plugins/                 6 内置 agent plugin（citation / inline-editor / reviewer / researcher / source-extractor / coordinator）
skills/                  6 SKILL.md（Anthropic-style）
mcp-servers/             crossref（真）+ crossref-mock（fixture）

infra/docker/            docker-compose（Postgres 16 + MinIO + y-sweet）
infra/drizzle/           schema + migrations + round-trip 测试
infra/walg/              WAL-G 备份 overlay

templates/myst/          默认 MyST 模板
tests/e2e/               Playwright 双作者 spec（HTTP-driven）
docs/                    USER_GUIDE.md + SELF_HOST.md
plan0/                   ADR + plan stub + 第一性原理 + Design.md
```

数据归属（ADR-0017 目标态）：**client 文件是权威**（`~/MyVault/*.md` + `.vault/yjs/*.bin`），
PG 是 replicated cache；desktop 是主创作端，web 不是平等 client 而是开放内容 surface。
迁移进行中——当前 web 端全栈仍可独立运行（见"快速开始"）。

---

## 快速开始

### Web（当前可跑全栈）

```bash
pnpm install

# 起 Postgres + MinIO + y-sweet
pnpm db:up
pnpm db:migrate
pnpm db:seed

# 生成 secrets
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export SYNC_TOKEN_SECRET=$(openssl rand -base64 32)
export DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool

# 起服务（两个终端）
pnpm web:dev          # :3000
pnpm gateway:start    # :4321
```

### Desktop（Phase 6 substrate，进行中）

```bash
cd apps/desktop && pnpm tauri dev   # 需要 Rust toolchain；见 apps/desktop/README（如有）
```

完整自托管：[`docs/SELF_HOST.md`](./docs/SELF_HOST.md)（typst CLI / WAL-G / ORCID / mailer / 字体打包 / 故障排查）
用户路径：[`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md)（注册 → 文档创建 → 邀请 → 编辑 → AI 协作 → 导出）

---

## 测试 / 类型检查

```bash
pnpm typecheck                 # 全 workspace

# 包级测试
pnpm db:test                   # PG round-trip
pnpm perms:test                # capability + role bundle
pnpm gateway:test              # WS E2E + capability gate
pnpm web:test                  # Next 路由 + 组件
pnpm editor:test               # PM schema + commit serializer
pnpm snapshot:test             # snapshot worker
pnpm typo:test                 # CJK / quote / font tokens
pnpm render-myst:test          # PM → AST → HTML/JATS
pnpm render-typst:test         # PM → Typst source
pnpm ai-runtime:test           # plugin / skill / MCP / coordinator
pnpm mcp-crossref:test         # CrossRef MCP 真 + mock
pnpm vault-fs:test             # 双轨 merge / drift / watcher
pnpm docstore:test             # Yjs / filesystem 双后端
pnpm identity:test             # ed25519 + argon2id + ORCID
pnpm open-content:test         # canonical payload + Merkle log
pnpm discovery-graph:test      # Night 层契约
pnpm bridge-layer:test         # Bridge 层契约
pnpm desktop:test              # 桌面接线层
pnpm e2e:test                  # Playwright 双作者
```

---

## 文档

- [`STATUS.md`](./STATUS.md) — 项目当前快照（source of truth）
- [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md) — 用户路径
- [`docs/SELF_HOST.md`](./docs/SELF_HOST.md) — 自托管手册
- [`plan0/ADR-INDEX.md`](./plan0/ADR-INDEX.md) — 20 ADR 导航 + 依赖图 + 主题聚类
- [`plan0/paper-platform-system-prompt.md`](./plan0/paper-platform-system-prompt.md) — 第一性原理与技术品味
- [`plan0/Design.md`](./plan0/Design.md) — 设计 SoT（warmth + concretization v2）
- [`plan0/adr/0020-night-bridge-day-triadic-architecture.md`](./plan0/adr/0020-night-bridge-day-triadic-architecture.md) — 定位权威（战略 ADR）
- [`plan0/improvement-plan-2026-07.md`](./plan0/improvement-plan-2026-07.md) — 当前迭代计划

---

## 开发约定

- **ADR-driven**：技术决策先写 `plan0/adr/00NN-<slug>.md`，一页内说清 trade-off
- **STATUS.md 是 source of truth**：phase 推进 / commit landed / ADR 状态变化时同步
- **测试 / typecheck 是 commit gate**：包级 `pnpm <pkg>:test` + 全局 `pnpm typecheck`
- **Design.md commit gate**：动 `apps/web/src/` 前必读 §11 reject criteria（16 条）
- **monorepo**：pnpm workspace（`apps/* | packages/* | apps/prototypes/* | mcp-servers/* | plugins/* | infra/drizzle | tests/e2e`）
- **commit 风格**：`P<phase>(<n>): <短描述> — <要点>` 或 `W<n>: <短描述>`
- **feature work**：`claude/<short-slug>` 分支；PR 到 main 前 STATUS.md 同步

---

## License

[MIT](./LICENSE)
