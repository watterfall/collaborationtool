# 项目状态 · Living Dashboard

> 唯一的"项目当前在哪"快照。每个 phase 推进 / commit landed / ADR 状态变化时更新本文件。
> 历史 / 决策细节看 `plan0/`；本文件是执行视角。

最后更新：2026-05-08（claude/analyze-project-status-jZyUu，D14 完成）

---

## 1. 当前阶段

**Phase 0：✅ 完成**（6/6 交付物，3 个原型实证，4 个 ADR 落地）

**Phase 1：⏳ 进行中**（D7 ✅ + D8 ✅ + D9 ✅ + D10 ✅ + D11 ✅ + D12 ✅ + D13 ✅ + D14 ✅）

下一动作：D15（两人协作 E2E + 双语 demo + 投稿格式导出）。

---

## 2. ADR 状态

| ADR | 标题 | 状态 | gate |
|---|---|---|---|
| 0001 | 数据模型 & CRDT/Postgres 拆分 | **Accepted** | D3 dual-tab Playwright 自动化 ✅ |
| 0002 | 权限模型（Capability + Principal） | Proposed | Phase 1 D8 sync-gateway 实施时升 Accepted |
| 0003 | 技术栈锁定（11 项 + 双管线渲染） | Proposed（§3 Accepted） | D4 实证 ✅；其余 Phase 1 D7–D14 实施时升 Accepted |
| 0004 | 部署拓扑 + 安全基线 | TBD | Phase 1 W1 起草，W4 Accepted |
| 0005 | Render API 边界 | TBD | Phase 1 W3 起草 |
| 0006 | MCP server 注册与发现 | 可推 Phase 2 | — |

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

## 4. Phase 1 交付物（10 项，未起手）

| # | 名称 | 状态 | 周 | 依赖 |
|---|---|---|---|---|
| D7 | Postgres + Drizzle schema + migrations | ✅ | W1 | ADR-0001 |
| D8 | `packages/permissions` + `apps/sync-gateway` shim | ✅ | W1-W2 | D7 |
| D9 | `apps/web` Next.js 15 + better-auth + Principal bridge | ✅ | W2 | D7-D8 |
| D10 | `packages/editor-core`（从 proto-a 提炼）+ snapshot worker | ✅ | W3 | proto-a / D7 |
| D11 | y-sweet 自托管 + S3-compat 持久化 | ✅ | W2-W3 | D8 / D10 |
| D12 | `packages/render-{myst, typst, typography}` + templates/myst | ✅ | W3-W4 | D10 |
| D13 | `mcp-servers/crossref` + `packages/ai-runtime` + 2 个 agent | ✅ | W3-W4 | D8 / D10 |
| D14 | Approval flow UI + commit boundary Provenance 联通 | ✅ | W4-W5 | D10 / D13 |
| D15 | 两人协作 E2E + 双语 demo + 投稿格式导出 | 🔜 next | W5 | D9-D14 |
| D10 | `packages/editor-core`（从 proto-a 提炼）+ snapshot worker | ⏸ | W3 | proto-a / D7 |
(状态例：⏸ pending / 🔜 next / ✅ done / 🚧 wip)
| D12 | `packages/render-{myst, typst, typography}` + templates 镜像 | ⏸ | W3-W4 | D10（与 D13 并行） |
| D13 | `mcp-servers/` 真实 + `packages/ai-runtime` + 2 个 agent | ⏸ | W3-W4 | D8 / D10（与 D12 并行） |
| D14 | Approval flow UI + commit boundary Provenance 联通 | ⏸ | W4-W5 | D10 / D13 |
| D15 | 两人 E2E + 双语 demo + 投稿格式导出 | ⏸ | W5 | D9-D14 |
| D16 | ADR-0004/0005 + 升 Accepted + Phase 2 plan stub | ⏸ | W5 | All |

详见 `plan0/phase-1-execution-plan.md`。

---

## 5. 仓库结构（当前）

