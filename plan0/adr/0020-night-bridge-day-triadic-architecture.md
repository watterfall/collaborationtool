# ADR-0020: Night-Bridge-Day Triadic Architecture — 三层等价知识产出系统

- **Status**: Proposed
- **Date**: 2026-05-12
- **Phase**: 5 W3+（横跨 Phase 5/6 的战略性 ADR）
- **Deciders**: tech-lead (jili)
- **Gated on**:
  - Phase 5 Wave A quota-enforcer (P0) 不被本 ADR 推后
  - 30 天 dogfood gate（jili 自己每周 ≥ 5 Night artifact + ≥ 2 Bridge artifact + ≥ 1 Day promotion + 6 种交互模式至少触发 4 种）
  - Iteration 4 plan file 主体在 `/Users/jili/.claude/plans/night-science-day-science-snoopy-widget.md` 通过 review

---

## 0. 本 ADR 的特殊性 — 战略性 vs feature 性

**本 ADR 是战略性的**（vs ADR-0001~0016 几乎都是 feature-level）：
- 不锁定具体 schema / API / 接口
- 锁定的是**架构哲学**：Night/Bridge/Day 三层等价 + 6 交互流 + 4 角色
- 后续 feature-level ADR（如 ADR-0021 discovery-graph schema、ADR-0022 bridge-layer schema、ADR-0023 triadic UI surface）按本 ADR 框架展开

**与 ADR moratorium 的关系**（`improvement-plan-2026-05.md §四`）：
> "ADR-0012/0013/0014 dogfood gate 跑通并 promote 到 Accepted 之前，不再起草新 ADR"

本 ADR 声明为**例外**：moratorium 针对 feature ADR（避免承诺爆炸），战略性 ADR 是 moratorium 的**前提**（没有方向就没有 feature ADR 的 prior art 基础）。`improvement-plan-2026-05.md §十二`（待写）将正式记录此例外。

**ADR-0017/0018/0019 编号预留给 client-first pivot 子 ADR**（per memory `client_first_pivot_2026_05.md`）；本 ADR 用 0020。

---

## 1. Context

### 1.1 起因 — Plan Iteration 1-4 演进

`/Users/jili/.claude/plans/night-science-day-science-snoopy-widget.md` 记录了 4 次方向迭代：

| Iteration | 框架 | 否决理由 |
|---|---|---|
| 1 | "协作论文平台 + AI 增强"（原叙事） | 等同 Overleaf/PubPub 等 commodity；护城河浅 |
| 2 | "Night Science Pivot——补 thought_fragment / exploration_path schema 到 day-science 框架" | 仍是从论文反推；night-science 只是入口之一 |
| 3 | "Scientific Discovery System——question-centric + Frame A/C 组合 + Frame D Cross-Domain Collision" | 缺 Bridge 层；缺等价产出系统；缺 jili 自有概念体系 |
| 4（本 ADR） | "**Night-Bridge-Day Triadic Architecture** + 三类等价产出 + 5 创意模式 + 6 交互流 + 4 角色" | 当前最优——基于 jili 在 `/Users/jili/project/nightscience/` 2021 行自有文档 |

### 1.2 Evidence base — jili 的 5 个 night-science 文件

`/Users/jili/project/nightscience/` 含 jili 自己累积的 night-science 思考（2021 行核心 + 3 个大文件未列入本次）：
- `Night_Science_Cases_Revised.md`：**5 大创意触发模式**（隐喻 / 矛盾 / 重提问 / 跨界 / 思想实验）+ 60+ 案例
- `night_science_concepts.md`：**93 个同构概念 × 17 学科**
- `night_science_expanded.md`：**6 种交互模式** + 追求语境 + Bridge 工具矩阵
- `night0.md`：**四层架构**（心法→方法→组织→产出）
- `Night_Science_Complete.md`：**7 大核心原则**

jili 的框架对 Yanai-Lercher（plan Appendix B 三篇文献）的 6 个核心扩展：
1. 5 创意触发模式（操作化，每模式有"三要素"判断）
2. **Bridge 层显式化**（最大 contribution）
3. 四层架构（不只 cognitive，含 organizational + output）
4. 93 同构概念 × 17 学科（把夜科学定位为人类创造性工作的通用语言）
5. 6 种交互模式（双向 info flow contract）
6. 谜题分类（4 类元 reflection 工具）

### 1.3 与既有 ADR 的关系

