# Phase 2 计划（stub） · AI 多 agent 协作 + 可执行单元嵌入 + 语义级 diff

> Phase 1 D7–D15 已交付两人 MVP；D16 收尾把 ADR-0001/02/03 promote Accepted、新增 ADR-0004/05、写下用户 / 部署文档。本 stub 不是承诺，是 Phase 2 kickoff 时**必须先讨论 / 拍板**的开放问题清单。≤ 1 页。

---

## 一、Phase 2 范围（待用户确认）

| 维度 | Phase 1 已做 | Phase 2 目标 |
|---|---|---|
| AI agent | 单回合 inline editor + citation lookup | **长 horizon** reviewer + research agent；agent 间 handoff |
| 可执行单元 | PM atom 占位 + computational-cell schema | **molab iframe** 嵌入 + 双向数据传递（cell 输出 → PM citation/figure） |
| 协作规模 | 2 人 reviewer/author | 5–10 人共写 + reviewer agent 异步评审；50 人留 Phase 3 |
| 版本/diff | accepted/rejected 两态 | **PM step 语义可视化** diff；多 revision 并存 + 互相 rebase |
| 输入法 | TipTap 默认 | **MathLive** 公式输入；表格 / 定理-证明结构 NodeView |
| Skill 生态 | `skills/` 目录 + 内置 5 skill | **prompt registry** 公开 UI（fork / version / 测评） |

---

## 二、Phase 1.5（Phase 2 之前的两周补丁）

D15 USER_GUIDE.md 列的 7 个 known limitation，全部归集到 Phase 1.5。**不写新 ADR**，每项一个 commit：

1. **Invitation flow** — ✅ 已落地（新表 `doc_invitation` + migration 0004；`apps/web/src/lib/invitations.ts` createInvitation/acceptInvitation/listPending/renderInvitationEmail；POST `/api/document/<docId>/invitation` + GET 列表 + POST `/api/invitation/<id>/accept`；ShareDialog 编辑器右上角；`/invite/<id>` 接受页 + `?next=` login redirect；mailer.ts webhook + console fallback；7 个单测；不再 SQL grant，USER_GUIDE §1.3 重写）
2. **ORCID OAuth** — ✅ 已落地（better-auth `genericOAuth` plugin 注 ORCID provider，env-gated；`apps/web/src/lib/orcid.ts` 含 `mapOrcidTokenToProfile` + 占位 email 策略 `<orcid>@orcid.placeholder`；客户端 `OrcidSignIn` 按钮、登录/注册页接入；`(app)/layout.tsx` 显示用户绑定的 ORCID iD；8 个单测覆盖 mapper + provider config）
3. **Sentry + PostHog** — ✅ 已落地（hand-rolled HTTP capture，零 SDK 依赖；`apps/web/src/lib/observability.ts` 包 `captureError`/`captureEvent`/`anonDistinctId`/`isSlow`；hook 进 `/api/agent/invoke` + `/api/export`；fire-and-forget 不阻塞响应；env 不设自动 no-op；8 个单测 PASS）
4. **Word (.docx) 导出** — ✅ 已落地（自写 docx emitter + `docx` npm 包，避开 mystmd unified pipeline 依赖；图片 binary fetch 留 Phase 2）
5. **PmDocInput → @collaborationtool/schema 提取** — ✅ 已落地（消除两个 render 包的重复；ADR-0005 §2.4 deadline 命中）
6. **Real CrossRef stdio MCP** — ✅ 已落地（`mcp-servers/crossref/src/bin.ts` 通过 `StdioServerTransport` 自托管；`packages/ai-runtime` 加 `stdioServerTransport` 工厂 + `invokeCitationAgent.crossrefMcp` override；apps/web 路由读 `CROSSREF_MCP_COMMAND/ARGS/CWD`，不设则 fallback in-memory mock；3 个 stdio bin 子进程冒烟测全 PASS / 网络由 in-process HTTP stub 驱动）
7. **PG WAL-G 备份** — ✅ 已落地（`infra/walg/Dockerfile` 给 postgres:16-bookworm 装 WAL-G v3.0.5；`postgres.archive.conf` 开 archive_mode + archive_command；`infra/scripts/walg-{backup,restore}.sh` 二脚本；`infra/docker/docker-compose.walg.yml` overlay：定制 image + walg-backup sidecar 每天 04:00 拉基线 + 7 天保留；`wal-g.json.example` 模板覆盖 R2/AWS/MinIO；SELF_HOST 加一键启用 + 季度恢复演练步骤）

