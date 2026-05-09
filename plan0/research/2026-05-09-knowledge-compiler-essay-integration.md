# Essay 整合：AI Native Knowledge OS（源证据驱动的知识编译器） → 计划迭代

**Trigger**：用户 2026-05-09 上传 `0e15c053-AI_Native_Knowledge_OS.md`（1180 行长论），主张
> AI Native Knowledge OS 不是无所不包的笔记软件，而是把来源材料编译成可信观点、再把可信观点编译成可发布文档的 **AI Native Knowledge Compiler**。

**目的**：以诚实评估的方式把 essay 中**真正有借鉴价值**的部分接入既有 Phase 2 计划，而**不是**重写架构。Phase 2 W1-W3（plugin 系统 + dogfood gate）已落地 6 commits，本次迭代不动那一层；调整面向 W5-W7 + 新 ADR slot。

---

## 1. 摘要：essay 主张 vs 当前计划

| Essay 主张 | 当前计划状态 | 评级 |
|---|---|---|
| Source/Claim/Evidence 7 对象模型 | Citation/Annotation/Block 但 **无 Claim/Evidence 类型** | **新增价值高** |
| Provenance by default | Phase 1 D7 强制 provenance row | ✅ 已对齐 |
| AI 是知识编译器，不是 ghostwriter | propose-mode（ADR-0002 role 4）+ 引用核查 + diff review | ✅ 已对齐 |
| Markdown=源码 / HTML=界面 / Typst=出版 | Phase 1.5 #5 提取 PmDocInput；多格式 export 落 | ✅ 已对齐 |
| 4 层架构（Source/Knowledge/Composition/Output） | 大致同构（PG + 编辑器 + render） | ✅ 大致对齐 |
| Evidence Map 标志性界面 | 无 | **新增价值高** |
| Source Reader UI | 无（Phase 2 W6 项目导入只做 Typst/LaTeX，无 AI 抽取叠加） | 推 Phase 3 |
| Draft Composer（claim 驱动） | 普通 Tiptap 空白页 | 推 Phase 3 评估 |
| Decision 对象 | 部分=Contribution+Annotation 拼凑 | 推 Phase 3 |
| Question 对象 | `annotation.kind=task` / `reviewer-note` 部分覆盖 | 不必新对象 |
| Knowledge maintenance 工作流（unsupported / outdated / contradiction） | 无 | 推 Phase 3 |
| AI context pack 输出 | 无 | **新增价值中**，W7 加 |
| 知识对象状态机 `AI-suggested → human-reviewed → approved` | revision 流已部分提供 | 把语义升级到 Claim/Evidence |
| §15 范例：`:::claim:::` `:::evidence:::` `:::counterpoint:::` `:::synthesis:::` `:::artifact:::` PM 块 | 无（PM 只有 citation-ref/annotation-anchor atom） | **新增价值最高** |

---

## 2. 真正值得纳入的 4 项（按价值排序）

### 2.1 Claim / Evidence / Counterpoint / Synthesis 作为 PM 一等块（**最高价值**）

**Why**：essay §3.2 "对象缺口"诊断切中我们当前痛点——一旦同一论点在多文档复用，PG `block_metadata` 无法承载"它是不是同一个 claim"。把 claim/evidence 升为 PM 块（带 PG 行）后：
- 同一 claim 跨文档可被多次 cite（类似 Citation 的"全局对象"语义）
- evidence 显式连 source（已有 Citation 表）+ 显式连 claim（新关系）
- counterpoint / synthesis 是高阶组合（不是新对象，是 claim-claim 的关系类型）
- AI agent 的 reviewer 任务（ADR-0008）可以"对每个 claim 检查 evidence coverage"——这就是 §7.4 knowledge maintenance 的种子

**Phase 2 W5 落地**（与 MathLive + table NodeView 一批做）：
- 4 个新 PM atom node：`claim` / `evidence` / `counterpoint` / `synthesis`，attrs 含稳定 id
- 2 个新 PG 表：`claim`（id, text, status, confidence, document_id 起源, created_by） + `claim_link`（claim_id × claim_id × type）
- evidence 复用 `citation` 表 + 加 `claim_id` 软外键（或单独 `evidence_binding` 表关联 claim × citation × excerpt 范围）
- NodeView：UI 显示 status badge / confidence / 跳转源
- ADR-0011 起草

