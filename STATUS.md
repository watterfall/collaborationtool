# 项目状态 · Living Dashboard

> 唯一的"项目当前在哪"快照。每个 phase 推进 / commit landed / ADR 状态变化时更新本文件。
> 历史 / 决策细节看 `plan0/`；本文件是执行视角。

最后更新：2026-05-10（claude/phase-3-to-phase-4-antaC，**Phase 3 closeout + Phase 4 stub**）。Phase 3 8 启动 commit + 4 closeout 改动：(closeout-1) migration 0010 加 4 schema（agent_job.parent_job_id W6 / user_model_pref W7 / document_model_override W7 / plugin_install W5），第 24/25/26 表落地；(closeout-2) ai-runtime 加 3 个 ModelProvider adapter（OpenAI-compat / Ollama / custom-http），含 stub-fetch 单元测试 11 项；(closeout-3) coordinator dispatch 工具（parseCoordinatorDecision + dispatchSyncHandoffs）+ 9 单元测试；(closeout-4) ADR-0012/0013 review log Phase 3 closeout 段；plan0/phase-4-plan-stub.md 起草（W1-W10 路线图）。**ai-runtime 测试 48 → 69 PASS**（+11 BYO provider + 9 coordinator dispatch + 1 cleanup），**全 workspace typecheck PASS**。Phase 3 推迟项移交 Phase 4：bwrap 真启动 + 4 endpoint round-trip + LLM-driven coordinator + maintenance scan 真跑 + Yjs subdocument。ADR-0012/0013 维持 **Proposed**，Phase 4 W1/W2 dogfood gate 通过后 promote Accepted。)

---

## 1. 当前阶段

**Phase 0：✅ 完成**（6/6 交付物，3 个原型实证，4 个 ADR 落地）

**Phase 1：✅ 完成**（10/10 交付物 D7–D16，5 个 ADR 全部 Accepted，2 篇用户文档，1 个 Phase 2 plan stub）

**Phase 1.5：✅ 完成**（7/7 patch 全部 close；见 `plan0/phase-2-plan-stub.md §二`）。

**Phase 2：✅ 完成** —— W1-W7 全部交付：
- W1: mcp_server 表 + plugins 骨架 + ADR-0006/0010
- W2: AgentPluginModule 契约 + 等价性测试 + agent_job 表 + apps/agent-worker stub
- W3: dogfood gate 三项 criteria 全 PASS（plugin path 正确性 / 第三方 tmpdir / no internal-only API）
- W4: molab-protocol 6 kind postMessage + Figure.sourceCellId + cell auth-token JWT
- W5: ADR-0011 + Claim/Evidence schema + 2 PM block container + inline-editor 切 plugin
- W6: import-typst + import-latex + auto-fix 三 scaffold 包
- W7: Evidence Map API + AI context pack export 路由

**Phase 2.5（工程对接 + 真服务实测）：6/7 工程对接已交付**（剩 3 项依赖真服务推 dogfood 环境）。spike 结论：Typst.ts WASM **推 Phase 3+ 重测**；Loro **继续 Yjs through Phase 3**（subdocument trigger 时再评估）。

**Phase 3：✅ backend 完成（W1-W7 schema + scaffold + closeout 4 件）**。详见 `plan0/phase-3-plan-stub.md` + `plan0/phase-4-plan-stub.md`：
- W1+W2: source + source_extraction PG schema + source-extractor plugin（PDF.js / readability 真 ingestion 流水线 + Source Reader UI 推 Phase 4 W4）
- W4: maintenance_finding PG 表 + scan job descriptor（real scan logic + LLM "duplicate detection" 推 Phase 4 W4 实施）
- W5: ADR-0012 plugin sandbox 设计 + plugin_install PG 表（migration 0010）；Bubblewrap + capability deny e2e 推 Phase 4 W1 dogfood gate
- W6: coordinator handoff types + dispatch 工具（parseCoordinatorDecision + dispatchSyncHandoffs，9 单元测试）+ agent_job.parent_job_id 字段；LLM dispatch loop 推 Phase 4 W3
- W7: ADR-0013 ModelProvider abstraction + 4 adapter（anthropic / openai-compat / ollama / custom-http）+ user_model_pref + document_model_override PG 表；4 endpoint 真 round-trip 推 Phase 4 W2 dogfood gate
- 推迟：W3 Draft Composer（dogfood-trigger）+ W8 spatial canvas spike（前端）