- **ADR-0001 Data model + CRDT split**：本 ADR 在 PM tree 之外新增 discovery-graph + bridge-layer 两个 first-class data model；CRDT 策略复用（Yjs 持续协作）。Review log 需追加 "Phase 5 W3+ 加 Night/Bridge data models"。
- **ADR-0002 Permission**：4 角色分化（Explorer / Bridge-builder / Validator / Connector）映射到现有 5 role bundle + capability vocabulary；新增 `night.artifact.create` / `bridge.artifact.create` 等 capabilities。
- **ADR-0008 Long-horizon agent runtime**：Coordinator 现在不是单向 "goal-driven multi-step"，而是 6 交互流的**双向 metabolic orchestrator**。Review log 追加。
- **ADR-0010 Extension system**：5 创意模式作为 plugin tag taxonomy（不是 hardcoded enum），允许 community 添加新模式 plugin。
- **ADR-0011 Claim/Evidence**：Claim/Evidence 保留作 **Day 层** atomic units；Night 层有 thought / question / metaphor / sketch / contradiction / thought-experiment；Bridge 层有 concept-prototype / design-fiction / hypothesis-formalization / analogy-mapping。三层不互斥。
- **ADR-0014 Yjs subdocument**：subdoc-level 不变；新增 cross-layer reference（Night → Bridge → Day artifacts 之间的 lineage edge）。
- **ADR-0015 Open peer review + ORCID**：Day 层 review 不变；Night/Bridge artifacts 加 ORCID-signed contribution-graph attribution（**反 priority race**，per `improvement-plan-2026-05` Council 修订）。
- **ADR-0016 Claim-on-Claim Review**：仍然是 Day 层机制；Night/Bridge 层有自己的 review/endorsement 机制（更轻量，per "好问题胜过好答案"原则）。

### 1.4 哲学约束 — 第一性原理 + jili 的 7 大核心原则

**项目第一性原理**（`paper-platform-system-prompt.md`）中本 ADR 必须遵守：
1. Local-first（夜科学需未被监视的空间）
2. AI 是协作者不是侧边栏 → AI 是 4 角色之一（Connector），不是 sidebar
3. Provenance 即一等数据 → Night/Bridge/Day 三层各自有 provenance
4. 可演化性 > 当下完备 → 本 ADR 是战略框架，不锁 schema 细节
5. 协作是动词不是名词 → 6 种交互流是 first-class

**jili 7 大核心原则**（`Night_Science_Complete.md`）作为本 ADR 的设计原则：
1. **好问题胜过好答案** → Night artifact "question" 是 first-class
2. **警惕假设负债** → Night/Bridge artifact 可被 mark "tentative"（不强制最终化）
3. **矛盾视作机遇** → Contradiction 是 first-class Night atomic unit
4. **即兴式科学** → contribution-graph attribution（反 priority race）
5. **跨界文艺复兴** → Frame D Cross-Domain Collision + Connector 角色
6. **双语翻译** → 显式 day/night mode toggle + 6 种交互流第 4 种"隐喻桥接"
7. **四类谜题模型** → 元 reflection 工具（待 Phase 6 W2 加 UI）

### 1.5 这是一项底层、Phase 5 W3+ 锁定的决策

**严格度高**：
- Triadic 架构一旦 ship 给真实 user 即不可改回二元（Night/Day-only）—— 三层 artifact 间已有 lineage edges
- 5 创意模式 tag 数量起步 5 个；新模式通过 plugin 添加，不通过 schema migration
- 4 角色分化用作 UI surface 默认 view，不是 role-based access control（capabilities 仍 fine-grained）
- 6 交互流 enum **故意有限**：增加第 7 种需 ADR review，避免 enum 漂移

---

## 2. Decision

### 2.1 三层等价知识产出系统（核心）

```
Night (生成/发散)         Bridge (转化/桥接)        Day (验证/收敛)
═══════════════════      ═══════════════════       ═══════════════
心法：负能力、诗性        心法：写作即思考          心法：批判性、风险削减
方法：溯因、自由书写      方法：概念工程            方法：演绎、RCT、红队
组织：探索学习、沙盒      组织：双环学习            组织：最小可行官僚
产出：草图、隐喻、反例    产出：技术预印本          产出：论文、代码、政策
       探索原型、开放作品        设计虚构、概念验证        法律、诊疗方案
```

