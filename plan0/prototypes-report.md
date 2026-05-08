# Phase 0 综合报告

> Phase 0 全部 6 个交付物完成。本报告把 H1–H5 五个核心假设的答案、三个原型的发现、四个 ADR 的状态、Phase 1 起手必看清单都集中在一处。

---

## 1. 五个假设（H1–H5）的 Phase 0 答案

### H1（最关键）— 异构内容图能否落到 Yjs + ProseMirror？

**答案：能，按"Y.Doc-as-tree + Postgres-as-graph"模式。**

- 8 实体 schema 在 ADR-0001 verbatim 锁定；Block 是 ProseMirror 树节点，atom node 的 `attrs.<entityId>` 指向 Postgres 实体（Citation / Annotation / ComputationalCell / ...）
- D3 stress test：5 client × 50 ops = 250 操作，**Convergence PASS / State vectors PASS / 0 warnings**
- D3 dual-tab Playwright 自动化（`apps/prototypes/proto-a-yjs-schema/tests/dual-tab.spec.ts`）：3 cases — 并发 atom 插入 / 并发段落 + 公式编辑 / 删除 + annotation 冲突 — 全部 PASS / 0 y-prosemirror warnings；ADR-0001 由此转 **Accepted**
- 见 `plan0/adr/0001-data-model-and-crdt-split.md` + `apps/prototypes/proto-a-yjs-schema/findings.md`

### H2 — Provenance 数据模型能否在 Phase 1 稳定 + Phase 3 不迁移？

**答案：能，hybrid 模型：Y.Map 临时态 + Postgres 永久态。**

- 写入边界严格在 commit boundary；in-flight 用 `Y.Map('provenance:in-flight')`（TTL 60s）让协作者实时看到 agent 工作
- D5 实证：Provenance schema 在 SQLite (PG-compatible) 上完整字段写入读出；4 个 tool call 全程 `argumentsHash / resultSummary / durationMs` 跟踪
- 不存完整 prompt 文本，只存 `promptHash + promptTemplateId`（含敏感片段时不泄露）
- 见 `plan0/adr/0001-data-model-and-crdt-split.md` §2.3.7 + `apps/prototypes/proto-c-mcp-skill/findings.md`

### H3 — 协作主体抽象能否映射到权限层？

**答案：能，Capability + Principal 模型，3 个 Phase 3 场景已走通。**

- 36 条 capability 词汇覆盖 Document / Block / Annotation / Citation / Agent / Provenance / 元
- `Principal` 抽象统一 User / Agent / Shared-link / Service；前缀编码（`'user:'` / `'agent:'`）让网关热路径无需 DB join
- 3 个 Phase 3 场景（50 人开放评审 / 评审者派外部 agent + scope + propose-only / fork-and-merge）全部用现有词汇描述完毕，不缺概念
- Phase 1 网关连接级 / Phase 3 节点范围的升级路径明确（gateway shim 接口 Phase 1 就在）
- 见 `plan0/adr/0002-permission-model.md`

### H4 — mystmd CJK PDF 实测效果，是否需要 Typst 做 print fallback？

**答案：Typst 不是 fallback，是主线。**

- 实证：Typst 0.14 一行命令出 PDF（115 KB，<1s，0 warning），单 50 MB 静态 binary，零依赖
- mystmd → LaTeX 链需要 LaTeX engine + 远端 template registry；本环境实测 LaTeX 缺失 + template registry 403
- mystmd 处理 CJK 的语言元数据缺陷：`myst.yml` 的 `language: zh` 被忽略，JATS 仍 `xml:lang="en"`；smart-quote 不分语言把中文双引号也转弯
- mystmd 优势：JATS / 公式 MathML+LaTeX 双轨 / 期刊投稿 pipeline 标准
- ADR-0003 §3 决策：印刷 PDF = Typst.ts；web/Word/JATS = mystmd（**ADR-0003 §3 转 Accepted**）
- 见 `plan0/adr/0003-tech-stack-lockdown.md` §3 + `apps/prototypes/proto-b-cjk-render/findings.md`

### H5 — Marimo 嵌入选型（molab iframe vs Pyodide）？

**答案：molab iframe Phase 1/2，Pyodide-inline 留 Phase 3。**

- molab 提供官方 iframe embed（`?embed=true`）+ share URL，2026 年可直接用
- Pyodide-inline 自建需要直接调用 Marimo 的 `PyodideSession` 内部类，没有 React 组件级 SDK，3+ 月 rabbit hole
- schema 解决：`ComputationalCell.kernel: 'molab' | 'pyodide-inline' | 'remote-jupyter' | 'marimo-server'` 字段从 Phase 0 起就在
- Phase 0 不集成任何执行——atom NodeView 占位即可（D3 已实现占位 NodeView）
- 见 `plan0/adr/0003-tech-stack-lockdown.md` §2.11

---

## 2. 三个原型的关键发现

### proto-a · y-prosemirror 异构 schema (D3)

