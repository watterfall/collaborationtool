# Phase 3 计划（stub） · Knowledge maintenance + Source Reader + Spatial canvas + Plugin marketplace

> Phase 2 W1-W7 已交付 6 ADR + 26 包架构（plugin 系统 / Claim-Evidence 知识对象 / molab protocol / agent_job runtime / 三 import scaffolds）。Phase 3 把"开发者用得通"提升到"用户日常用得顺"。本 stub 列 Phase 3 kickoff 时**必须先讨论**的开放问题。≤ 1 页。

最后更新：2026-05-09（Phase 2 closeout）

---

## 〇、Phase 2.5 前置（不在 Phase 3 内）

Phase 2 已交付的 scaffold 须在 Phase 2.5（~2 周）实测对接真服务，再进 Phase 3。详见 `phase-2-plan-stub.md §8.4`：

1. molab.org 真 iframe 端到端
2. reviewer / researcher agent plugin 实施（require ANTHROPIC_API_KEY）
3. Real Typst CLI / mystmd CLI subprocess + Auto-Fix loop
4. Evidence Map / AI context pack PG e2e（多文档 cross-reuse）
5. 5 人协作 e2e
6. W2/W3 spike 报告（Typst.ts WASM、Loro）归档

Phase 2.5 不出新 ADR；只是把 Phase 2 scaffolds 在真服务上压测 + bug fix。

---

## 一、Phase 3 范围（待用户 kickoff 确认）

| 维度 | Phase 2 已做 | Phase 3 目标 |
|---|---|---|
| 知识对象 | Claim/Evidence/ClaimLink schema + PM 块 + Evidence Map API | **Source Reader UI**（左源 / 右 AI 抽取叠加）+ **AI 自动 ingestion**（source → claim/evidence 抽取流水线） |
| 写作界面 | Tiptap 空白页 + 4 NodeView + AgentPanel | **Draft Composer**（claim 驱动写作界面，左侧 claim/evidence 抽屉，右侧带 trust overlay 的草稿）—— essay §8.3 |
| 维护 | 无 | **Knowledge maintenance scan job**（unsupported claims / outdated sources / 自相矛盾 / 重复观点）—— essay §7.4 |
| 协作 | 5-10 人共写（Phase 2.5 实测） | **50+ 协作者 / 章节级隔离 / Yjs subdocument 拆分** |
| Agent | 4 plugin（citation / inline-editor / reviewer / researcher） | **Coordinator agent**（agent 间 handoff，多 agent 协作）+ **Researcher agent 跨 source 查找** |
| 平台 | Plugin loader + 内部 4 plugin + 第三方 tmpdir 验证 | **用户挂自己 MCP server / agent / skill**（POST /api/plugin/install Phase 3 开放给 user role；前置 OS 沙箱 + capability 提示 UI） |
| Spatial | 无 | **Spatial canvas / 研究地图**（推迟自 Phase 2 §3.4） |
| 决策对象 | annotation_thread 拼凑 | **Decision / Question 一等对象评估**（先看 annotation 是否撑得住；不撑住 → 加表） |
| 模型 | Server-side Anthropic only | **客户端 BYO 模型（local Ollama / OpenAI / 自托管）** |

---

## 二、必须先答的开放问题

### 2.1 Source Reader UI 形态

essay §8.1 形态：左原文，右 AI 抽取（claim/evidence/question 候选）；用户接受/修改/拒绝/合并/标待验证。

**待答**：
- 原文渲染：PDF.js（PDF）+ 纯 HTML（网页）+ Markdown 渲染（Markdown）—— 三套或统一？
- AI 抽取触发：用户主动 "extract" 还是导入即跑？
- 抽取结果落地：直接进 PG `claim`/`evidence` (status='ai-suggested') 还是先 staging 表 + 用户确认后入主表？
- 抽取 prompt + skill 设计：用 W5 plugins/citation-agent 模式，新建 plugins/source-extractor

### 2.2 Draft Composer 替换空白页

**前置**：Phase 2.5 必须先 dogfood 1-2 周用 Tiptap 空白页 + W5 Claim/Evidence 块写过实际文档；如果不痛 → 不做（user 哲学"避免过度抽象"）；痛 → 设计左 claim 抽屉 + 右草稿 + trust overlay。

### 2.3 Knowledge maintenance scan job