**Phase 4：📋 stub 起草**（`plan0/phase-4-plan-stub.md` W1-W10）。核心：跑 Phase 3 deferred 4 dogfood gate（plugin sandbox / BYO model / coordinator real / maintenance scan real）+ 启动 §三 4 项（subdocument scale / 章节 fork-merge / 开放同行评审 / 跨设备同步 + Loro/Automerge 3 review）。

---

## 2. ADR 状态

| ADR | 标题 | 状态 | gate |
|---|---|---|---|
| 0001 | 数据模型 & CRDT/Postgres 拆分 | **Accepted** | D3 dual-tab Playwright 自动化 ✅；D16 加 Phase 1 implementation review log §7 |
| 0002 | 权限模型（Capability + Principal） | **Accepted** | D8 + D9 + D14 + D15 实施 ✅；D16 promote + 加 §8 review log |
| 0003 | 技术栈锁定（11 项 + 双管线渲染） | **Accepted** | D7–D15 全部用本 ADR 11 项栈，无中途切换；D16 promote + 加 §9 review log |
| 0004 | 部署拓扑 + 安全基线 | **Accepted** | D16 直 Accepted；6 进程拓扑 + secrets / TLS / CORS / CSP / 备份基线 |
| 0005 | Render API 边界 | **Accepted** | D16 直 Accepted；PM JSON wire format + 5 emitter 签名锁定，stable through Phase 2 |
| 0006 | MCP server 注册与发现 | **Accepted** | mcp_server PG 表 + registry.json seed + plugin loader 集成 W1-W3 全 PASS；§7 review log 记 W2 env-var → 注册表迁移完成 |
| 0007 | Computational cell embedding + iframe 协议 | **Accepted (with caveat)** | molab-protocol 6 kind 类型化 + parseInbound/Outbound + Figure.sourceCellId attr + cell auth-token JWT 路由全 PASS；caveat: 真 molab.org iframe 端到端 e2e 推 Phase 2.5（需 molab 实例可达） |
| 0008 | Long-horizon agent runtime + reviewer/researcher agent | **Accepted (with caveat)** | agent_job + agent_job_event 表 + apps/agent-worker pgboss subscribe stub 全 PASS；caveat: reviewer/researcher plugin 实施推 Phase 2.5（require ANTHROPIC_API_KEY + 真实 reviewer prompt 设计） |
| 0009 | Diff library + revision overlay UI + rebase semantics | **Accepted (Phase 0 spike + Phase 1 D14 实证)** | proto-d-diff-library spike + D14 acceptRevision 流程已实证 prosemirror-changeset 选型；Phase 2 W2-W3 实施未额外开 commit（已经在 Phase 1 D14 落地大部分 contributor 路径） |
| 0010 | 扩展系统边界 + Plugin API + Skill 元数据扩展 + Dogfood 路径 | **Accepted** | W3 dogfood gate 三项 criteria 全 PASS + W4-W5 follow-up inline-editor 切到 plugin 路径完成（hardcode `agents/citation.ts` + `agents/inline-editor.ts` 全删；`packages/ai-runtime/src/agents/` 目录已删） |
| 0011 | Claim/Evidence/Counterpoint/Synthesis 一等知识对象层 | **Accepted** | W5 schema + PM 节点（claim + evidence block container）+ W7 Evidence Map / AI context pack 路由全 PASS；§7 review log 写 W7 dogfood gate criteria 三项 |
| 0012 | Plugin sandbox + 用户安装路径 + capability 提示 UI | **Proposed** | 2026-05-09 Phase 3 W5 起草；OS 沙箱选 Bubblewrap (Linux) / sandbox-exec (macOS Phase 4) / AppContainer (Windows Phase 4)；HTTPS proxy enforce manifest network domains；**Phase 3 closeout**: plugin_install PG 表 + 3 enum 落地（migration 0010）；§7 review log 加 closeout 段。bwrap 实启 + capability deny e2e 推 Phase 4 W1 dogfood gate (require Linux host) |
| 0013 | ModelProvider abstraction + BYO 模型 + 配置存储 | **Proposed** | 2026-05-09 Phase 3 W7 起草；4 wireFormat（anthropic / openai-compat / ollama / custom-http），配置存储双层（user_model_pref + document_model_override），API key env 变量 self-host 友好；plugin manifest 加 prefers_provider；**Phase 3 closeout**: 4 adapter 全交付 + 11 stub-fetch 单元测试 PASS + user_model_pref / document_model_override PG 表落地（migration 0010）；§7 review log 加 closeout 段。4 endpoint 真 round-trip 推 Phase 4 W2 dogfood gate |