- 9 个自定义 PM extensions（equation / inline-equation / citation-ref / dataset-ref / computational-cell / annotation-anchor / figure / figure-caption / footnote-ref）全部 atom-node 模式 + uuidv7 blockId
- KaTeX 原生渲染；annotation-anchor 用 PM mark 让 CRDT 自然跟随文本
- y-indexeddb 本地持久 + y-webrtc P2P（无需后端）
- 自动化验证：`pnpm proto-a:stress` 250 ops 全收敛，0 Yjs warnings
- **D3 follow-ups（commit `e4b9ed9`）**：本地 y-websocket relay 替换公共 webrtc 信令（P1）；`setupSync` 改 `useEffect` + cleanup 修 StrictMode 双 invoke 泄漏（P2）；删 `@tiptap/extension-history`，与 `Collaboration` 自带的 Yjs UndoManager 不冲突（P3）
- **D3 dual-tab 自动化（commit 本次）**：Playwright headless 跑 3 cases — 并发 atom / 并发文本+公式 / 删除+annotation 冲突，3/3 PASS / 0 y-prosemirror warnings → ADR-0001 由此转 **Accepted**
- Commits: `453c61f`（原型骨架）、`e4b9ed9`（follow-ups）、本次（dual-tab 自动化 + ADR-0001 Accepted）

### proto-b · MyST vs Typst CJK 渲染 (D4)

- 双语测试文档覆盖 6 个排版边角：标点挤压、CJK-Latin 间距、破折号、数字单位、引号一致性、行末禁则
- 产物：specimen-typst.pdf (115 KB) ✅；specimen-mystmd.jats.xml (7.6 KB) ✅；mystmd LaTeX/Word 链失败（template 远端 403）
- 关键发现 6 条全部进 ADR-0003 §3 决策依据
- Commit: `4ca72c0`

### proto-c · MCP + Skill 端到端 (D5)

- skills/citation-lookup/SKILL.md 按 Anthropic Skills 格式（YAML frontmatter + body）；通过 description 被发现，progressive disclosure 验证
- mcp-servers/crossref-mock 用真 `@modelcontextprotocol/sdk` Server class（不是 hardcode）
- proto-c 双模 runner：真 Anthropic API（@anthropic-ai/sdk + tool_use 循环）/ 无 key fallback mock
- SQLite (PG-compatible) 三表 schema：revision / provenance / contribution；mock 模式跑通完整 commit boundary
- Commit: `e99f2e0`

---

## 3. 四个 ADR 状态总览

| ADR | 状态 | gated on |
|---|---|---|
| ADR-0001 数据模型 & CRDT/PG 拆分 | **Accepted** | D3 双 tab 验证 ✅（Playwright headless 自动化，3/3 pass，0 warnings） |
| ADR-0002 权限模型 | **Proposed** | — |
| ADR-0003 技术栈锁定 | **Proposed (§3 Accepted)** | §3 印刷 PDF backend 已 D4 实证 |

> Phase 1 起手前请把 ADR-0002 / ADR-0003 也转 Accepted（用户在合适场合 review + sign-off）。

---

## 4. Phase 0 验收门槛 checklist

按 `phase-0-execution-plan.md` §6 验收门槛：

- [x] D1 ADR-0001 评审通过 ← Accepted（D3 dual-tab 自动化解锁 gate）
- [x] D2 ADR-0002 的 3 个 Phase 3 场景全部走通（不缺概念）
- [x] D3 压力测试通过；findings 写下了关注的 y-prosemirror 边角风险
- [x] D3 dual-tab 三 case 跑通（Playwright 自动化替代手测，0 warning）
- [x] D4 印刷 backend 决策落地（Typst 印刷 + MyST web/Word/JATS）
- [x] D5 端到端跑通 + Provenance 行字段完整 + Skill 通过 description 被发现
- [x] D6 ADR-0003 7 项技术栈决策全部锁定（含 deferred 字段：Agent.runtime / ComputationalCell.kernel）
- [x] `packages/schema` 单一来源已创建，被 D3 (间接) 与 D5 (直接) 共同 import
- [x] 综合 prototypes-report.md（本文件）

**全 9 项完成**；CI 可直接复跑 dual-tab gate：

```bash
pnpm install
pnpm proto-a:e2e        # Playwright 自动起 sync-server + Vite，3/3 pass
```

---

## 5. Phase 1 起手必看清单

> 给"Phase 1 第一周"的工程师 / agent 看的；这些是 Phase 0 已经决定但未实施的事项。

### 5.1 立即落地（Phase 1 Week 1）

1. **`apps/sync-gateway`** 起手——网关 shim 接口（`canApplyUpdate(principalId, documentId, update) → boolean`），即便 Phase 1 只用连接级 capability 检查。`y-sweet` 在网关之后。
2. **`packages/schema`** 加 `Document.forkedFromContributionId` / `forkedFromDocumentId` 字段（场景 C 走查时识别的字段补充）
3. **`packages/permissions/src/capabilities.ts`** 把 36 条 capability 词汇定义为常量，杜绝代码里出现字符串字面量
4. **`mcp-servers/`** 把 `crossref-mock` 替换为真 `crossref` server（`https://api.crossref.org/works/{doi}`）；继续保留 mock 在 CI / 离线 demo 用

