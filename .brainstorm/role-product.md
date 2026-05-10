# 产品差异化评审 · collaborationtool

> 角色：产品策略 + 竞品分析。基于 STATUS / README / system prompt / landscape / ADR-INDEX / USER_GUIDE 实读。
> 时间：2026-05-10（Phase 4 W4 backend + W5 subdoc 启动）。

---

## 1. 已交付的"真"差异化能力盘点

| # | 能力 | 仓库证据 | 竞品对照 |
|---|---|---|---|
| D1 | **Y.Doc-as-tree + PG-as-graph 拆分**：CRDT 体只放 inline-mergeable PM；引用 / claim / evidence / contribution / provenance 全部落 PG 关系图。 | `ADR-0001`、`packages/schema`、`packages/editor-core/wire/commit-serializer.ts` | Curvenote / Authorea 文档是 MyST / JSON 树；Overleaf 是 .tex 文件树；Notion 是 block 列表——**没有一家把"论证图"建成关系数据库一等节点**。 |
| D2 | **Capability + Principal（user/org/service）三元主体**：5 role bundle、36 capability，AI agent 与人类共用同一权限模型。 | `ADR-0002`、`packages/permissions`（60 测）、`apps/sync-gateway` 6 close codes | Overleaf / Curvenote / Notion 都是 RBAC owner/editor/viewer；**没有谁把"agent.invoke:reviewer / block.commit / capability.grant"做成原子能力**。 |
| D3 | **Provenance 写入是 commit boundary 的硬契约**：`actorPrincipalId / agentContext / promptHash / toolCalls[]` 缺一即拒提交。 | `packages/ai-runtime/src/provenance-writer.ts`、`approval_chain` 表、`revision.proposal_metadata` | Prism / Cursor 有 diff approval，但 promptHash + toolCalls 不是 schema 约束；Curvenote 完全没有；Stencila 早期做过但没贯穿到 UI。 |
| D4 | **Claim / Evidence / Counterpoint / Synthesis 一等节点**：论证结构进 PM schema + PG，maintenance scan 6 generator 直接基于这层 SQL 跑（unsupported-claim / contradicted-conclusion / duplicated-claim 等）。 | `ADR-0011`、`apps/agent-worker` 26 测 | **真正独有**——Manubot/PubPub 只是 fork-able doc，Octopus 把论文按 IMRAD 拆但没建论证图，PubPub 没有 maintenance scan。 |
| D5 | **MCP server 注册表 + 三层扩展（plugin / skill / MCP）**：plugin 是 agent 实现单元，skill 是 SKILL.md 自然语言能力包，MCP 是数据/工具 bus。 | `ADR-0006/0010`、`mcp-servers/`、`plugins/registry.json`、`skills/_registry.json` | Cursor 有 MCP 但无 SKILL.md；Anthropic Skills 有 SKILL.md 但没用在论文场景；**三层在同一架构下交叉是独家的**。 |
| D6 | **ModelProvider 4-wire abstraction + 4 档 resolver**：document-override > user-pref > manifest-hint > env-default；anthropic / openai-compat / ollama / custom-http。 | `ADR-0013`、`packages/ai-runtime/src/providers/`、`user_model_pref` / `document_model_override` 表 | Prism = GPT 锁定；Curvenote 无 LLM 选择；TypeTeX/Octree 单 provider；**self-host + per-document override 没人做到**。 |
| D7 | **Coordinator multi-step dispatcher**：sync+async 混合 handoff、scratchpad、`[final]` 终止、maxSteps 硬停、capability gating。 | `packages/ai-runtime/src/coordinator/loop.ts`、7 测 | Cursor Composer 是单 agent；CrewAI/LangGraph 是库不是产品；**论文场景里把 multi-agent 编排做成内核**——独家。 |
| D8 | **CJK pre-pass 一等公民**：标点挤压 + smart-quote-by-lang + 思源/Noto fallback chain，渲染前 normalize。 | `packages/typography`（22 测）、`render-myst` HTML emitter | Curvenote/Overleaf 都靠 LaTeX 自己的 CJK 包；Prism CJK 是后想；**做成独立 package 而非选项是少见的**。 |
| D9 | **三平台 plugin sandbox 描述符（bwrap / sandbox-exec / AppContainer）+ capability prompt UI**：装前显示要的能力，用户勾选 superset。 | `ADR-0012`、`lib/plugin-install.ts`、`/(app)/settings/plugins` | Obsidian 不 sandbox（社区已踩过坑）；VSCode 是 process-level；**研究写作工具里第一个把 OS-level sandbox 做进 manifest 的**。 |

---

## 2. 应该写进 elevator pitch 的 5 条（已交付但 README 没讲清）

README 当前的 4 条对比（vs Typst / Google Docs / Notion / Curvenote）都是"形容词级"的——读者无法判断你比 Curvenote 多了什么。建议替换为：

1. **"论文是论证图，不是文字流"** —— Claim/Evidence 是 PM 一等节点 + maintenance scan 自动找未支撑的 claim。这是 ADR-0011，README 完全没提。
2. **"AI 写的每一个字都有 promptHash + toolCalls 链"** —— 不是"我们记录 history"，而是每次 commit 缺 provenance 直接 P0 reject。USER_GUIDE 只在 §3.6 一句话带过。
3. **"自带模型，按文档可换"** —— 4 wire × 4 档优先级。Self-host 用户能在一篇论文上挂 Ollama，另一篇挂 Claude，第三篇挂私有 vLLM。这是 self-host 圈最强的卖点，README 仅一行。
4. **"Plugin 是真沙箱不是 Obsidian 式 trust-everything"** —— bwrap arg vector 已经在生产路径。这是给 lab admin 看的，README 当成 phase 列表埋了。
5. **"Coordinator 是产品功能不是 demo"** —— "投 Nature → coordinator 编排 inline-editor → citation → reviewer 三步" 是 Curvenote/Prism 都没有的复合任务。USER_GUIDE §3.5 写了但藏在 agent 表最后一行。