**1.5 进度**：✅ **7/7 全部 close**。Phase 2 kickoff 前清单见 §六。

---

## 三、Phase 2 必须先答的开放问题

### 3.1 Reviewer Agent / Research Agent 的 capability shape

✅ **ADR-0008 已答**：pgboss + SSE 异步运行时（agent_job + agent_job_event 两表）；
具名 agent（`Citation Reviewer Agent v1.2`，AgentKind enum 加 `reviewer`/`researcher`）；
reviewer reject 强制配套 `annotation_thread{kind:'reviewer-note'}`。详见
`plan0/adr/0008-long-horizon-agent-runtime.md`。

### 3.2 molab / Marimo iframe 的契约

✅ **ADR-0007 已答**：figure with `attrs.sourceCellId`（不引入新 node type）；
postMessage 协议 6 个 kind（cell.config / execute → ready / progress / executed / error）；
5 分钟 JWT + 5 MB artifact 上限。详见 `plan0/adr/0007-computational-cell-embedding.md`。

### 3.3 语义级 diff 的 UI 模型

✅ **ADR-0009 已答**：选 `prosemirror-changeset`（diff-match-patch 仅作 textContent
fallback，不进 revision 数据流）；UI granularity 三档同源（block / token / mark-aware
semantic hint）都派生自 `Change[]`；多 reviewer overlay 各自以 base 为根独立计算 ChangeSet
不串行；rebase 默认 auto（`Step.map(mapping)` 全成功）/ `step.map===null` 时降级 manual
resolve 三栏 UI。实证 `apps/prototypes/proto-d-diff-library/` + ADR-0009
+ `pnpm proto-d:demo`。

### 3.4 spatial canvas（"研究地图"）

✅ **已答（2026-05-09 review-project-goals）**：**Phase 3 起步**。
理由：(a) Phase 2 W1-W5 已被 long-horizon agent + molab + diff UI 占满；
(b) spatial canvas 后端依赖 contribution DAG + cross-document citation graph
两个图，前者要等 Phase 2 多 reviewer rebase 跑通后形态才稳；
(c) 优先用 W6/W7 补 §3.5 + §3.6 两个差异化必备（扩展系统 + 迁移摩擦）。

### 3.5 扩展系统边界（kernel vs plugin） — 从 review 中新增

✅ **已答（2026-05-09 review-project-goals）**：**Phase 2 W1 起草 ADR-0010
+ W3 末 dogfood gate**。

**Why now**：system-prompt §六 + landscape §六/七 把扩展系统列为 Phase 0/1
硬约束；Phase 1 D7-D16 没显式做（agents hardcode 在 `packages/ai-runtime/src/agents/`，
SKILL.md 缺 `trigger_patterns` + `provides_tools`，kernel vs plugin 未划线）。
反模式 §348 警告"先做 MVP 再加扩展系统"——再推到 Phase 3 等于回头重构
ai-runtime + mcp-client + skills-loader。

**ADR-0010 必答**：
- 哪些 packages 是 core（候选：`schema` / `permissions` / `editor-core` /
  `render-myst|typst|typography` / `ai-runtime` 的 runtime 部分），哪些是
  built-in plugin（`agents/citation` / `agents/inline-editor` / `mcp-servers/*` / `skills/*`）
- Plugin manifest 格式（capability 声明 + lifecycle + 加载入口）
- SKILL.md 元数据补 `trigger_patterns` + `provides_tools`（landscape §七 草图）
- AI agent 按需加载多 skill 的 dispatch 协议（取代当前"启动时单一加载"）
- 用户挂自定义 plugin 的安装/卸载/审计流程（registry JSON + Git URL 起手；marketplace 推 Phase 4+）

**W3 末 dogfood gate**：把 `packages/ai-runtime/src/agents/citation.ts` 改造成
"通过 ADR-0010 plugin API 加载的第一个 reference 实现"。如果 API 不能让
citation agent 用同样接口跑通——**停下来重新设计 ADR-0010**，不要将就
（system-prompt §75 硬约束）。

### 3.6 项目导入（Typst-first） + Auto-Fix Retry Loop — 从 review 中新增

✅ **已答（2026-05-09 review-project-goals）**：**Phase 2 W6 一并做**。