---

## 3. Phase 0 交付物

| # | 名称 | 状态 | commit / 文件 |
|---|---|---|---|
| D1 | ADR-0001 数据模型 + 8 实体 schema | ✅ | `f051345` + `packages/schema/` |
| D2 | ADR-0002 权限模型 | ✅ | `41c39d1` |
| D3 | Prototype A（y-prosemirror 异构 schema） | ✅ | `453c61f` + `e4b9ed9` + `68a559b`（dual-tab 自动化） |
| D4 | Prototype B（MyST vs Typst CJK） | ✅ | `4ca72c0` |
| D5 | Prototype C（MCP + Skill + Provenance 闭环） | ✅ | `e99f2e0` |
| D6 | ADR-0003 技术栈锁定 | ✅ | `bb4059d` |
| — | 综合报告 | ✅ | `2d4d075` + `plan0/prototypes-report.md` |

**5 个假设答案**：H1 ✅ Y.Doc-as-tree + PG-as-graph / H2 ✅ Hybrid Provenance / H3 ✅ Capability + Principal / H4 ✅ Typst 印刷 / H5 ✅ molab iframe

---

## 4. Phase 1 交付物（10/10 ✅）

| # | 名称 | 状态 | 周 | 关键产出 |
|---|---|---|---|---|
| D7 | Postgres + Drizzle schema + migrations | ✅ | W1 | 13 表 + 18 round-trip 测；3 migrations |
| D8 | `packages/permissions` + `apps/sync-gateway` shim | ✅ | W1-W2 | 36 capability + 5 role bundle + JWT + WS gate（6 close codes） |
| D9 | `apps/web` Next.js 15 + better-auth + Principal bridge | ✅ | W2 | signup/login/session + Principal bridge（user/org/service） |
| D10 | `packages/editor-core` + snapshot worker | ✅ | W3 | 9 PM extension + paperSchema + commit serializer + Editor.tsx |
| D11 | y-sweet 自托管 + S3-compat 持久化 | ✅ | W2-W3 | BodyBackend 抽象（InMemory + YSweet）+ snapshot-worker |
| D12 | `packages/render-{myst, typst, typography}` | ✅ | W3-W4 | 5 格式导出（HTML/JATS/MD/Typst/PDF）+ CJK pre-pass |
| D13 | `mcp-servers/crossref` + `packages/ai-runtime` + 2 个 agent | ✅ | W3-W4 | real CrossRef MCP + Anthropic/mock runner + Provenance writer |
| D14 | Approval flow UI + commit boundary Provenance 联通 | ✅ | W4-W5 | RevisionInbox + 3 endpoints (accept/reject/modify) + approval_chain |
| D15 | 两人协作 E2E + 双语 demo + 投稿格式导出 | ✅ | W5 | tests/e2e（22.8s PASS）+ specimen-bilingual + USER_GUIDE/SELF_HOST |
| D16 | ADR-0004/0005 + 升 Accepted + Phase 2 plan stub | ✅ | W5 | ADR-0004 + ADR-0005 + ADR-0001/2/3 review log + phase-2-plan-stub |

详见 `plan0/phase-1-execution-plan.md` 与 各 ADR 的 Phase 1 implementation review log。

---

## 5. 仓库结构（当前）