---

## 3. 薄弱护城河（被自己 over-sell 的部分）

> 项目所有者强调"不要假装永远只有 2 人"、"AI 不能是 chat 边栏"——以下是离这些反模式最近的滑动。

1. **"50+ 协作者扛得住"——目前是空头支票**。STATUS §1 的 Phase 4 W5-W6 dogfood gate 还没跑（50 客户端 stress + cross-doc reference 真同步全部推后）。Yjs awareness state 在 20+ 已知会膨胀，Loro/Automerge 替换路径仅在 ADR-0001 §6 留了一句 long debt。**Curvenote 下个季度上 Loro，差异化立刻反向。**
2. **"AI 不是聊天框"——但当前 UI 仍然有"AI 协作面板（折叠）"在编辑器底部**（USER_GUIDE §2.1）。从描述听就是右侧栏的兄弟。真正的 AI-native 改造应该让 select → propose 是 inline mark，hover citation → 自动 lookup，没有"面板"概念。Prism 已经做到这一步。
3. **"Marimo / Jupyter 真跑"——目前只有 iframe 协议占位**。USER_GUIDE §7 已知限制表自己承认 Phase 4 dogfood 才解锁。但 ADR-0007 已经 Accepted，README "computational cell" 列在核心能力。**这是 Curvenote 的强项**——他们 Jupyter 真跑出 Plotly 交互，差距仍在。
4. **"Open peer review + ORCID-signed"是 ADR-0015 Proposed，Phase 4 W8**。但 PubPub / ResearchHub 已经做了 5 年。如果不在这里加东西（比如 review 是 claim 上的 annotation + provenance 链上 ORCID 签名 = 可验证 review 图），落地时会被说"晚 PubPub 5 年"。
5. **"双语一等公民"在 typography pre-pass 之外没对外暴露能力**。CJK pre-pass 只是渲染层；**跨语种引用悬浮预览（中文论文引英文 paper 自动显示双语 abstract）、中英混排断行的编辑器视觉、繁简切换都没在 USER_GUIDE 出现**——system prompt §4 立的标杆没到。

---

## 4. 战略建议

### 4.1 突出（不动架构）

- **重写 README §核心能力**：从"功能清单"改成 5 条"vs 竞品独有"叙事（用 §2 的 5 条）。当前清单读起来像 SaaS 自介，看不出立场。
- **Onboarding 加 1 个 demo doc**：500 字论文里嵌 1 个 unsupported claim → 让用户点 maintenance scan → 看到 `unsupported-claim` finding → 派 researcher agent 补 evidence → coordinator 自动接 citation。**3 分钟讲完所有差异化**。当前 `specimen-bilingual` 只是排版样张。
- **Settings 页面加"Provenance 时光机"入口**：把 approval_chain + agentContext 做成可视化（哪段是谁 / 什么模型 / 什么 prompt 写的）。技术已经全在 PG，只缺一个 read-only 视图。这是直接把 D3 翻译成用户可见价值。
- **plan0/landscape.md 加一条**：把当前已交付的 9 条差异化 vs Prism / Curvenote / PubPub / Overleaf 做成一张 9×4 矩阵，用 ✓ / ✗ / ⚠️ 标。否则下次评审还要重读 ADR。

### 4.2 强化（未来 1-2 个 phase 挖深的 2-3 条护城河）

按 ROI 排序：

1. **Phase 5 优先做 Claim/Evidence DAG UI + cross-doc reuse 视图**（不是 Phase 4 W7 fork/merge）。这是唯一没有竞品做的差异化，且 backend 已就绪（`/api/document/<docId>/evidence-map` 返回 crossDocReuse）。Fork/merge 是 Manubot 早做了的，跟进价值低。
2. **AI-native 改造把"AI 协作面板"拆掉**：把 inline-editor / citation / claim-check 全部变成 PM mark + hover action + slash command（参考 Cursor 的 inline ghost text + diff-in-place）。Coordinator 做成"slash command 接受自然语言任务"，不是 panel 按钮。这一步把反模式滑动逆转。
3. **Real Marimo dogfood + 数据集 hash 引用**：把 ADR-0007 的 caveat 闭环。论文里的 figure ↔ marimo cell ↔ 数据 hash ↔ commit 形成可复现链。这是 Distill / Curvenote 没真闭环过的（Curvenote 只到 Plotly 交互），开放科学社区是潜在用户群。

### 4.3 不要做的事（防止过度工程）

- 不要在 Phase 5 加 spatial canvas（system prompt §观测信号已警告，无差异化锚点前别碰）。
- 不要做自己的 plugin marketplace（shadcn registry 模式即可，不要重蹈 Notion Integrations 弱平台的覆辙）。
- 不要在 reviewer agent 上加更多 prompt 模板——先把 1 个跑到 dogfood 通过再说，否则是 chocolate-covered broccoli。

---

**结论一句话**：差异化材料够（D1-D9 都是真的），但 README/UI/onboarding 没把它们翻译成用户能感知的价值；同时 50+ 协作 / inline AI / Marimo 三处宣称已做但实际还在 Proposed 或 backend-only，是被竞品反超的最大风险面。
