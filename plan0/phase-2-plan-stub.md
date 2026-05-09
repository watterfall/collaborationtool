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

- system-prompt §15 第二个差异化锚点
- **未答**：是 Phase 2 还是 Phase 3 起步？议程是"先做长 horizon agent → spatial canvas
  在 Phase 3 解锁"还是"Phase 2 做 minimum spatial canvas 即可"
- 若 Phase 2 做：以 Document graph（contribution DAG + cross-document citation 图）
  为后端，前端 Cytoscape.js / d3-force / sigma.js 选一

---

## 四、Phase 2 不做的事（明示）

- **fork / merge UI** —— Phase 3
- **章节级隔离 / Yjs subdocument 拆分** —— Phase 3
- **客户端 BYO 模型（local Ollama）** —— Phase 3
- **用户挂自己的 localhost MCP server** —— Phase 3（安全模型未成熟）
- **开放评审 / 50+ 协作者** —— Phase 4
- **Loro / Automerge 3 切换** —— Phase 4

---

## 五、Phase 2 路线图节奏（粗）

- **W1**：ADR-0007 (computational cell embedding) + ADR-0008 (long-horizon agent)
- **W2-W3**：Reviewer agent + Research agent backend；diff UI spike
- **W4**：molab iframe 集成 + computational-output PM node
- **W5**：MathLive + 表格/定理 NodeView；prompt registry UI
- **W6**：Phase 2 验收 e2e（5 人 + 2 reviewer agent + 1 computational cell + 多 revision rebase）

具体 D-list 在 Phase 2 kickoff 时拉满（参考 Phase 1 D7–D16 的粒度）。

---

## 六、Phase 2 kickoff 前的准备清单

- [x] Phase 1.5 7 项全部 close（在 `claude/review-project-status-w2iNI` 分支；待 PR / merge）
- [x] ADR-0007 起草（computational cell embedding + iframe 协议）— 2026-05-09 Proposed
- [x] ADR-0008 起草（long-horizon agent runtime）— 2026-05-09 Proposed；选 pgboss + SSE
- [x] 选定 long-horizon agent runtime —— **pgboss + SSE**（ADR-0008 §2.1）
- [x] 选定 diff 库（**prosemirror-changeset**，ADR-0009 + `apps/prototypes/proto-d-diff-library/` spike）
- [ ] molab embedding 文档读完 + 联系 Marimo 团队（如 iframe 协议有空白）
