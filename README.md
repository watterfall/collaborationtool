# collaborationtool

> 面向研究者的协作论文平台 / A collaborative paper-writing platform for researchers.
>
> Local-first · CRDT 同步 · AI 协作者作为一等主体 · 中英双语等权 · Plugin / MCP / Skill 三层扩展 · ADR-driven。

定位（不是又一个 Overleaf clone）：

- 比 Typst / LaTeX 编辑器**少一层代码感** —— 不让研究者直面 markup
- 比 Google Docs / 石墨**多一层学术专业性** —— 引用 / 公式 / 模板 / 版本是一等公民
- 比 Notion **更尊重论文的形式** —— 论文是有结构的论证，不是 block 堆叠
- 比 Curvenote **更现代、中文更友好、AI 更深度集成**

详细技术品味与第一性原理见 `plan0/paper-platform-system-prompt.md`。

---

## 当前阶段

**Phase 0 → 1 → 1.5 → 2 → 2.5 → 3 全部 ✅ 完成**；**Phase 4 已启动**（backend W1-W4 已交付）。

| Phase | 范围 | 状态 |
|---|---|---|
| 0 | 纸面架构 + 3 原型 + 4 ADR | ✅ |
| 1 | 两人协作 MVP（10 交付物 D7-D16，5 ADR Accepted） | ✅ |
| 1.5 | 7 个 patch（邀请 / ORCID / WAL-G 等） | ✅ |
| 2 | 扩展系统 + plugin / skill / MCP（W1-W7） | ✅ |
| 2.5 | 工程对接 + 真服务实测（6/7 已交付） | ✅ |
| 3 | source ingestion + maintenance + sandbox + ModelProvider + coordinator handoff（W1-W7 backend） | ✅ |
| 4 | dogfood gates + plugin marketplace + subdocument + open peer review | 🚧 W1-W4 backend 已落 |

实时进度看 [`STATUS.md`](./STATUS.md)（**唯一的当前快照**），决策细节看 `plan0/adr/0001-0015`。

---

## 核心能力（截至 Phase 4 W4）

**协作 / 编辑器**
- TipTap + ProseMirror 9 个自定义 extension（段落 / 标题 / 公式 / 引用 / 数据集引用 / computational cell / 注释锚点 / 图 / 脚注）
- Yjs CRDT body + Postgres graph（ADR-0001 拆分）
- y-sweet 自托管 + S3-compat 持久化 + snapshot worker
- WebSocket sync-gateway 连接级 capability gate（6 close codes）

**权限**
- 36 capability vocab + 5 role bundle（ADR-0002）
- Principal kind ∈ {user, org, service}；Phase 1 桥到 better-auth
- Document-level invitation flow（邮件 webhook 可选）
- ORCID OAuth (Phase 1.5 可选)

**渲染**
- 5 emitter：HTML / JATS / Markdown / Typst source / PDF（Typst CLI）+ Word（Phase 1.5）
- CJK pre-pass：标点挤压 + smart quote by lang + 思源 / Noto fallback chain
- 端到端导出 `GET /api/export/<docId>/<format>`

**AI 与协作 agent**
- ai-runtime：plugin host + skill loader + MCP client + Anthropic / mock runner + Provenance writer
- 6 个内置 plugin：citation / inline-editor / reviewer / researcher / source-extractor / coordinator
- 6 个 skill：citation-lookup / inline-editor / reviewer-style / literature-review / source-extraction / coordinator
- ModelProvider 抽象 + 4 wireFormat（anthropic / openai-compat / ollama / custom-http）
- BYO 模型 4 档 resolver：document-override > user-pref > manifest-hint > env-default
- Coordinator real loop（多步 dispatcher + sync/async handoff + scratchpad + `[final]` 终止）
- Human-in-the-loop：propose → review → accept / modify / reject → commit
- 每次 AI 行为有完整 Provenance（actor / agent context / promptHash / toolCalls）

**Plugin / Sandbox**
- ADR-0010 plugin manifest + 用户安装路径
- ADR-0012 Bubblewrap (Linux) / sandbox-exec (macOS) / AppContainer (Windows) 三平台沙箱描述符
- capability prompt UI + install row 校验（capability superset / https-only git URL）

**Source / Maintenance**
- source + source_extraction PG schema（PDF.js / readability ingestion 推 Phase 4 W4）
- maintenance_finding 表 + scan worker：3 SQL-pure finding 生成器（unsupported-claim / outdated-source / unverified-ai-block）

**MCP**
- 真 CrossRef stdio MCP server + crossref-mock（CI / 离线 fallback）
- mcp_server PG 表 + 注册表（ADR-0006）

---

## 仓库结构