```
collaborationtool/
├── apps/prototypes/           # Phase 0 三原型（Phase 1 起 proto-a 复用为 packages/editor-core 基础）
│   ├── proto-a-yjs-schema/    # y-prosemirror 异构 schema + Playwright e2e
│   ├── proto-b-cjk-render/    # MyST vs Typst 对比
│   └── proto-c-mcp-skill/     # MCP + Skill + Provenance 闭环
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
└── plan0/
    ├── adr/                   # 4 个 ADR
    ├── phase-0-execution-plan.md
    ├── phase-1-execution-plan.md
    ├── prototypes-report.md
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
pnpm ai-runtime:test        # 17 个测试（D14 加 4: reject/modify/list + 已有 accept）
pnpm mcp-crossref:test      # 7 个测试（real CrossRef MCP wrapper, mocked fetch）
# 端到端 invoke：POST /api/agent/invoke kind=citation|inline-editor
# 无 ANTHROPIC_API_KEY 时自动走 mock runner（CI / 离线均可跑）

# Phase 1 / D14：approval flow
# revision.proposal_metadata jsonb 存 fragments + uncertainties
# GET /api/revision?docId=... + POST /api/revision/<id>/{accept,reject,modify}
# UI: RevisionInbox + RevisionDiff（按 capability 显示）

# 全 workspace typecheck
pnpm typecheck              # 14 packages 全 PASS
```

---

## 7. 已知 Phase 1 工作项（来自 prototypes findings）

合计 12 项；详细在 `plan0/prototypes-report.md §5` + 各 prototype `findings.md` 末尾：

**proto-a 缺口（4）**：clock-skew uuidv7 collision / NodeView caching / schema-recovery monitoring / y-websocket → sync-gateway 切换

**proto-b 缺口（3）**：mystmd template 镜像 / language-naive smart-quote / 字体打包

**proto-c 缺口（5）**：PM steps 真实序列化 / approval UI / prompt registry 表 / 网关 capability 检查 / approval chain 填充

---

## 8. 公开问题（用户决策需要）

来自 `phase-1-execution-plan.md §九`：

1. 部署 target（self-hosted / Vercel+Neon / 混合）
2. 字体（Source Han / Noto / 其他）
3. demo 论文方向（CS / 教育 / 跨学科）
4. 第二位测试用户（W5 验收需要）
5. 默认 LLM（Claude Sonnet 4.6 / Opus 4.7 / BYO）
6. MCP server 范围（Zotero OAuth 是否在 Phase 1）
7. better-auth organization → Principal kind='org' bridge 方式
8. ORCID 登录是否 Phase 1.5 加

---

## 9. 风险红绿灯

| ID | 风险 | 状态 |
|---|---|---|
| R1 | better-auth API 不稳 | 🟡 W1 spike，准备 Auth.js fallback |
| R2 | y-sweet 自托管运营 | 🟡 docker-compose；Jamsocket cloud fallback |
| R3 | mystmd template 镜像滞后 | 🟢 W4 加 cron diff |
| R4 | Typst.ts WASM bundle 太大 | 🟢 服务端 typst CLI 默认 |
| R5 | PM steps 序列化边角 case | 🔴 高影响；W3-4 大量测试 |
| R6 | Phase 1 一个月预算超出 30% | 🟡 W3 守门 |
| R7 | LLM API 成本 | 🟢 quota + mock CI |
| R8 | y-prosemirror schema-recovery 在生产 | 🟡 baseline 已建；BlockNote/Slate fallback |
| R9 | better-auth org → Principal kind=org 不直接对应 | 🟡 bridge layer |
| R10 | docker-compose 用户机器不可重现 | 🟢 W5 找用户 self-host |
| R11 | 字体许可 | 🟢 OFL 都明确 |
| R12 | Phase 0 没预留的 schema 字段 | 🟡 D14 加 review log |

详见 `plan0/phase-1-execution-plan.md §八`。

---

## 10. 工作分支

| 分支 | 状态 | 用途 |
|---|---|---|
| `main` | ✅ 主线（Phase 0 已 merge） | — |
| `claude/review-project-plans-oRIn8` | merged via PR #1 | Phase 0 D1–D6 + 综合报告 |
| `claude/d3-websocket-strictmode-UfP6w` | merged via PR #2/#3 | proto-a D3 follow-ups + Playwright 自动化 |
| `claude/analyze-project-status-jZyUu` | 当前 | Phase 1 plan + STATUS + D7 + D8 + D9 + D10 + D11 + D12 + D13 + D14 |

---

## 11. Maintenance 注记

更新本文件的 trigger：
- 任何 commit 影响 ADR 状态
- 任何 D 启动 / 完成 / 砍掉
- Phase 推进
- 新风险出现 / 老风险红绿灯变化
- 任何用户决策（§8 开放问题）回答

不要在 PR 描述里复述 STATUS——本文件是 source of truth。PR 描述里 link 到 `STATUS.md` 的相关 section。