```
collaborationtool/
├── apps/prototypes/           # Phase 0 三原型 + Phase 2 spike（proto-d）
│   ├── proto-a-yjs-schema/    # y-prosemirror 异构 schema + Playwright e2e
│   ├── proto-b-cjk-render/    # MyST vs Typst 对比
│   ├── proto-c-mcp-skill/     # MCP + Skill + Provenance 闭环
│   └── proto-d-diff-library/  # ⭐ Phase 2 W2 spike — prosemirror-changeset vs diff-match-patch + rebase 语义实证（ADR-0009 实证基础）
├── packages/schema/           # 8 实体 single source of truth（11 个 .ts，~330 LOC）
├── packages/permissions/      # ⭐ D8/D9 — 36 capability vocab + 5 role bundles + JWT + ACL loader + Principal bridge
├── packages/editor-core/      # ⭐ D10 — TipTap 9 extensions + paperSchema + commit serializer + Editor.tsx + sync-gateway transport
├── packages/typography/       # ⭐ D12 — CJK pre-pass: spacing + smart-quote-by-lang + font tokens
├── packages/render-myst/      # ⭐ D12 — PM JSON → MyST AST → HTML/JATS/Markdown
├── packages/render-typst/     # ⭐ D12 — PM JSON → Typst source + typst CLI compile wrapper
├── packages/ai-runtime/       # ⭐ D13 — skills loader + MCP client set + Anthropic/mock runner + Provenance writer + 2 agents
├── apps/sync-gateway/         # ⭐ D8/D11 — WebSocket capability gate + InMemory/YSweet body backends + y-sweet HTTP client
├── mcp-servers/crossref/      # ⭐ D13 — real CrossRef HTTPS MCP server
├── apps/web/                  # ⭐ D9/D10/D12 — Next.js 15 + better-auth + Editor + /api/sync-token + /api/export/<docId>/<format>
├── apps/snapshot-worker/      # ⭐ D10/D11 — periodic Y.Doc snapshot service + y-sweet HTTP fetcher
├── templates/                 # ⭐ D12 — myst/default style baseline (Phase 1.5: full mystmd templates mirror)
├── infra/                     # ⭐ D7/D9/D11 — docker-compose (Postgres 16 + MinIO + y-sweet) + Drizzle
│   ├── docker/                # docker-compose.yml + postgres-init/
│   └── drizzle/               # 13 + 7 better-auth 表 schema + 2 migrations + 18 round-trip tests
├── mcp-servers/crossref-mock/ # mock MCP server (CI / 离线 demo 保留)
├── skills/citation-lookup/    # Anthropic-style SKILL.md
├── tests/e2e/                 # ⭐ D15 — Playwright two-author MVP spec (HTTP-driven)
├── docs/                      # ⭐ D15 — USER_GUIDE.md + SELF_HOST.md
└── plan0/
    ├── adr/                   # 5 个 ADR（0001/02/03/04/05 全 Accepted）
    ├── phase-0-execution-plan.md
    ├── phase-1-execution-plan.md
    ├── phase-2-plan-stub.md   # ⭐ D16 — Phase 2 kickoff 前必看（待答开放问题）
    ├── prototypes-report.md   # ⭐ D16 加 §5.5 Phase 1 close-out
    ├── paper-platform-system-prompt.md
    └── paper-platform-landscape.md
```

---

## 6. 关键命令

