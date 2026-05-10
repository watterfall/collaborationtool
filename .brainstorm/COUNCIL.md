# Consciousness Council · collaborationtool 项目评审

> 议题：评估当前状态（Phase 0-4 backend 完成，W5 subdocument 启动），提出系统性改进方向 — 突出特色 + 强化核心。
> 证据：5 份 role-specific 调研报告（产品/架构/用户/AI/设计）+ STATUS.md + 15 ADR + 仓库实读。
> 日期：2026-05-10。

---

## Phase 1 · 选角（6 archetypes）

| Archetype | 主战场 |
|---|---|
| 🏛 The Architect | 异构内容图、CRDT、capability、provenance 抽象层是否扛 Phase 5+ |
| ⚔ The Strategist | 差异化护城河 vs Curvenote/MyST/PubPub/Prism 的反超时间窗 |
| 🔥 The Contrarian | 揭穿"AI 不是侧边栏 / 不是 Notion clone / 不假装永远只有 2 人"的自宣 |
| 🛠 The Pragmatist | Phase 4 推迟项一长串、Friday 能 ship 什么 |
| 🔮 The Futurist | DeSci / 100 人开放评审 / fork-merge / spatial canvas 二阶 |
| ✂ The Minimalist | 防止过度工程；什么该砍 / 什么是 chocolate-covered broccoli |

---

## Phase 2 · Deliberation

### 🏛 The Architect

**Position**：项目脊柱（Capability + Principal、Claim/Evidence 一等节点、PM JSON wire format、ModelProvider 4 wire、Provenance 三表事务）已经做对，但 ADR 文档比代码先跑，**3 处诚实度赤字**会让 Phase 5 dogfood 露馅。

**Reasoning**：ADR-0001 §5.D 承诺的 `packages/doc-store` 抽象 *从未存在*；ADR-0013 §2.5 承诺的 `AgentPluginInput.provider` 仍是 `anthropic: Anthropic | null`，5 个内置 plugin 全部走 mock 分支；ADR-0012 macOS / Windows sandbox 是字符串占位 + 13 单测只测 placeholder。这些不是文档问题——是 promote ADR 到 Accepted 时的事实判断错误。

**Key Risk They See**：W10 Loro 评估、W2 vLLM 真接入、W1 macOS 用户装第三方 plugin —— 三件事撞上抽象赤字，原本承诺 1-2 周的工作变 6-8 周。

**Surprising Insight**：`packages/permissions/acl-loader.ts` 没有 bulk insert 路径——50 reviewer × 50 subdoc × 16 cap = 40,000 行 / 论文将逐行 INSERT。Phase 4 W8 ORCID open peer review 一上即裂。这个问题没人在 ADR 里讲过。

---

### ⚔ The Strategist

**Position**：差异化材料 D1-D9 是真的，**但 README/UI/onboarding 把它们叙述成功能清单而非"vs 竞品独有"**——竞品下个季度抄走最薄的两条（Claim/Evidence 表层 + provenance trace UI），差异立刻反向。

**Reasoning**：当前 elevator pitch 是"形容词级"：比 Notion 多结构、比 Overleaf 少代码感、比 Curvenote 更 AI 集成——读者无法判断你比 Curvenote 多了什么。9 项硬差异化里，只有 1 项（CJK pre-pass）在 README 有可量化痕迹。Curvenote 季度迭代节奏 + 已经融过 Series A，**反超窗口是 2026 Q3**。

**Key Risk They See**：50+ 协作 / inline AI / Marimo 真跑 —— 这三处当前是 "Proposed 或 backend-only"。Curvenote 上 Loro 那一刻，Yjs 性能差成了硬护城河缺口。

**Surprising Insight**：最锐的故事不是 "AI agent for papers"——是 **"Provenance 不是 trace，是 schema"**。Inkeep / Braintrust / Cursor 都讲烂了 trace + audit log，但**没人把 approvalChain + actorKind=agent 做成 PG first-class**。这个叙事三个月内没人敢复刻。

---

### 🔥 The Contrarian

**Position**：项目所有者反复强调"AI 不是右侧 chat 边栏"——可 `AgentPanel.tsx` 仍是侧边 textarea + button，`grep useSelection / view.state.selection` 全仓库**零命中**。**第一性原理 #3 在 UI 层完全没兑现，整个 differentiation 卖点是失重的。**