```
collaborationtool/
├── apps/
│   ├── web/                     # Next.js 15 + better-auth + Editor + 导出 + AI invoke
│   ├── sync-gateway/            # WebSocket capability gate + InMemory/YSweet body backend
│   ├── snapshot-worker/         # 周期 Y.Doc snapshot → PG bytea
│   ├── agent-worker/            # pgboss subscribe + maintenance-scan job
│   └── prototypes/              # Phase 0 / Phase 2 spike（proto-a/b/c/d）
├── packages/
│   ├── schema/                  # 8 实体 single source of truth
│   ├── permissions/             # capability + role bundle + JWT + ACL loader
│   ├── editor-core/             # TipTap 9 extension + paperSchema + commit serializer
│   ├── typography/              # CJK pre-pass + font tokens
│   ├── render-myst/             # PM JSON → MyST AST → HTML/JATS/Markdown
│   ├── render-typst/            # PM JSON → Typst source + CLI wrapper
│   ├── ai-runtime/              # plugin host + skill loader + MCP client + ModelProvider 4 adapter + coordinator loop
│   ├── molab-protocol/          # iframe postMessage 6 kind + cell auth-token JWT
│   ├── import-typst/            # Typst → PM (typst query subprocess)
│   ├── import-latex/            # LaTeX → PM (myst subprocess)
│   └── auto-fix/                # broken source 自动修复
├── plugins/
│   ├── citation-agent/          # DOI 核查 + propose
│   ├── inline-editor-agent/     # 段落改写
│   ├── reviewer-agent/          # 批判性审阅
│   ├── researcher-agent/        # 文献调研
│   ├── source-extractor/        # source ingestion
│   ├── coordinator-agent/       # multi-agent 编排（manifest 声明 prefers_provider 长上下文）
│   └── registry.json            # built-in plugin id → path
├── skills/                      # 6 个 SKILL.md（Anthropic-style）
│   └── _registry.json
├── mcp-servers/
│   ├── crossref/                # 真 CrossRef HTTPS stdio MCP
│   ├── crossref-mock/           # 测试 / 离线 fallback
│   └── registry.json            # mcp_server PG 表 seed
├── infra/
│   ├── docker/                  # docker-compose.yml (Postgres 16 + MinIO + y-sweet)
│   ├── drizzle/                 # 13 + 7 better-auth 表 schema + 10 migrations + round-trip tests
│   └── walg/                    # WAL-G 备份 overlay（Phase 1.5）
├── templates/myst/              # myst 默认模板
├── tests/e2e/                   # Playwright 双作者 spec（HTTP-driven）
├── docs/                        # USER_GUIDE.md + SELF_HOST.md
└── plan0/
    ├── adr/                     # 15 ADR（0001-0015）
    ├── phase-0..4-execution-plan.md
    ├── prototypes-report.md
    ├── paper-platform-system-prompt.md
    └── paper-platform-landscape.md
```

---

## 快速开始（dev / self-host）

```bash
# 1. 装依赖
pnpm install

# 2. 起 Postgres + MinIO + y-sweet
pnpm db:up
pnpm db:migrate
pnpm db:seed

# 3. 生成 secrets
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export SYNC_TOKEN_SECRET=$(openssl rand -base64 32)
export DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool

# 4. 起 web + gateway（两个终端）
pnpm web:dev          # :3000
pnpm gateway:start    # :4321

# 5. 浏览器打开 http://localhost:3000
```

完整自托管手册（含 typst CLI / WAL-G 备份 / ORCID / mailer / 字体 / 故障排查）：[`docs/SELF_HOST.md`](./docs/SELF_HOST.md)

用户路径（注册 → 创建文档 → 邀请共著者 → 编辑 → AI 协作 → 接受 / 拒绝 → 导出）：[`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md)

---

## 测试 / 类型检查

```bash
pnpm typecheck                 # 全 workspace 类型检查（PASS）

# 单包测试
pnpm db:test                   # 18 round-trip
pnpm perms:test                # 60 permissions
pnpm gateway:test              # 30 E2E + unit + env
pnpm web:test                  # 23 单测
pnpm editor:test               # 21 schema/wire/commit
pnpm snapshot:test             # 11
pnpm typo:test                 # 22 CJK / quote / font
pnpm render-myst:test          # 24 PM → AST → HTML/JATS
pnpm render-typst:test         # 17 source generation
pnpm ai-runtime:test           # 98（含 install 13 + resolver 9 + coordinator-loop 7）
pnpm mcp-crossref:test         # 10
pnpm e2e:test                  # Playwright 双作者，~22s
```

---

## ADR 导航

| ADR | 标题 | 状态 |
|---|---|---|
| 0001 | 数据模型 & CRDT/Postgres 拆分 | Accepted |
| 0002 | 权限模型（Capability + Principal） | Accepted |
| 0003 | 技术栈锁定（11 项 + 双管线渲染） | Accepted |
| 0004 | 部署拓扑 + 安全基线 | Accepted |
| 0005 | Render API 边界 | Accepted |
| 0006 | MCP server 注册与发现 | Accepted |
| 0007 | Computational cell embedding + iframe 协议 | Accepted (with caveat) |
| 0008 | Long-horizon agent runtime + reviewer/researcher | Accepted (with caveat) |
| 0009 | Diff library + revision overlay UI + rebase 语义 | Accepted |
| 0010 | 扩展系统边界 + Plugin API + Skill 元数据扩展 | Accepted |
| 0011 | Claim/Evidence/Counterpoint/Synthesis 一等知识对象层 | Accepted |
| 0012 | Plugin sandbox + 用户安装路径 + capability 提示 UI | Proposed (Phase 4 W1 dogfood gate) |
| 0013 | ModelProvider abstraction + BYO 模型 + 配置存储 | Proposed (Phase 4 W2 dogfood gate) |
| 0014 | Yjs subdocument 章节级拆分 + cross-reference sync | Proposed (Phase 4 W5-W6) |
| 0015 | Open peer review + ORCID-signed reviews | Proposed (Phase 4 W8) |

---

## 开发约定

- **ADR-driven**：技术决策先写 ADR（一页内说清 trade-off），后落 commit
- **STATUS.md 是 source of truth**：phase 推进 / commit landed / ADR 状态变化时同步更新
- **测试 / typecheck 是 commit gate**：包级 `pnpm <pkg>:test` + 全局 `pnpm typecheck`
- **monorepo by pnpm workspace**：`packages/* | apps/* | apps/prototypes/* | mcp-servers/* | plugins/* | infra/drizzle | tests/e2e`
- **commit message 风格**：`P<phase>(<n>): <短描述>` 或 `W<n>: <短描述>` —— 参 `git log`
- **开发分支**：feature work 在 `claude/*` 分支；PR 到 main 前 STATUS.md 同步

---

## License

[MIT](./LICENSE)