**哲学约束**：项目偏好 **Typst > LaTeX**（与 Phase 0 proto-b D4 决策一致，Typst
印刷胜出 / 0 warning / <1s 编译 vs mystmd LaTeX 远端 fragile）。同时崇尚"非常新但
有颠覆潜力"的技术（如 refactoringhq/tolaria 这一类）——技术雷达放在 §六，对
新候选保持 review trigger 而非锁死。

- **Typst 项目导入（一等公民）**：unzip Typst project（`.typ` 主文件 + 子文件 +
  资源）→ Typst CLI 解析 AST → 转 PM tree → 写入 Document/Block。Phase 0
  proto-b 已验证 Typst CLI / WASM 可控；Phase 1 D12 已嵌入 typst CLI 渲染管线，
  导入复用同一基础设施。
- **LaTeX 项目导入（迁移摩擦减压，不是哲学偏好）**：landscape §157 + 反模式
  §348 点名"降低迁移摩擦是产品分发的关键"——大多数存量学术用户在 Overleaf 上
  有几年 LaTeX 积累，**这是分发战术，不是默认范式**。Phase 2 W6 实现：unzip
  → mystmd CLI（已 Phase 1 D12 嵌入）解析 .tex 树 → 转 PM tree。**范围严格**
  （user 2026-05-09 哲学约束"避免过多兼容性问题"）：
  - **不做** 自定义 macro / TikZ / 自定义文档类的特例适配
  - **不做** 为 LaTeX 怪 case 写专用 Auto-Fix 修复路径
  - 超出 mystmd 标准能力时一律 raw 字段保留 + 显式报错，让用户手工拆
  - **导入完成后，内部表示与 Typst 导入产物等价（PM tree + 8 实体），用户后续
    编辑、渲染、导出默认仍走 Typst-first 管线**——LaTeX 是入口，不是范式
- **Auto-Fix Retry Loop**（landscape 模式 3）：编译/渲染/引用解析失败 →
  AI 拿 error + 上下文 → 修正 → 重试 ≤3 次；侧边小角标可见但不打扰；
  失败后才弹通知。和 ADR-0008 long-horizon agent 复用 pgboss + SSE。

---

## 四、Phase 2 不做的事（明示）

- **fork / merge UI** —— Phase 3
- **章节级隔离 / Yjs subdocument 拆分** —— Phase 3
- **客户端 BYO 模型（local Ollama）** —— Phase 3
- **用户挂自己的 localhost MCP server** —— Phase 3（安全模型未成熟；Phase 2 ADR-0010 仅设计 manifest，不开放 user 安装）
- **spatial canvas / 研究地图** —— Phase 3 起步（§3.4 已答）
- **plugin marketplace / 商业化** —— Phase 4+（Phase 2 仅 registry JSON + Git URL）
- **开放评审 / 50+ 协作者** —— Phase 4
- **Loro / Automerge 3 切换** —— Phase 4

---

## 五、Phase 2 路线图节奏（粗）

> **2026-05-09 review-project-goals 调整**：原 6 周 → 7 周（+16%，在守门 30% 内）。
> 加项：ADR-0010 扩展系统（W1）+ dogfood gate（W3 硬 gate）+ Typst.ts spike（W2）
> + Loro spike（W3）+ Typst-first 项目导入 + Auto-Fix（W6）+ 验收 e2e（W7）。

- **W1**：ADR-0006（MCP server 注册）+ ADR-0007 / 0008 / 0009 升 Accepted
  + **ADR-0010（扩展系统边界 / kernel vs plugin / SKILL.md 扩展元数据）**——
  **平台性头号工作**
- **W2**：Reviewer agent backend（pgboss + SSE per ADR-0008）；diff UI（per ADR-0009）；
  **Typst.ts WASM 浏览器编译 spike**（§7.1，与 agent backend 并行，不抢 critical path）
- **W3**：Research agent backend；diff UI 收尾；**Loro spike**（§7.1）；
  **W3 末 dogfood 硬 gate**：citation agent 切到 ADR-0010 plugin API
  ——**不通过则停下来重新设计 ADR-0010，绝不进 W4**（user 2026-05-09 哲学：
  平台性非常重要，不能"且做且看"）