**Reasoning**：(a) 用户 select 段落后，AgentPanel 让用户**手动粘进 textarea**——这恰是项目所有者明确反对的 Overleaf-clone 路径；(b) `blockId='blk-cursor'` 是写死字符串占位；(c) reviewer / coordinator / inline-editor 在 mock runner 下只前缀 `[FORMAL]` 并没"通读全文"；(d) plugin 安装让用户**粘 manifest JSON 到 URL searchParams** —— 这是反 Curvenote-modern 的 P0 信号。

**Key Risk They See**：Architect 在意 Loro 切换路径——但论文工具不是 CRDT 工具，**用户进门第一扇门是 AgentPanel**，门没换之前 doc-store 重构对差异化没帮助。

**Surprising Insight**：当前的"克制纪律"（无蓝、无圆角、无 shadow，全 zinc）做对了反 SaaS *防御* 的一半，但**正向 editorial 0 落地**——globals.css 是 Phase 1 baseline 没 promote，h1-h4 切 serif 但 body 是 sans，无 measure / 无 hyphens / 无 tabular-nums。研究者打开 app 看到的是"克制版 GitHub Settings"，editorial 气质只活在 export 物里。

---

### 🛠 The Pragmatist

**Position**：用户 30 分钟 dogfood 4 个 P0 摩擦，全在表层（AgentPanel 不接 selection / 新建文档无模板 / 邀请邮件 fallback 到 stderr / plugin URL 粘 JSON）——**这些都是 ≤ 1 周工程量**。Architect 的抽象债（doc-store / plugin contract / macOS sandbox）扛 1-2 phase 没问题，**先修门**。

**Reasoning**：用户 A（跨学科博士生）+ B（PI）的 4 个 P0 摩擦在仓库里都已经有 backend，缺前端 trigger：(1) inline-editor 改 PM Mark + ⌘K floating menu（passage / blockId 自动从 selection 取）—— 2-3 天；(2) 新建文档加 3 模板（空白 / 双语论文 / 文献综述 claim+evidence 预填）—— 1 天；(3) DOI 一键（@-trigger + CrossRef MCP）—— 2 天；(4) ShareDialog email 兜底从 stderr 改成"复制邀请链接"按钮 + 内置 SMTP 试探 —— 半天。

**Key Risk They See**：Strategist 担心 README 不锐 —— 但**没有 inline AI 这一帧画面，所有"vs 竞品独有"的叙事都只是文字**。Demo screenshot 用现在的 UI 截，研究者 5 秒内归类为"又一个 Notion-style 边栏 AI"。

**Surprising Insight**：编辑器内 inline AI 改造一旦完成，**自带 onboarding demo**——specimen-bilingual.md 里嵌 1 个 unsupported claim → maintenance scan 找到 → 派 researcher 补 evidence → coordinator 接 citation。3 分钟讲完所有差异化。这是单一 feature 解锁多重叙事的 ROI 机会。

---

### 🔮 The Futurist

**Position**：5 年后这个项目能不能活，看 **DeSci + 开放评审基础设施**而非论文编辑器。当前架构里**唯一的 5 年级差异化锚点是 ADR-0011 Claim/Evidence + Provenance graph**——其他能力（CJK / 多 wire / sandbox）2 年内会被复制。

**Reasoning**：Curvenote 主战场是教科书 / 期刊 publishing，**没碰 DeSci 评审基础设施**；PubPub / ResearchHub 做了开放评审但**没有 claim DAG**；Octopus 把论文按 IMRAD 拆但**没建论证图**。把"评审是 claim 上的 annotation + ORCID 签名 = 可验证 review 图"这一步做出来 —— 这是 5 年后唯一能从 Curvenote 手里拉回投资人的故事。

**Key Risk They See**：Pragmatist 在意"先修门"是对的，但**门修好后下一站是什么**没人答。如果 Phase 5 还是"加更多 plugin / 改 UI"——那是 Notion clone 路径。Phase 5 必须 ship 第一个 **claim-on-claim** 用例（review = annotation on claim with provenance lineage）。

**Surprising Insight**：ADR-0015 Proposed 里写 ORCID 签名——但**没人答"ORCID-signed claim 比传统 peer review 强在哪"**。如果只是给评审签个名，PubPub 早做了。**真正的杠杆是"claim 的 evidence 链 + reviewer 的 provenance 链 = 一个可验证的 DAG"**——这不是 "ORCID + open review"，是 first-class 学术信任图。

