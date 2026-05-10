# collaborationtool

> 面向研究者的协作论文平台。Local-first · CRDT 同步 · AI 协作者一等主体 · 中英双语等权 · Plugin / MCP / Skill 三层扩展。

## 概览

研究者在浏览器写论文。文档以结构化 Markdown 为源，Yjs CRDT 实时多人同步，AI agent 通过协作动作介入。每段内容、每次 AI 介入进入 Provenance 图。导出 HTML / JATS / Markdown / Typst / PDF / Word。数据本地优先 —— 服务器关停后用户仍能编辑、渲染、导出。

---

## 核心能力

### 编辑器 / 协作
- TipTap + ProseMirror；9 个自定义 PM 节点（段落 / 标题 / 公式 / 引用 / 数据集 / 计算单元 / 图 / 注释锚点 / 脚注）+ Claim / Evidence / Counterpoint / Synthesis 论证节点
- Yjs CRDT 文档体 + Postgres 关系图（引用 / claim / evidence / contribution / provenance）
- y-sweet 自托管 + S3-compatible 持久化 + 周期 snapshot worker
- WebSocket sync-gateway 连接级 capability gate
- Document-level invitation；ORCID OAuth；better-auth org → Principal 桥接

### 权限
- 36 capability vocab + 5 role bundle（reviewer / commenter / author / maintainer / owner）
- Principal kind ∈ {user, org, service, agent} —— AI agent 与人类共用同一权限模型
- Capability + Principal 资源粒度：document / block / subdocument / source / agent

### AI 协作
- ai-runtime：plugin host + skill loader + MCP client + Provenance writer
- 6 内置 plugin：citation / inline-editor / reviewer / researcher / source-extractor / coordinator
- ModelProvider 4 wire：anthropic / openai-compat / ollama / custom-http
- BYO 模型 4 档 resolver：`document-override > user-pref > manifest-hint > env-default`
- Coordinator 多步 dispatcher：sync / async handoff + scratchpad + `[final]` 终止 + maxSteps 硬停 + capability gating
- Human-in-the-loop：propose → review → accept / modify / reject → commit
- Provenance 全链路 schema：`actorPrincipalId` / `agentContext{agentId, modelId, modelProvider, promptTemplateId, promptHash, inputSkillIds, temperature}` / `toolCalls[]` / `approvalChain[]` 落 PG，三表事务

### 渲染
- 5 emitter：HTML / JATS / Markdown / Typst source / PDF（Typst CLI）
- CJK pre-pass：标点挤压 + smart-quote-by-language + Source Han / Noto fallback chain
- 双语公式 / 中英混排断行 / hyphenation / ligatures
- 端到端导出：`GET /api/export/<docId>/<format>`

### Plugin / Sandbox
- Plugin manifest + 安装 capability prompt UI
- 三平台沙箱描述符：bwrap (Linux) / sandbox-exec (macOS) / AppContainer (Windows)
- https-only git URL 校验 + capability superset 校验
- 用户安装路径：URL 粘贴 → 预览 capability → 勾选 → 安装

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
apps/web/              Next.js 15 + better-auth + Editor + 导出 + AI invoke
apps/sync-gateway/     WebSocket capability gate + Yjs body backend
apps/snapshot-worker/  周期 Y.Doc → PG bytea + y-sweet HTTP fetcher
apps/agent-worker/     pgboss subscribe + maintenance-scan + agent dispatch

packages/schema/         数据模型 single source of truth
packages/permissions/    capability + role bundle + JWT + ACL loader
packages/editor-core/    TipTap extension + paperSchema + commit serializer
packages/typography/     CJK pre-pass + font tokens
packages/render-myst/    PM JSON → MyST AST → HTML / JATS / Markdown
packages/render-typst/   PM JSON → Typst source + CLI wrapper
packages/ai-runtime/     plugin host + skill loader + MCP client + ModelProvider + coordinator
packages/molab-protocol/ 计算单元 iframe postMessage 协议
packages/import-typst/   Typst → PM
packages/import-latex/   LaTeX → PM
packages/auto-fix/       broken source 自动修复

plugins/                 6 内置 agent plugin（citation / inline-editor / reviewer / researcher / source-extractor / coordinator）
skills/                  6 SKILL.md（Anthropic-style）
mcp-servers/             crossref（真）+ crossref-mock（fixture）

infra/docker/            docker-compose（Postgres 16 + MinIO + y-sweet）
infra/drizzle/           schema + migrations + round-trip 测试
infra/walg/              WAL-G 备份 overlay

templates/myst/          默认 MyST 模板
tests/e2e/               Playwright 双作者 spec（HTTP-driven）
docs/                    USER_GUIDE.md + SELF_HOST.md
plan0/                   ADR + plan stub + 第一性原理
```

---

## 快速开始

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
pnpm e2e:test                  # Playwright 双作者
```

---

## 文档

- [`STATUS.md`](./STATUS.md) — 项目当前快照
- [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md) — 用户路径
- [`docs/SELF_HOST.md`](./docs/SELF_HOST.md) — 自托管手册
- [`plan0/ADR-INDEX.md`](./plan0/ADR-INDEX.md) — ADR 导航 + 依赖图 + 主题聚类
- [`plan0/paper-platform-system-prompt.md`](./plan0/paper-platform-system-prompt.md) — 第一性原理与技术品味

---

## 开发约定

- **ADR-driven**：技术决策先写 `plan0/adr/00NN-<slug>.md`，一页内说清 trade-off
- **STATUS.md 是 source of truth**：phase 推进 / commit landed / ADR 状态变化时同步
- **测试 / typecheck 是 commit gate**：包级 `pnpm <pkg>:test` + 全局 `pnpm typecheck`
- **monorepo**：pnpm workspace（`apps/* | packages/* | apps/prototypes/* | mcp-servers/* | plugins/* | infra/drizzle | tests/e2e`）
- **commit 风格**：`P<phase>(<n>): <短描述> — <要点>` 或 `W<n>: <短描述>`
- **feature work**：`claude/<short-slug>` 分支；PR 到 main 前 STATUS.md 同步

---

## License

[MIT](./LICENSE)