- **W4**：molab iframe 集成 + computational-output PM node（per ADR-0007）
- **W5**：MathLive + 表格/定理 NodeView；prompt registry UI
- **W6**：**Typst project import**（一等公民，与 Phase 0 D4 决策一致）
  + **LaTeX import**（迁移摩擦减压，**严格范围** per §3.6——不为奇怪 macros 写特例）
  + **Auto-Fix Retry Loop**（编译/渲染/引用失败 → AI 修正 → 重试 ≤3 次，复用 pgboss）
- **W7**：Phase 2 验收 e2e（5 人 + 2 reviewer agent + 1 computational cell
  + 多 revision rebase + Typst project import demo + 至少 1 个**外部 plugin** 加载验证
  + W2/W3 两个 spike 报告归档到 ADR-0010 review log）

具体 D-list 在 Phase 2 kickoff 时拉满（参考 Phase 1 D7–D16 的粒度）。

---

## 六、Phase 2 kickoff 前的准备清单

- [x] Phase 1.5 7 项全部 close（在 `claude/review-project-status-w2iNI` 分支；待 PR / merge）
- [x] ADR-0007 起草（computational cell embedding + iframe 协议）— 2026-05-09 Proposed
- [x] ADR-0008 起草（long-horizon agent runtime）— 2026-05-09 Proposed；选 pgboss + SSE
- [x] 选定 long-horizon agent runtime —— **pgboss + SSE**（ADR-0008 §2.1）
- [x] 选定 diff 库（**prosemirror-changeset**，ADR-0009 + `apps/prototypes/proto-d-diff-library/` spike）
- [x] spatial canvas timing 已答 —— **Phase 3 起步**（§3.4，2026-05-09 review）
- [ ] **ADR-0006 起草**（MCP server 注册与发现）— Phase 2 W1
- [ ] **ADR-0010 起草**（扩展系统边界 / kernel vs plugin / Plugin manifest / SKILL.md 扩展元数据）— Phase 2 W1，§3.5 必答清单 5 项
- [ ] molab embedding 文档读完 + 联系 Marimo 团队（如 iframe 协议有空白）

## 七、技术雷达（Phase 2 期间）

> 项目哲学（user 2026-05-09 review-project-goals 重申）：
> **偏 Typst、崇尚颠覆性新技术、避免过度兼容性投入、平台性非常重要**。
> 雷达分两层：**主动 spike**（Phase 2 内排时间验证可行性，不 commit 切换）
> + **被动 watch**（每月扫一次，触发再评估）。
> 与 landscape §五"长期跟踪"重叠的不重复列。

### 7.1 主动 spike（Phase 2 内排时间）

| 候选 | spike 窗口 | 验证目标 | 不通过时的退路 |
|---|---|---|---|
| **Typst.ts WASM 浏览器编译** | W2（与 Reviewer agent 并行） | bundle ≤5 MB / 编译 ≤1s 10 页双语 / 与服务端 typst CLI 输出一致 | 维持 Phase 1 D12 服务端 CLI；Phase 3 重测 |
| **Loro 生产就绪重评估** | W3（与 dogfood gate 并行） | API 稳定性、ProseMirror 适配、CJK 文本边界、与 Yjs y-prosemirror 收敛行为对比 | ADR-0003 不动，Phase 4 再评估；spike 报告写入 ADR-0010 review log |

**关键约束**：spike 的目的是**验证可切性**，不是承诺切换。任何切换决策走新 ADR
（既存 ADR 状态从 Accepted 不回退，参 ADR-0003 review log 范式）。

### 7.2 被动 watch（每月扫一次）

| 候选 | 类型 | 触发再评估的信号 |
|---|---|---|
| **refactoringhq/tolaria** | user 点名的"颠覆性"参考 | W1 起草 ADR-0010 时一并查；若与 collab/diff/agent runtime 任一线相关 → ADR review |
| **Typst 0.x → 1.0** | 渲染管线主线 | 1.0 release / package registry 上量 |
| **Automerge 3 + automerge-repo** | CRDT 升级路径辅线 | 大规模协作 / 长 history / 异构内容图原生支持 |
| **TypeTeX** (landscape 第二梯队) | Typst-first AI 学术编辑器 | 推出 Phase 2/3 重点功能时评估差异化 |
| **MyST CLI Node API** | 渲染管线辅线 | 新版 breaking 时考虑 fork |

**Watch cadence**：Phase 2 W3 / W7 末各扫一次，结果列入 STATUS §1 当前阶段段尾。