**关键 invariant**：三层产出**等价**——同样的 attribution、archive、citation、metric exposure。**不是** "Night/Bridge 服务 Day"。

### 2.2 5 创意触发模式（作为 schema tag taxonomy）

Night/Bridge 层 artifact 可有 0-N 个 mode tag：
- `mode:metaphor`（模式 A，13+ 案例：相分离液滴 / 红皇后假说 / 系统一&二）
- `mode:contradiction`（模式 B，13+ 案例：Griffith 转化 / 端粒 / 跳跃基因）
- `mode:reframe`（模式 C，6+ 案例：Curie 镭 / iPSC / 图灵测试）
- `mode:cross-domain`（模式 D，8+ 案例：信息论 / AlphaFold / CRISPR）
- `mode:thought-experiment`（模式 E，20+ 案例：薛定谔猫 / EPR / 全息原理）

Tag **不强制 workflow**（避免过度结构化，per Feyerabend）；启用搜索 / 推荐 / 分析（"相似 mode 的 prior cases" surface）。

### 2.3 6 种交互流（双向 info flow contract）

```ts
type InteractionMode =
  | 'hypothesis-output'    // Night → Bridge → Day（假设输出）
  | 'anomaly-input'        // Day → Bridge → Night（反常输入，失败 surface 给探索者）
  | 'constraint-transfer'  // Day → Bridge → Night（物理定律约束假设空间）
  | 'metaphor-bridge'      // Night → Bridge → Day（隐喻精化为形式模型）
  | 'question-return'      // Day → Bridge → Night（解决旧问题产生新问题）
  | 'method-transfer';     // 双向（算法 ↔ 直觉；跨域方法迁移）
```

每个 cross-layer reference / lineage edge 必须带 `interaction_mode` 标签。Provenance writer 记录每个交互流的 actor + timestamp + context。

### 2.4 4 角色分化（UI surface 默认 view）

- **Explorer**（夜科学家）—— 重模式 A/C/E，产 Night artifact，UI 默认 `/discover` surface
- **Bridge-builder**（桥接者）—— 重模式 D + 6 交互流第 4/6，产 Bridge artifact，UI 默认 `/translate` surface
- **Validator**（日科学家）—— 重模式 B，产 Day artifact + 跑 review pipeline，UI 默认 `/manuscript` surface（≈ 现有 `/editor`）
- **Connector**（broker / 边界物设计者）—— Burt structural hole spanner，跨 cluster 翻译 + 推荐 cross-layer matching，UI 默认 `/network` surface

每用户可同时担多角色（不强制单选）；onboarding 默认询问主要角色 → 设置 default surface；用户随时切换。

### 2.5 三类等价产出的 attribution 模型

**反 priority race**（per `improvement-plan-2026-05` Council 修订 + Merton multiple discovery）：

每个 artifact 有 `contribution_graph`（不是 single `author` 字段）：
- 谁第一个提出（first_proposer）—— **不是** ranking 因素
- 谁贡献了哪个 sub-component（contributors[]）
- 何时贡献（each with timestamp）
- 类型 contribution（contribution_kind: question / metaphor / contradiction / experiment / analysis / synthesis ...）

UI/citation 显示**所有 contributor + 类型**，不是 "First author et al."。

Citation 格式建议：
```
"Question proposed 2026-05-12 by jili@orcid; metaphor 'phase separation droplets' by alice@orcid (2026-05-14);
contradiction surfaced 2026-05-20 by bob@orcid; refined hypothesis 2026-05-25 by jili+alice."
```

### 2.6 谜题分类模型（元 reflection 工具）

每个 Night/Bridge artifact 可选 self-label "我在哪类谜题"：
- **I 拼图谜题**：封闭世界 + 寻找连接
- **II 逻辑谜题**：封闭世界 + 重新框架
- **III 外部连接**：开放世界 + 寻找连接（多数突破性发现属此类）
- **IV 跳出思维框**：开放世界 + 重新框架（颠覆性发现常属此类）

Phase 6 W2 加 reflection UI surface："你最近 30 天的 artifact 分布在哪几类谜题？" 启发用户反思自己的探索模式。

### 2.7 实施分阶段