挂 ADR-0008 pgboss runtime，新 job kind 'maintenance-scan'。
**待答**：
- 触发：cron（每周）vs 用户主动 vs source 更新事件触发？
- 报告形式：annotation_thread{kind:'maintenance-note'} 还是新表 maintenance_finding？
- 范围：单文档 vs 整个 user vault？

### 2.4 50+ 协作者 + 章节级隔离

Phase 1 ADR-0001 §6 long debt 列了 Yjs subdocument 拆分。Phase 3 实施。
**待答**：
- 拆分粒度：章节？任意 heading？用户手动 group？
- subdocument 之间的 cross-reference 如何 sync？

### 2.5 用户挂自己 MCP server / agent / skill

ADR-0006 §2.5 + ADR-0010 §2.5 已经把 Phase 3 路径预留：admin-only Phase 2 → user role Phase 3。
**待答**：
- OS 沙箱选型：Bubblewrap (Linux) / chroot+seccomp / Docker container per plugin？
- Capability 提示 UI：用户安装时显示"该 plugin 要 network.fetch:domains:[zotero.org]"，accept/deny
- Marketplace 起点：先 GitHub Discoveries / 后 dedicated registry？

### 2.6 客户端 BYO 模型

essay §11.5 反对锁定。Phase 3 加 local Ollama / 自托管 OpenAI 兼容 endpoint 配置。
**待答**：
- 配置存储：用户级（settings page） vs 文档级（per-doc model override）？
- ai-runtime 抽 ModelProvider 接口（Anthropic / OpenAI / Ollama / custom HTTP），plugin 可声明 modelProvider 偏好

---

## 三、Phase 3 不做的事（明示）

- **章节级 fork / merge UI**（推 Phase 4，subdocument 跑稳后）
- **开放评审 / 50+ 协作者公开同行评审**（推 Phase 4，需要 reputation 系统）
- **Loro / Automerge 3 切换**（推 Phase 4，除非 1.0 在 Phase 3 期间发布）
- **跨设备同步**（推 Phase 4，user-installed MCP server 需要先做）
- **Plugin marketplace 商业化**（推 Phase 4+；Phase 3 仅 GitHub-discovery + Git URL install）

---

## 四、Phase 3 路线图节奏（粗，待 kickoff 拍板）

预估 8 周（比 Phase 2 7 周略多，因 Source Reader / Draft Composer 是 UX 重活）：

- **W1**：Source Reader UI（PDF.js + HTML + Markdown 三 reader 统一抽屉模型）
- **W2**：AI 自动 ingestion 流水线（plugins/source-extractor + staging 表 + 用户审阅 UI）
- **W3**：Draft Composer prototype（左 claim 抽屉 + 右草稿 + trust overlay）+ user dogfood 1 周
- **W4**：Knowledge maintenance scan job（pgboss + maintenance_finding 表）
- **W5**：用户挂自定义 plugin（OS 沙箱 + capability 提示 UI）
- **W6**：Coordinator agent（agent 间 handoff + 多 agent 协作）
- **W7**：客户端 BYO 模型（ModelProvider 抽象 + Ollama / OpenAI / custom）
- **W8**：Phase 3 验收 e2e（dogfood 跑 4 个 essay §13 真实场景：博士生 / 咨询 / 产品 / 独立写作）+ Spatial canvas spike

具体 D-list 在 Phase 3 kickoff 时拉满。

---

## 五、Phase 3 期间技术雷达

继承 Phase 2 §七 主动 spike + 被动 watch；新增：

- **Loro 1.0 release**（持续 watch；若稳定 → ADR review）
- **Automerge 3 + automerge-repo**（同上）
- **Bubblewrap / WasmEdge / Quark.js**（plugin sandbox 候选；Phase 3 W5 实施时主动 spike）
- **Pyodide WASM 浏览器 Python**（与 molab 解耦的 fallback；Phase 3 W2 评估）

---

## 六、Phase 3 kickoff 前的准备清单（待办）

- [ ] Phase 2.5 7 项实测全部 close
- [ ] 用 1-2 周 dogfood Phase 2 完整流程（Source → Claim → Evidence → Draft → Review → Export）
- [ ] 收集 dogfood 反馈：Draft Composer 是否真痛？Source Reader UI 是否需要按 source 类型分？
- [ ] essay §13 4 个真实场景各跑一次（博士 / 咨询 / 产品 / 独立写作）找 gap
- [ ] 选定 plugin sandbox 技术
