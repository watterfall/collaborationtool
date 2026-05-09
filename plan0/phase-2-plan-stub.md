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

1. **Invitation flow** — better-auth invitation hook + email；不再 SQL 直接 grant
2. **ORCID OAuth** — 学术身份 + 显示 ORCID iD 在作者列；为 Phase 2 reviewer agent 的"匿名/具名 reviewer"打底
3. **Sentry + PostHog** — ADR-0004 §2.5 已规划
4. **Word (.docx) 导出** — ✅ 已落地（自写 docx emitter + `docx` npm 包，避开 mystmd unified pipeline 依赖；图片 binary fetch 留 Phase 2）
5. **PmDocInput → @collaborationtool/schema 提取** — ✅ 已落地（消除两个 render 包的重复；ADR-0005 §2.4 deadline 命中）
6. **Real CrossRef stdio MCP** — 取代 in-memory mock；ADR-0004 §2.1 列遗留
7. **PG WAL-G 备份** — ADR-0004 §2.6 列遗留

**1.5 进度**：4 + 5 已 close（合并 commit）；剩 1 / 2 / 3 / 6 / 7。

---

## 三、Phase 2 必须先答的开放问题

### 3.1 Reviewer Agent / Research Agent 的 capability shape

- 现有 `agent.invoke:reviewer` / `agent.invoke:researcher` 词汇已登记（ADR-0002 §2.1）
- **未答**：异步长 horizon（数分钟–数小时）任务怎么暴露给前端？SSE / pgboss / temporal？
- **未答**：reviewer agent 是匿名（"Reviewer 1"）还是具名（"Citation Reviewer Agent v1.2"）？
  影响 Provenance.actorPrincipalId 的 displayName 策略
- **未答**：reviewer agent 拒一个 revision 时是否产 `annotation_thread{kind:'reviewer-note'}`？
  现有 schema 已支持，待 UX 决定

### 3.2 molab / Marimo iframe 的契约

- ADR-0001 §2.3.5 已记录 ComputationalCell 字段（kernel / sourceCode / inputDatasetIds /
  outputArtifactRefs / executionEnv），Phase 1 仅 schema 占位
- **未答**：iframe ↔ 主页面的 postMessage 协议（cell 完成 → emit citation / figure 到 PM tree）
- **未答**：cell 输出的 artifact（PNG / Plot / DataFrame）以什么形式回到 PM 树？
  新 PM node type `computational-output` 还是 figure with `attrs.sourceCellId`？
  **必须一个 ADR**（建议 ADR-0007）

### 3.3 语义级 diff 的 UI 模型

- proto-c 已实证 PM step 序列化 + Yjs binary co-存
- **未答**：两个 reviewer 各自 propose 修改，UI 怎么并列展示 diff？token-level？
  block-level？
- **未答**：rebase 的语义（reviewer A 的 revision 已 accept，reviewer B 的 revision
  仍 pending —— B 的 PM step 自动 rebase 到新 base 还是要求手动 resolve？）
- 候选库：`prosemirror-changeset`, `diff-match-patch` （Phase 2 spike 选一）

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

- [ ] Phase 1.5 7 项全部 merge
- [ ] ADR-0007 + ADR-0008 起草（gate Phase 2 W2 实施）
- [ ] 选定 long-horizon agent runtime（temporal / pgboss / inngest / 自写）
- [ ] 选定 diff 库（prosemirror-changeset 评估）
- [ ] molab embedding 文档读完 + 联系 Marimo 团队（如 iframe 协议有空白）