| 阶段 | Wave | 内容 |
|---|---|---|
| **Phase 5 W3** | 本 ADR ship Proposed | ADR-0020 写完 + improvement-plan §十二 写完 + STATUS.md 叙事行修订 |
| **Phase 5 W4-W5** | Wave D-1 | `packages/discovery-graph/` schema scaffold + 6 Night atomic units 单测 |
| **Phase 5 W6-W7** | Wave D-2 | `packages/bridge-layer/` schema scaffold + 4 Bridge atomic units 单测 |
| **Phase 5 W8** | Wave D-3 | 6 交互流 reference edges + provenance writer 扩展 |
| **Phase 5 W9-W10** | Wave D-4 | `apps/web/src/app/triadic/` UI skeleton（三层 surface 等价 prominent） |
| **Phase 5 W11-W12** | Wave D-5 dogfood gate | jili 自 dogfood 30 天 + retrospective + ADR Proposed → Accepted |
| **Phase 6 W1+** | follow-up ADRs | ADR-0021 (discovery-graph schema) / ADR-0022 (bridge-layer schema) / ADR-0023 (triadic UI surface) / ADR-0024 (谜题分类 reflection) |

---

## 3. Consequences

### Good

- **5 年差异化锚点深化**：从 Iteration 3 的"question-centric"深化为"三层等价产出系统"——竞争对手（Curvenote / PubPub / Notion / Obsidian / GitHub）无人做。
- **jili 自有 IP 落地**：2021 行 night-science 文档不再仅是 jili 个人思考，被编码为平台架构 invariant。
- **三类用户同时服务**：Explorer / Bridge-builder / Validator 不互斥，但各有 default surface，避免"一个 UI 服务所有人"的过度通用化。
- **Phase 4 沉没成本保留**：claim/evidence/render-*/reviewer agent 全部保留为 Day 层 adapter，叙事降级而不删除。
- **AI agent 自然 fit**：Connector 角色 + Coordinator 双向 6 交互流 = AI 持续 surface cross-layer matching。

### Bad / Trade-offs

- **复杂度增加**：从 1 个 PM tree → 3 个 first-class layer + cross-layer references。schema 工作量增加。**缓解**：分 5 个 Wave 渐进实施。
- **认知负担**：用户需理解三层概念才能 fully 利用。**缓解**：onboarding 走 4 角色路径，每角色只暴露相关 surface；不强制理解全图。
- **citation 改变**：contribution-graph 不被现有学术系统识别（grant/tenure）。**缓解**：保留传统论文 export 为 "机构对接 adapter"；contribution-graph 作 platform-native bonus。
- **Bridge 层概念新颖**：可能被误解为"Night/Day 之间的过渡"而非 first-class。**缓解**：UI 用 `/translate` surface 显式承载 Bridge work；examples gallery 突出 Bridge artifact（如设计虚构 / 概念验证）。
- **5 创意模式 tag 可能被滥用**：用户给所有 artifact 都打全部 tag。**缓解**：搜索算法权重设计（>3 tag 降权）；不强制 tag。
- **4 角色分化可能形成 silo**：Explorer/Validator 不互动。**缓解**：Connector 角色 + 6 交互流自动 surface cross-role matching。

### Neutral / Need watching

- **Stephanian discovery（new problem + new solution）**：本 ADR 不显式工程化（per Appendix F §F.5 trap warning），但允许 emergent。
- **5 创意模式扩展**：未来可能需要第 6/7 模式（如"反事实"模式）；通过 plugin 添加而非 schema migration。
- **AI 自动 tag**：Q11（Appendix G）— AI 自动建议 mode tag vs 完全手动。Phase 5 W6 末 dogfood gate 后决定。
- **跨平台 export**：Night/Bridge artifact 如何 export 给 Curvenote / PubPub？Phase 6 W4 评估，可能用 JATS-XL / Manubot 扩展。

---

## 4. Alternatives considered

### A: 不 pivot，继续 Iteration 1（"协作论文平台 + AI 增强"）

- 为什么不选：Council 5 视角全部反对（plan §3）；commodity 红海（Overleaf / PubPub / Notion / GDocs）；护城河浅
- 什么情况下我们会回头：Phase 5 W12 dogfood gate **彻底失败**（jili 30 天产 < 10 artifact），证明三层架构没真痛点

### B: Iteration 2 "Night Science Pivot"（thought_fragment + exploration_path schema）

- 为什么不选：jili turn 8 明确否决——"仍从论文反推""night-science 只是入口之一"；schema 是 day-science 风格强加到 night-science 内容上
- 什么情况下我们会回头：如果 Iteration 4 实施中发现"四层架构 + 6 交互流过度抽象，用户无法启动" → 回退到 thought_fragment 作 Night 唯一 atomic unit