```bash
# 一次性安装
pnpm install

# Phase 0 / proto-a：双 tab 自动化（CI gate）
pnpm proto-a:e2e            # Playwright headless，3/3 PASS / 0 warning，~52s

# Phase 0 / proto-a：本地 dev（双 tab 手动）
pnpm proto-a:sync           # terminal 1：y-websocket relay
pnpm proto-a:dev            # terminal 2：Vite

# Phase 0 / proto-a：CRDT 收敛压力测试
pnpm proto-a:stress         # 5 client × 50 ops，250 ops 全收敛 / 0 warnings

# Phase 0 / proto-c：MCP + Skill + Provenance 端到端 demo
pnpm --filter @collaborationtool/proto-c-mcp-skill demo            # mock 模式
pnpm --filter @collaborationtool/proto-c-mcp-skill demo:dump       # 含完整 Provenance JSON
ANTHROPIC_API_KEY=sk-... pnpm --filter @collaborationtool/proto-c-mcp-skill demo:dump  # 真 API

# Phase 1 / D7：Postgres + Drizzle
pnpm db:up                  # docker compose up -d Postgres 16
pnpm db:migrate             # 应用 migrations（idempotent）
pnpm db:seed                # 写入 seed fixtures（service principal / demo user / citation agent）
pnpm db:test                # 18 个 round-trip 测试（需 DATABASE_URL）
pnpm db:typecheck           # tsc --noEmit
pnpm db:down                # 停 Postgres

# Phase 1 / D8：permissions + sync-gateway
pnpm perms:test             # 60 个 permissions 测试（含 PG 集成 + bridge）
pnpm perms:typecheck
pnpm gateway:dev            # tsx watch（需 SYNC_TOKEN_SECRET）
pnpm gateway:start          # 生产模式
pnpm gateway:test           # 30 个 E2E + unit + env 测试
pnpm gateway:typecheck

# Phase 1 / D9：apps/web
pnpm web:dev                # next dev（需 BETTER_AUTH_SECRET + SYNC_TOKEN_SECRET）
pnpm web:build              # next build
pnpm web:start              # next start
pnpm web:typecheck
pnpm web:test               # 23 个单测（observability 8 + ORCID 8 + mailer 3 + invitation 4）

# Phase 1.5 #1：document-level invitation（替代 SQL grant）
# UI 入口：编辑器右上角 [分享 / Share] 按钮（要 capability.grant 权限）
# 邮件 backend：MAIL_WEBHOOK_URL 设了 → POST webhook；未设 → 链接 print 到 stderr

# Phase 1 / D10：editor-core + snapshot-worker
pnpm editor:test            # 21 个 schema/wire/commit round-trip 测试
pnpm editor:typecheck
pnpm snapshot:tick          # 单次 snapshot 扫描（CLI）
pnpm snapshot:start         # daemon（YSWEET_URL 时走 y-sweet HTTP）
pnpm snapshot:test          # 11 个测试（5 PG 集成 + 6 y-sweet 源 mock）
pnpm snapshot:typecheck

# Phase 1 / D11：y-sweet + MinIO 自托管
pnpm db:up                  # 起 docker-compose（Postgres + MinIO + y-sweet）
# YSWEET_URL=http://localhost:8080 + YSWEET_AUTH=... 切换 gateway 至 YSweetBackend

# Phase 1 / D12：渲染三剑客
pnpm typo:test              # 22 个 CJK / smart-quote / font tokens 测试
pnpm render-myst:test       # 24 个 PM-to-AST + HTML + JATS round-trip 测试
pnpm render-typst:test      # 17 个 source generation + escape 测试
# 端到端导出（GET /api/export/<docId>/<format>）：html / jats / markdown / typst-source / pdf
# PDF 需要服务器装 typst CLI；其他格式纯 TS

# Phase 1 / D13：AI runtime + agents
pnpm ai-runtime:test        # 9 个测试（D14 加 4: reject/modify/list + 已有 accept）
pnpm mcp-crossref:test      # 10 个测试（7 wrapper mocked-fetch + 3 stdio bin 子进程冒烟）
# 真 CrossRef stdio：CROSSREF_MCP_COMMAND=tsx CROSSREF_MCP_ARGS='["mcp-servers/crossref/src/bin.ts"]' pnpm web:start
# 端到端 invoke：POST /api/agent/invoke kind=citation|inline-editor
# 无 ANTHROPIC_API_KEY 时自动走 mock runner（CI / 离线均可跑）

# Phase 1 / D14：approval flow
# revision.proposal_metadata jsonb 存 fragments + uncertainties
# GET /api/revision?docId=... + POST /api/revision/<id>/{accept,reject,modify}
# UI: RevisionInbox + RevisionDiff（按 capability 显示）

# Phase 1 / D15：two-author E2E + bilingual specimen + onboarding docs
pnpm e2e:test               # Playwright HTTP-driven full flow，~22s
# specimen: apps/web/public/demo/specimen-bilingual.{json,md}
# docs: docs/USER_GUIDE.md + docs/SELF_HOST.md

# Phase 2 / W2 spike：diff library 选型 + rebase 语义（ADR-0009 实证基础）
pnpm proto-d:demo           # 跑 base / reviewer-A / reviewer-B / 两种 rebase 场景，~3s
pnpm proto-d:typecheck

# 全 workspace typecheck
pnpm typecheck              # 15 packages 全 PASS
```

---

## 7. 已知 Phase 1 工作项（来自 prototypes findings）

合计 12 项；详细在 `plan0/prototypes-report.md §5` + 各 prototype `findings.md` 末尾：

**proto-a 缺口（4）**：clock-skew uuidv7 collision / NodeView caching / schema-recovery monitoring / y-websocket → sync-gateway 切换

**proto-b 缺口（3）**：mystmd template 镜像 / language-naive smart-quote / 字体打包

**proto-c 缺口（5）**：PM steps 真实序列化 / approval UI / prompt registry 表 / 网关 capability 检查 / approval chain 填充

---

## 8. 公开问题（用户决策需要）

来自 `phase-1-execution-plan.md §九`，Phase 1 D16 收尾时的实际处理：