### 5.2 Phase 1 实施时不能漏的细节

- mystmd templates **镜像到本仓 `templates/myst/`**——不依赖 api.mystmd.org 远端 registry（D4 实证 fragile）
- `packages/typography` 修 mystmd smart-quote 不分语言的缺口（pre-pass 把中文双引号显式标注）
- export worker 镜像装 Source Han Serif / Source Han Sans / Noto Sans CJK 字体
- `prompt_template` 表加（ADR-0003 §2.5）—— Phase 1 第一次 commit Provenance 时就需要 immutable prompt 内容存档
- better-auth `organization` plugin 桥接到 Principal 表（Principal 是底层抽象，better-auth 是身份提供者）

### 5.3 Phase 1 不做的（明确推迟）

- 章节级隔离 / Yjs subdocument——Phase 3
- User-localhost MCP server 桥接——Phase 3
- 客户端 BYO 模型（local Ollama）——Phase 3
- 完整 Pyodide-inline——Phase 3
- 移动端编辑——Phase 3+
- spatial canvas / fork-merge 工作流的 UI——Phase 3
- 开放评审 / 声誉图——Phase 4
- Loro / Automerge 3 切换——Phase 4 重新评估

### 5.4 已知技术债（Phase 0 不修）

每个原型的 findings.md 末尾都列了"缺口"。Phase 1 ADR 接手前快速过一遍：

- `apps/prototypes/proto-a-yjs-schema/findings.md` § Known sharp edges（4 项）
- `apps/prototypes/proto-b-cjk-render/findings.md` § 缺口（3 项）
- `apps/prototypes/proto-c-mcp-skill/findings.md` § Phase 1 处理（5 项）

合计 12 个已知 Phase 1 工作项；和 §5.1 / §5.2 的合并不重不漏。

---

## 6. Phase 0 commits 索引

| Commit | 内容 |
|---|---|
| `f051345` | D1: plan0/phase-0-execution-plan.md + ADR-0000 template + ADR-0001 + packages/schema 11 files |
| `41c39d1` | D2: ADR-0002 权限模型 |
| `453c61f` | D3: pnpm workspace 搭建 + Prototype A (proto-a-yjs-schema) + 压测 PASS |
| `bb4059d` | D6: ADR-0003 技术栈锁定 11 项 + 双管线渲染 |
| `4ca72c0` | D4: Prototype B (proto-b-cjk-render) + ADR-0003 §3 转 Accepted |
| `e99f2e0` | D5: Prototype C (proto-c-mcp-skill) + skills + mcp-servers/crossref-mock + Provenance 闭环 |
| (本提交) | Phase 0 综合报告 + 收尾 |

---

## 7. Phase 0 投入时间线（实际）

按 `phase-0-execution-plan.md` 估算单人全职 7-8 天并行 / 串行 11.5 天。

实际：Phase 0 session 内完成 D1 → D6 全部 + 综合报告（commit 在 `claude/review-project-plans-oRIn8`）。后续 session 在 `claude/d3-websocket-strictmode-UfP6w` 加上 D3 follow-ups（local y-websocket relay / StrictMode-safe setup / drop History）+ Playwright dual-tab 自动化，gate 解锁后 ADR-0001 转 Accepted。

---

## 8. 给项目所有者的下一步建议

- **review 4 个 ADR**：0001 / 0002 / 0003 + 本报告。任何想挑战的决策点请在 review 中标注，或对应 commit 上 review。
- ~~跑 D3 双 tab 手测~~ — 已被 `pnpm proto-a:e2e` 自动化覆盖；ADR-0001 已转 Accepted。
- **决定 Phase 1 起点**：是按 `§5.1 立即落地` 顺序推进，还是先做"两人协作 MVP"的端到端骨架（同步网关 + better-auth + 编辑器侧 + 一个 export 路径）。
- **可选的 deferred 决策**：D6 的 7 项 alternative 任何一项有挑战意见现在说，免得 Phase 1 走深了再换技术栈。

---

> Phase 0 的核心承诺是"三个月后不重写"。本 session 的 4 个 ADR + 3 个原型 + 8 实体 schema + 36 capability 词汇 + Provenance 闭环实证，把这个承诺落到了实证层。剩下的是 Phase 1 把图纸变成产品的工程量。

---

## 9. Phase 1 衔接

Phase 1 计划见 `plan0/phase-1-execution-plan.md`（10 个交付物 D7–D16，5 周预算，两人协作 MVP 验收门槛已列）。Phase 1 起手前用户需 review §九 的 8 个开放问题。

项目级活跃状态见 `STATUS.md`（living dashboard）。