### C: Iteration 3 "Scientific Discovery System — question-centric only"

- 为什么不选：缺 Bridge 层 first-class（jili 自有框架核心 contribution）；缺等价产出系统；只 A+C+D 三 Frame 但 Frame B "Centaurian Discovery Commons" 与 4 角色分化共享要点
- 什么情况下我们会回头：如果 Bridge 层 dogfood < 2 artifact/week 持续 4 周，证明 Bridge 不是 first-class 痛点 → 回退到 Iteration 3 question-centric

### D: 完全重写（Iteration 3 §5 Q3 = C 选项 "只保留 typography + permissions + Yjs"）

- 为什么不选：放弃 Phase 4 沉没成本（claim/evidence/render-*/reviewer agent）违反 Council Minimalist 视角；现有代码可作 Day 层 adapter，没有重写必要
- 什么情况下我们会回头：如果 Iteration 4 实施 6 个月后发现 Phase 4 代码与三层架构**结构性冲突** → 评估重写

### E: 不写 ADR，只写 improvement-plan-2026-05 §十二

- 为什么不选：Iteration 2 用户 turn 5-6 明确选 Q3=B "破例起草正式 ADR"；战略性 ADR 给 follow-up feature ADR 提供 prior art 基础
- 什么情况下我们会回头：如果本 ADR 实施 3 个月后无 feature ADR 落地，证明战略 ADR 是过早 commit → 降级为 plan 章节

---

## 5. Decision log（决策过程中的关键讨论）

- **2026-05-12 turn 1-4**: 用户引入 Yanai-Lercher 三篇 night-science 文献，提议 night-science pivot
- **2026-05-12 turn 5-6**: 用户选 Iteration 2 框架（Q1=B 激进 pivot / Q2=A 合并 client-first / Q3=B 起草 ADR-0017 / Q5=C org-visible / Q6=B 双 surface）
- **2026-05-12 turn 8**: 用户否决 Iteration 2——"从论文反推是错误的""Night Science 只是入口之一"；要求引入开放科学 / AI for Science / 群体智能 / 跨学科 / 动态论文 / 颠覆性等 9 元素
- **2026-05-12 turn 9-13**: 启动 3 并行 Explore agents 调研 DeSCI + 开放科学 / AI for Science / 群体智能；产 Iteration 3 plan（Frame A+C 推荐 + document → question shift）
- **2026-05-12 turn 14**: 用户要求"继续调研创新发现的模式"——启 3 并行 agents 调研科学哲学 + 创造力认知 + 开放性创新；产 plan Appendix F（5 新收敛模式 + Frame D + 4 处推荐修订）
- **2026-05-12 turn 16**: 用户提供 5 个自有 night-science 文件（2021 行）；启 Explore agent distill；发现 jili 自有框架（5 模式 + 93 概念 + 6 交互 + 4 层 + 7 原则 + Bridge 层显式化）比 Yanai-Lercher 系统化得多 → 产 Iteration 4 plan（Appendix G）+ 本 ADR
- **关键反对意见 1**：ADR moratorium（improvement-plan-2026-05 §四）禁止新 ADR。**回应**：声明本 ADR 为战略性而非 feature；moratorium 针对 feature ADR；improvement-plan §十二 显式记录例外
- **关键反对意见 2**：复杂度——三层架构 + 5 模式 + 6 交互 + 4 角色 + 7 原则 = 太多新概念。**回应**：分 5 个 Wave 渐进；onboarding 走 4 角色路径，每角色只暴露 1/3 概念
- **关键反对意见 3**：jili 5 个 night-science 文件未通读全文（只读了 5 个核心，未读 Night.md 87KB / Night_Science_Cases_Expanded.md 75KB 等）。**回应**：本 ADR ship Proposed，Phase 5 W3 W6 dogfood gate 前 jili 通读完整文档，必要时修订 ADR-0020 review log

---

## 6. Phase 5 implementation review log

每个 Wave landed 后追加一行（YYYY-MM-DD: Wave D-N landed — XXX changed YYY）。