1. 部署 target → ADR-0004 §2.1 锁定单 host docker-compose（Phase 1） + Vercel/K8s 留 Phase 2
2. 字体 → Source Han + Noto CJK，OFL，docker image apt-get（USER_GUIDE §1）
3. demo 论文方向 → bilingual specimen（500 字中英混排，跨学科风格；apps/web/public/demo/specimen-bilingual.{json,md}）
4. 第二位测试用户 → e2e fixture（HTTP-driven 注册第二个 user 而非真人）
5. 默认 LLM → ANTHROPIC_API_KEY 时 Claude Sonnet 4.6（ai-runtime/src/agent-runner.ts）；缺失时 mock runner
6. MCP server 范围 → CrossRef real（D13）+ crossref-mock（CI fallback）；Zotero OAuth 推 Phase 2
7. better-auth org → Principal kind='org' bridge → `principal-bridge.ts:createOrgPrincipal` 已实现
8. ORCID 登录 → 推 Phase 1.5（phase-2-plan-stub §二 #2）

新一轮开放问题已转入 `plan0/phase-2-plan-stub.md §三`（Phase 2 kickoff 前必答）。

---

## 9. 风险红绿灯（Phase 1 收尾结案）

| ID | 风险 | Phase 1 结果 |
|---|---|---|
| R1 | better-auth API 不稳 | 🟢 closed — D9 集成无重大 bug；drizzle-orm 0.45 升级解决 peer-dep |
| R2 | y-sweet 自托管运营 | 🟢 closed — docker-compose 路径打通；Phase 4 horizontal scale 重新评估 |
| R3 | mystmd template 镜像滞后 | 🟢 closed — D12 走自写 MyST emitter，未引入 mystmd CLI；Phase 1.5 可选 |
| R4 | Typst.ts WASM bundle 太大 | 🟢 closed — 服务端 typst CLI 默认（D12） |
| R5 | PM steps 序列化边角 case | 🟢 closed — D10 commit serializer 21 round-trip 测试；D13/D14 ai-runtime 17 测试 |
| R6 | Phase 1 一个月预算超出 30% | 🟢 closed — D7-D16 在 5 周内完成 |
| R7 | LLM API 成本 | 🟢 closed — mock 默认；ADR-0004 §2.7 quota 规划 |
| R8 | y-prosemirror schema-recovery 在生产 | 🟢 closed — D10 + D15 全程无 silent-drop |
| R9 | better-auth org → Principal kind=org 不直接对应 | 🟢 closed — `createOrgPrincipal` D9 桥接 OK |
| R10 | docker-compose 用户机器不可重现 | 🟢 closed — SELF_HOST.md 实测沙箱 + 无 docker daemon path |
| R11 | 字体许可 | 🟢 closed — OFL 明确 |
| R12 | Phase 0 没预留的 schema 字段 | 🟢 closed — Phase 1 实际未发现 schema gap，D7 + D14 仅加 prompt_template + revision.proposal_metadata 两个非破坏字段 |

Phase 2 风险登记 → `plan0/phase-2-plan-stub.md` 起草 ADR-0007/8 时新建。

详见 `plan0/phase-1-execution-plan.md §八`。

---

## 10. 工作分支

| 分支 | 状态 | 用途 |
|---|---|---|
| `main` | ✅ 主线（Phase 0 已 merge） | — |
| `claude/review-project-plans-oRIn8` | merged via PR #1 | Phase 0 D1–D6 + 综合报告 |
| `claude/d3-websocket-strictmode-UfP6w` | merged via PR #2/#3 | proto-a D3 follow-ups + Playwright 自动化 |
| `claude/analyze-project-status-jZyUu` | merged via PR #4 | Phase 1 plan + STATUS + D7 + D8 + D9 + D10 + D11 + D12 + D13 + D14 + D15 + D16 (Phase 1 close-out) |
| `claude/review-project-status-w2iNI` | 当前 | Phase 1.5 #6 Real CrossRef stdio MCP |

---

## 11. Maintenance 注记

更新本文件的 trigger：
- 任何 commit 影响 ADR 状态
- 任何 D 启动 / 完成 / 砍掉
- Phase 推进
- 新风险出现 / 老风险红绿灯变化
- 任何用户决策（§8 开放问题）回答

不要在 PR 描述里复述 STATUS——本文件是 source of truth。PR 描述里 link 到 `STATUS.md` 的相关 section。