---

### ✂ The Minimalist

**Position**：Phase 4 推迟项 + Phase 5 候选清单（subdoc fork-merge UI / spatial canvas spike / Loro 评估 / 跨设备同步 / Marimo 真跑 / ORCID 真跑）——**6 件事里 4 件应该砍或推到 Phase 6+**。每加一个 feature 必须替换或省去现有两个。

**Reasoning**：spatial canvas（W8）—— 没有差异化锚点之前别碰，是 system prompt §观测信号已警告的；fork-merge UI（W7）—— Manubot 早做了，跟进价值低；Loro 评估（W10）—— 没 doc-store 没法切，看起来像是评估实际是抽象债；跨设备同步（W9）—— y-sweet 单后端抽象不到位前是空头。**剩下 W2 vLLM dogfood + W8 ORCID 集成 + 表层 4 P0 = 真正应该做的**。

**Key Risk They See**：Futurist 喊"DeSci + 评审基础设施"是对的方向——**但路径不是新做评审 UI，是把已有的 claim/evidence/provenance 三件事接通**。其他都是 chocolate-covered broccoli。

**Surprising Insight**：维护成本最高的债务**不是代码量，是 ADR 数量**。15 个 ADR 多个仍 Proposed，Architect 已经指出 3 处 ADR-vs-代码赤字。**新 ADR moratorium 至少 1 phase**——把 ADR-0012/0013/0014 promote 到真 Accepted（dogfood gate 真跑），别再起草新的。

---

## Phase 3 · Council Synthesis

### Points of Convergence（≥ 4 archetype 同意）

1. **D1-D9 内核差异化是真的**（Architect / Strategist / Contrarian 反方都承认 backend 实现了）—— 不存在"假大空"风险。
2. **AgentPanel 是 sidebar disguised** —— Contrarian / Pragmatist / Strategist / Futurist 都把它列为最大叙事毒瘤；Architect 也认"门没换前抽象债不释放价值"。
3. **README / 叙事把硬差异化讲成功能清单** —— Strategist 主张，Pragmatist / Futurist / Contrarian 全部确认。
4. **Phase 5 候选过载** —— Minimalist / Pragmatist / Futurist 同意要砍 4 件，Architect 同意"先把 promote 中的 ADR 真跑通"。
5. **Provenance graph 是 5 年差异化** —— Strategist / Futurist 主张，Architect / AI 报告均确认 schema 已就位。

### Core Tension（不会被消解的中心矛盾）

**Architect vs Pragmatist：抽象债先 vs 表层门先？**

- **Architect**：doc-store / plugin contract / macOS sandbox / capability bulk / provenance batch —— 这 5 处不堵，Phase 5 三道 dogfood gate 全裂。
- **Pragmatist**：用户 30 分钟内 4 个 P0 摩擦把 differentiation 故事压垮，再好的 doc-store 也救不了第一印象。

这不是 either-or——**是节奏问题**。两边都对：

| 时间窗 | Architect 工作 | Pragmatist 工作 |
|---|---|---|
| 第 1 周 | （等门修完） | inline AgentPanel + 新建文档模板 + DOI 一键 + cjk-spacing 标点 boundary fix（4 行） |
| 第 2 周 | doc-store 抽象骨架 + plugin contract `provider` 切换 | globals.css editorial token v1 + email fallback UI 化 |
| 第 3-4 周 | macOS sandbox 真写 OR UI 拦截（ADR-0012 review log 选明） + capability bulk insert + provenance batch | onboarding demo doc（specimen 嵌 unsupported claim 演 5 步差异化） |
| Phase 5 第 1-2 月 | dogfood gate 全跑通 + ADR promote | claim-on-claim review prototype（Futurist 杠杆点） |

### The Blind Spot（NO 一位 archetype 提的问题）

**没人问"第一个 100 个用户从哪来"。**

5 份报告 + 6 位 archetype 全在评估"我们做了什么 / 还差什么"，没人评估"谁是 paper #1 写在这里的人？什么场景把人拉来？"。

具体盲点：
- 项目 dogfood：项目所有者自己有没有把 README + landscape + ADR-INDEX 用这个工具写一遍？元 dogfood 是真护城河。
- 学术社区路径：清华 / 中科院 / Berkeley DeSci / Pluto.jl 用户群——哪个先邀请？
- 内容引力：双语 specimen 是测试 fixture 不是营销资产；没有"打开就想抄"的 demo paper（参考 Distill / Marimo blog post）。