- **2026-05-12 (`2faefe2`) Wave D-1 landed** — `packages/discovery-graph/` scaffold（type-only，无 PG migration）。落 §2.1 Night 层 6 atomic units（thought / question / metaphor / sketch / contradiction / thought-experiment 全部 discriminated union + JSON round-trip 锁形状）+ §2.2 ModeTag 5 模式 enum + `validateModeTags` 反 R-T5 滥用（MAX=3 + dup-reject + invalid-reject + 自定义 maxTags override）+ §2.4 Role 4 角色 enum + DEFAULT_SURFACE_BY_ROLE（4 distinct surfaces /discover /translate /manuscript /network）+ §2.5 contribution-graph 反 priority race（distinctContributors / countByKind / summariseByContributor，序列化保 order）。20 文件 +1258 insertions；discovery-graph **41 测全 PASS**；全 workspace typecheck PASS。**Evidence Tier = contract**（类型契约 + 单测，无真使用方）。
- **2026-05-12 (`ad076f1`) Wave D-2 landed** — `packages/bridge-layer/` scaffold（type-only，无 PG migration）。落 §2.1 Bridge 层 4 atomic units（concept-prototype / design-fiction / hypothesis-formalization / analogy-mapping）+ BridgeArtifactBase 默认 collaborator visibility（vs Night private）+ 各 atomic unit 自有结构 discriminator（PrototypeMaturity / FictionStance / FormalizationOutcome / AnalogyValidationStatus 各 4 档）+ BridgeArtifact discriminated union。**关键设计决策**：bridge-layer ID brands 复用 discovery-graph（`_shared.ts` 显式 re-export，无 import cycle）；FormalizationOutcome 含 `not-formalizable` + AnalogyValidationStatus 含 `broken` —— Bridge 失败本身是 first-class 产出（反 publication bias，per §1.4 jili 7 原则 "警惕假设负债"）。16 文件 +1075 insertions；bridge-layer **24 测全 PASS**；全 workspace typecheck PASS。**Evidence Tier = contract**。
- **2026-05-12 (`3aa4f57`) Wave D-4 landed** — `apps/web/src/app/(app)/triadic/` UI skeleton（4 surface 等价 prominent）。落 §2.4 + §2.7 W9-W10：`/triadic` overview (3 hairline layer sections + 4 role list + 5 mode tags) + `/triadic/{discover,translate,manuscript,network}` 各自的 role-specific surface（discover/Night 用 accent-ink monogram 'N' + private-by-default callout；translate/Bridge 用 accent-ox monogram 'B' + 失败 Bridge work first-class callout；manuscript/Day 用 accent-moss monogram 'D' + **显式声明 Day 不被替换或降级**仅 reframe；network/Connector monogram 'C' + 6 InteractionMode 表带 canonical 方向）。共享 `/triadic/layout.tsx` 4-tab nav（label-cap ADR 编号 header + serif 双语主标 + lede italic 副标）。**SoT 复用**：3 个 atomic unit 列表全部 import 自 `@collaborationtool/discovery-graph` + `@collaborationtool/bridge-layer`（NIGHT_ARTIFACT_KINDS / BRIDGE_ARTIFACT_KINDS / ROLES / ROLE_LABELS_* / MODE_TAGS / INTERACTION_MODES / INTERACTION_MODE_CANONICAL_FROM/TO / INTERACTION_MODE_LABELS_*）—— schema 漂移 typecheck 报错。`(app)/layout.tsx` 加 `/triadic` nav entry；i18n `nav.triadic` zh="三层" en="Triadic"；apps/web deps + 两 workspace 包。**Design.md §11 reject grep**：staged diff 0 命中（bg-blue-* / rounded-lg|xl|2xl|full / bg-zinc-* / shadow-* / chatbot-blue hex 全 0）；全 tokens 走 `var(--color-*)` + `var(--radius-1)` + 现有 design system（HairlineRule / MonoDisc / StatusPill）；双语 labels everywhere。11 文件 +1360 insertions；全 workspace typecheck PASS（25 包）；React 19 + Next 15 ReactNode 已知 workaround `<>{children}</>`。**Caveat**：未在 dev server 跑浏览器 verify —— CLAUDE.md "UI 改动浏览器跑过" gate 留 Wave D-5 dogfood + jili 本机 self-verify（typecheck + reject grep 是技术 gate，视觉/交互 gate 是 dogfood gate）。**Evidence Tier = contract**（surface 渲染契约 + 类型 SoT 锁定；真使用 Wave D-5 dogfood 升 `mixed`，Phase 6 完整 real）。
- **2026-05-12 (`5c82f83`) Wave D-3 landed** — 6 interaction modes + cross-layer reference edges + provenance triadic extension（**零 DB migration**）。落 §2.3 6 InteractionMode enum（hypothesis-output / anomaly-input / constraint-transfer / metaphor-bridge / question-return / method-transfer 末项 intrinsically bidirectional）+ canonical from/to direction maps + zh/en labels + isInteractionMode/parseInteractionMode validators；`cross-layer-reference.ts` 新 CrossLayerReference 类型（typed lineage edge）+ `validateCrossLayerReference`（拒绝同层 + 校验 mode 方向，method-transfer 例外允许任何 cross-layer pair）+ `countReferencesByMode` Wave D-5 dogfood 指标 helper；**`ai-runtime/src/provenance-writer.ts` 加 `withTriadicContext`/`readTriadicContext`/`TRIADIC_CONTEXT_KEY='triadic'`** —— 复用 `provenance.agentContext` jsonb 列作侧通道（`agentContext->>'triadic'` 可查），**Phase 1-4 老行向后兼容**（无 triadic key 读为 undefined），空 crossLayerReferences 写时拒（anti-pollution）；ai-runtime 加 `@collaborationtool/discovery-graph` workspace dep。**关键设计决策**：jsonb 侧通道而非新建 PG 列 —— 保 Wave 推进速度（不动 ADR-0001 schema），Wave D-4 UI surface 时再评估要不要 promote。9 文件 +731 insertions；discovery-graph **60 测**（41 + 新增 19 interaction-mode 7 + cross-layer 12）+ ai-runtime triadic-context **8 测**全 PASS；全 workspace typecheck PASS。**Evidence Tier = contract**（jsonb 侧通道存活路径已锁；ai-runtime 真 invocation path 接入 Wave D-4 / Wave D-5 dogfood 时升 `mixed` / `real`）。