**不做**（避免过度兼容性）：
- Question / Decision 对象（用现有 annotation_thread）
- claim 双链 / 反向链 dashboard（推 Phase 3）
- claim 跨文档"重命名/合并"UX（推 Phase 3）

### 2.2 Evidence Map 只读视图（**第二价值**）

**Why**：是 Claim 一等块的**自然下游 UI**——schema 已建起，map 视图就是 `SELECT claim_link WHERE claim_id IN (...)` 加力布局。essay §8.2 把它列为"系统标志性界面"，这与我们 5 轴差异化的 axis 2（Provenance）+ 新 axis 6（Claim-DAG）双轴结合的视觉表达。

**Phase 2 W7 落地**（验收 e2e 加一节 demo，不必单独 W）：
- 单文档 Evidence Map：列出 claim → supporting/counter evidence + sources
- 跨文档 reuse 视图（read-only）：列出"被哪些 draft 引用"
- 不做：图编辑 / 力布局物理 / 多选合并（推 Phase 3）

实现复用：proto-d-diff-library 的可视化基础 + render-pipeline。

### 2.3 AI context pack 输出格式（**第三价值**）

**Why**：essay §6.4 + §10.5 列为输出之一。它是给下游 AI agent 的输入，不是给人看的。一旦 Claim 是一等对象，导出"某文档涉及的 claim + evidence + sources"成 JSON/Markdown bundle 就是低成本 add-on，且与我们 axis 5（开放平台 / plugin system）天然契合——第三方 agent 用 AI context pack 启动新研究。

**Phase 2 W7 落地**：
- 一个新 export format：`AI context pack`（JSON 或 zipped Markdown）
- schema：`{ doc_id, claims[], evidences[], sources[], provenance[] }`
- 走现有 `apps/web/src/app/api/export/` 路径，不新增基础设施

### 2.4 知识对象状态机（**第四价值，与 2.1 合做**）

**Why**：essay §6.2 主张 `AI-suggested → human-reviewed → approved → reused` 是 claim/evidence 的核心状态。我们既有 Revision `proposed/accepted/rejected/superseded` 状态机给 Revision 用；Claim 是更细对象，复用同一状态机模式。

**Phase 2 W5 落地**（与 §2.1 合并）：
- `claim.status` enum: `ai-suggested / human-reviewed / approved / deprecated / superseded`
- 状态变迁通过 contribution + provenance 写入（不再开新 audit 路径）

---

## 3. 推迟到 Phase 3 / 不做

| Essay 主张 | 推迟原因 |
|---|---|
| Source Reader UI（左源 + 右 AI 抽取） | Phase 2 W6 import 只做 Typst/LaTeX；AI 抽取要 reviewer agent 形态稳后再做（user 哲学：避免过度兼容性投入） |
| Draft Composer（claim 驱动写作界面） | 等 Claim 一等块（W5）+ Evidence Map（W7）落地后实测 dogfood，再决定是否替换空白页编辑（推 Phase 3） |
| Decision 对象 | annotation_thread + revision approval chain 已覆盖 ADR-style 决策；新对象徒增复杂度（推 Phase 3 评估） |
| Question 对象 | `annotation.kind=task` 已覆盖；新对象不必 |
| Knowledge maintenance 扫描（unsupported / outdated / contradiction） | 长 horizon 任务，挂 ADR-0008 pgboss runtime；推 Phase 3 第一个真实任务跑完 reviewer agent 后再排 |
| 全文 AI 抽取 source → claim/evidence 的 ingestion 流水线 | 同上推 Phase 3；先有手工标注 claim 的 dogfood，再上 AI 抽取 |

---

## 4. 计划文件具体调整

### 4.1 plan0/phase-2-plan-stub.md

- §一 范围表加新行：**Knowledge object DAG**（Phase 1: Citation/Annotation；Phase 2: **Claim/Evidence/Counterpoint/Synthesis 一等块 + Evidence Map 只读视图**）
- §五 W5 augment：原"MathLive + 表格/定理 NodeView" + **Claim/Evidence/Counterpoint/Synthesis NodeView + ADR-0011 起草**
- §五 W7 augment：原 e2e + **Evidence Map 单文档 demo + AI context pack export demo**
- §四 不做的事 reaffirm：Source Reader UI / Draft Composer 替换 / Decision 对象 / knowledge maintenance scan 推 Phase 3
- §二 / §六 不动
- §七 雷达加被动 watch 项："essay §15 `:::claim:::` 块的 unified plugin（remark/MyST 是否已有）"