**这三件事任何一个不做，9 项内核差异化是无源之水**。

### Recommended Path（行动建议）

**P0（本周）— 表层 to 现实**：把 differentiation 翻译成用户可触达的动作。
1. **inline AgentPanel** rewrite —— PM Mark + ⌘K floating menu + selection 自动取 passage/blockId（兑现 #3 第一性原理）
2. **新建文档 3 模板** —— 双语论文 / 文献综述（claim+evidence 预填）/ 空白
3. **DOI 一键** —— `@` trigger + CrossRef MCP propose-fragment
4. **cjk-spacing 标点 boundary 修 4 行**（设计报告 §5.1）

**P1（2-4 周）— 抽象债**：3 处 ADR-vs-代码赤字。
5. `packages/doc-store/` 接口抽象 + 全收口 Y.Doc import（ADR-0001 §7 review log）
6. `AgentPluginInput.anthropic → provider: ModelProvider`，5 plugin 各 30 行迁移（ADR-0013 promote 前置）
7. macOS sandbox-exec profile 真写 OR UI 显示拦截 + ADR-0012 review log 写明选项
8. `materialiseRoleBundleBulk()` + `persistProposalBatch()`（capability + provenance 写放大）

**P1（并行）— 突出叙事**：
9. README 改为 5 条 vs-竞品独有叙事（用产品报告 §2 五条）
10. landscape.md 加 9×4 矩阵（差异化 vs Prism / Curvenote / PubPub / Overleaf）
11. globals.css editorial token v1（measure / leading-cjk / palt / serif body）
12. onboarding demo doc：specimen 嵌 unsupported claim → maintenance → researcher → coordinator → citation 5 步

**P2（Phase 5 主线）— 5 年差异化锚点**：
13. **claim-on-claim review prototype**：reviewer 不是新角色而是 annotation on claim 的 ORCID-signed provenance lineage（Futurist 主张）
14. quota enforcer + cancel API（CLAUDE.md §5.7 红线）+ AgentTimeline.tsx 父子树（observability）

**砍 / 推 Phase 6+**：
- spatial canvas spike（W8）—— 没差异化锚点别碰
- 章节 fork-merge UI（W7）—— Manubot 已做
- Loro / Automerge 评估（W10）—— 没 doc-store 评估即妄言
- 跨设备同步（W9）—— y-sweet 单后端抽象不到位前是空头
- 新 ADR moratorium 1 phase —— 先把 0012/0013/0014 promote 到真 Accepted

### Confidence Level

**Medium-High**。证据来自 5 个独立 role agent + 实读仓库代码，convergence 在 5 个点上无异议；core tension 是节奏不是方向；blind spot 是真盲点（不在任何 ADR / role 报告里出现）。confidence 不到 High 的原因是 P2 第 13 条（claim-on-claim review）需要 prototype 实证才能判断 ROI。

### One Question to Sit With

> **如果你现在停下所有开发，把 README + landscape.md + ADR-INDEX 用 collaborationtool 自己写一遍——会卡在哪？**
>
> 这个问题答完，就知道哪 3 件事真的非做不可，哪 6 件事可以推到 Phase 6+。
> 没有元 dogfood 的项目，所有差异化都是别人的故事。

---

## 附录 · 5 份证据来源

- `/Users/jili/Documents/GitHub/collaborationtool/.brainstorm/role-product.md` — 产品/竞品（D1-D9 差异化盘点 + 5 条薄弱护城河）
- `/Users/jili/Documents/GitHub/collaborationtool/.brainstorm/role-architecture.md` — 架构（3 处诚实度赤字 + 7 处债务）
- `/Users/jili/Documents/GitHub/collaborationtool/.brainstorm/role-user.md` — 用户 dogfood（A/B 30 分钟 4 P0 摩擦 + 3 P0 feature）
- `/Users/jili/Documents/GitHub/collaborationtool/.brainstorm/role-ai.md` — AI 协作（data plane 80% 真 / UI plane 30% 真 + quota enforce 与 cancel 缺）
- `/Users/jili/Documents/GitHub/collaborationtool/.brainstorm/role-design.md` — 设计排版（renderer A− / web shell C+ + cjk-spacing punct bug）