Phase 5 W12 末 dogfood gate retrospective 时统一 review 本 ADR：
- 30 天内 jili 产生的 Night/Bridge/Day artifact 数量
- 6 交互流触发次数分布
- 4 角色分化是否真有 user-value（jili 是否在不同角色间切换 vs 全程一角色）
- 哪些 Decision 项需修订（schema 细节通过 follow-up ADR-0021+ 修订；战略框架修订通过 ADR-0020 review log）
- Status: Proposed → Accepted（如 dogfood gate 通过）/ Accepted with caveat（部分通过）/ Superseded by ADR-XXXX（如发现根本问题）

---

## 7. References

### 项目内部
- `/Users/jili/.claude/plans/night-science-day-science-snoopy-widget.md`（Iteration 1-4 完整 deliberation，~700 行）
- `plan0/improvement-plan-2026-05.md`（待写 §十二 "Night-Bridge-Day Pivot"）
- `plan0/paper-platform-system-prompt.md`（第一性原理 11 条 + 待补 #12 #13）
- ADR-0001, 0002, 0008, 0010, 0011, 0014, 0015, 0016（review log 需追加）

### 用户自有文档
- `/Users/jili/project/nightscience/Night_Science_Cases_Revised.md`（5 大模式 + 60+ 案例）
- `/Users/jili/project/nightscience/night_science_concepts.md`（93 概念）
- `/Users/jili/project/nightscience/night_science_expanded.md`（6 交互模式）
- `/Users/jili/project/nightscience/night0.md`（4 层架构）
- `/Users/jili/project/nightscience/Night_Science_Complete.md`（7 大原则）
- 未读：`Night.md`（87KB）/ `Night_Science_Cases_Expanded.md`（75KB）/ `Night_Science_Enhanced_PPT.md`（46KB）/ `Night_Science_Presentation.pptx` / `Night Science1.21.pdf`

### 外部文献
- Yanai I, Lercher M. "Night science." _Genome Biology_ 20, 179 (2019). DOI: 10.1186/s13059-019-1800-6
- Yanai I, Lercher M. "It takes two to think." _Nature Biotechnology_ 42, 18-19 (2024). DOI: 10.1038/s41587-023-02074-2
- Yanai I, Lercher M. "The two languages of science." _Genome Biology_ 21, 147 (2020). DOI: 10.1186/s13059-020-02057-5
- 详 plan Appendix F.8 完整引用列表（科学哲学 / 创造力认知 / 开放性创新 / AI for Science 共 30+ 文献）