### 4.2 plan0/research/2026-05-09-targets-vs-others-review.md（差异化轴扩展）

新增 **第 6 轴：Knowledge object DAG / Claim-Evidence first**（complementary 于 axis 2 Provenance；axis 2 是"每节点有源"，axis 6 是"知识单位是 claim 不是 page"）。

5 轴 + 1 加总：
1. AI native（agent + propose-mode + skill 系统）
2. Provenance by default
3. Bilingual zh/en parity
4. Long-form academic publish（Typst/Quarto first）
5. Open platform（plugin / kernel-vs-plugin）
6. **Knowledge object DAG / Claim-Evidence first** ← essay 推动新增

第 6 轴 Phase 2 W5+W7 实证；Phase 3 上 Source Reader / Draft Composer / knowledge maintenance 把它做厚。

### 4.3 ADR-0011 stub

新文件 `plan0/adr/0011-claim-evidence-knowledge-object.md`，状态 **Proposed at Phase 2 W5**（W5 起草，W7 dogfood gate 类比 ADR-0010 W3 gate 验证 Claim 一等块跑通——单文档 Evidence Map demo 必须可用）。

ADR-0011 必答：
- Claim 是 PM atom node 还是 PM block？（倾向 atom + 标记其包覆段落，类似 annotation-anchor 的"行内挂"模式；保持 prose 连续性）
- `claim` PG 表字段（status enum / confidence enum / 全局 ID 还是 doc-scoped）
- `claim_link` 关系表 vs 嵌入 `claim.related_to[]`（倾向独立表，便于 Evidence Map 查询）
- evidence 是新表还是复用 citation + 加 binding 表？（倾向后者，避免新表）
- 状态机变迁的 audit 路径（复用 Provenance）
- claim 跨文档 reuse 时谁是"首次起源 doc"（类比 citation 全局，倾向同设计）
- Plugin API 暴露（per ADR-0010 §2.4）：第三方 plugin 能不能新增 claim sub-type？（先 No，Phase 3 评估）

---

## 5. 不变的判断

essay 没有改变下列既定决策：

- Phase 2 W1-W3 plugin 系统设计 + dogfood gate（已 PASS，不动）
- ADR-0007 molab iframe 路径（W4 不动）
- ADR-0008 long-horizon agent runtime（pgboss + SSE，不动；后续 reviewer agent + knowledge maintenance scan 都挂这上面）
- Typst > LaTeX 哲学（不动）
- 避免过度兼容性（essay 也强烈主张"narrow first"——§14.1 完全契合）

---

## 6. 与 user 哲学对齐核查

| user 哲学（2026-05-09） | essay 整合是否契合 |
|---|---|
| Typst > LaTeX | ✅ essay §9.3 把 Typst 列入正式出版层 |
| 避免过度兼容性 | ✅ essay §14.1 narrow first；本整合明确推迟 5 项到 Phase 3 |
| 新技术敢上 | ✅ Claim 一等块在 PM 生态相对前沿；MyST/Pandoc/remark 圈子有零星实践 |
| 平台性非常重要 | ✅ Plugin 系统不变；Claim/Evidence schema 也通过 ADR-0011 规划 plugin API（Phase 3 暴露） |

---

## 7. 决策待用户确认

1. **是否同意把 essay 第 2 节 4 项纳入** Phase 2 W5/W7？（最关键：Claim/Evidence 一等块）
2. **是否同意新增第 6 差异化轴** "Knowledge object DAG / Claim-Evidence first"？
3. **是否起 ADR-0011 stub**（W5 实施前起草）？
4. essay §15 `:::claim:::` 等块的 syntax 是否对齐 MyST directive 风格（与 render-myst 现有管线一致）？

如果 4 项均 yes，下一步进入 W5：起 ADR-0011 stub + 设计 Claim PG schema 草案。

如果你对 §2 的 4 项排序有不同看法（例如"Evidence Map 应该比 Claim 块还高优先"），告诉我，重排即可。
