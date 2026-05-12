# graphify 方法论提炼 — 4 条值得 port 的模式

> Date: 2026-05-12
> Status: **Research note**（不是 ADR — improvement-plan §四 新 ADR moratorium 期内不开新 ADR）
> Trigger: 2026-05-12 跑 `/graphify plan0` + `/graphify packages` 之后的方法论沉淀
> 目的: 当 Wave D-1 discovery-graph 从 contract tier promote 到 real tier 时（W12 dogfood gate），这 4 条模式直接可以 port，省一次重新设计

---

## 上下文

[graphify](https://github.com/safishamsi/graphify)（Python CLI / `pip install graphifyy`）是 Karpathy /raw folder workflow 派生出来的知识图谱工具：丢任意文件夹（代码 / 文档 / 论文 / 图像 / 视频）进去，输出交互式 `graph.html` + GraphRAG-ready `graph.json` + 审计报告 `GRAPH_REPORT.md`。

我们 2026-05-12 把它跑在本仓库 `plan0/` 与 `packages/` 子语料上（产物在 `wiki/graph/`）。它在两件事上做对了，值得未来 Wave D-1 discovery-graph 真升 real tier 时直接借鉴：**边置信度可审计** + **跨社区惊人连接是产品功能而不是后台分析**。

---

## 模式 1 · 三段式边置信度标签 + 数值 confidence_score

### graphify 怎么做

每条边强制带两项元数据：

```
{
  "source": "node_a",
  "target": "node_b",
  "relation": "calls | implements | references | ...",
  "confidence": "EXTRACTED | INFERRED | AMBIGUOUS",  // 三段标签
  "confidence_score": 1.0,                            // 数值 0-1
  "source_file": "...",
  "source_location": "..."
}
```

- `EXTRACTED` = 源码里 explicit 写明（import / call / citation / "see §3.2"）→ `confidence_score = 1.0`
- `INFERRED` = 合理推断（共享数据结构 / 实现同一算法 / 处理同一失败模式）→ 0.6-0.9
- `AMBIGUOUS` = AI 自己也不确定 → 0.1-0.3

**关键设计点**：`AMBIGUOUS` 不是被丢掉的边，是**显式 surface 出来等人 review** 的边。SKILL.md §"Honesty Rules"明确："Never invent an edge. If unsure, use AMBIGUOUS."

### 对应 Wave D-1 discovery-graph

ADR-0020 §2.7 定义的 6 Night discovery-graph + 4 Bridge 当前是 contract tier，**边没有置信度元数据**。real tier 升级时应吸收这一套：

- 用户在文档里**明确**写的 inter-Night 关联 → `EXTRACTED`
- AI 在 plugin 里**推断**出的"这两个段落可能在 Night-A 与 Night-C 之间"→ `INFERRED` + `confidence_score`
- AI **也不确定**的（"可能是吹哨人模式 / 也可能只是巧合"）→ `AMBIGUOUS`，UI 必须 surface 出来让人 review，**不能默默丢弃**

落地路径：
- `packages/schema` 给 discovery-graph 边加 `confidence` enum + `confidence_score` numeric 字段
- `packages/ai-runtime` plugin 在写 inter-Night 边时强制带这两项
- UI（apps/web）在 graph viz 里用颜色区分（EXTRACTED 实线 / INFERRED 虚线 / AMBIGUOUS 红框待审）

**触发 review log**：ADR-0020 在 W12 promote real tier 时追 review log §3，引用本文件。

---

## 模式 2 · 持久化 graph.json 跨 session + 增量 update

### graphify 怎么做

- 第一次跑：`/graphify <path>` → `graph.json` 写盘
- 之后改了文件：`/graphify <path> --update` → 只 re-extract 改动文件，merge 进现有 graph
- 删除文件：自动 prune ghost node
- 问答（`/graphify query <q>` / `/graphify path A B` / `/graphify explain X`）：答案反写 graph，下次 `--update` 当 Q&A 节点抽取出来

**关键设计点**：graph 是**积累性 asset**，不是每次 from scratch 重算的瞬时分析。用户问得越多，图谱越富。

### 对应 Wave D-1 discovery-graph

memory 记录：`triadic_wave_d_progress.md` 说 ADR-0020 当前用 jsonb 侧通道存 triadic context。这相当于"每次重算 + 不积累"。

升级 real tier 时考虑：
- "AI 推断的 inter-Night 关联"持久化（PG 表 `discovery_graph_edges` 而不是 jsonb 侧通道）
- 增量 update（用户改了 paragraph，只 re-infer 这个 paragraph 牵涉的 Night 关联，不全图重算）
- 用户在 collaboration 里问的"为什么这一段被关到 Night-C"问答**反写**回 graph，作为 EXTRACTED 边（rationale_for relation）

**不立即做**：ADR-0020 §2.7 路线已固定 contract → real 在 W12，提前做是 over-engineering（CLAUDE.md §5.3）。但本笔记存好，到时直接抄。

---

## 模式 3 · Community detection + cohesion score（"用户实际工作的边界" vs "系统预设结构"）

### graphify 怎么做

跑 Louvain 聚类 → 自动发现 N 个 community → 每个 community 报 `cohesion` 数值（不藏在符号后面）。报告里直接：

```
Community 3: Authentication Flow (cohesion=0.78)
  - principal-bridge.ts
  - capability-vocab.ts
  - acl-loader.ts
  - jwt-issuer.ts
```

cohesion < 0.5 的 community 自动标"loose — 可能不是一个真概念"。

### 对应 Wave D-1 + 这是 ADR-0020 §2.7 没覆盖的

ADR-0020 §2.7 把"6 Night"作为**预定义结构**塞给所有用户。这是合理的 default，但有个盲区：

**用户实际工作的 night 边界**可能与系统预设的 6 Night 不重合。比如某博士生只用 3 Night（Question Night / Evidence Night / Story Night）、某理论家只用 2 Night（Idea Night / Counter-example Night）。

如果在用户自己的 corpus 上跑 community detection（用户文档 + 用户的 inter-paragraph 引用），我们会发现"用户实际形成的 night 边界"——这比系统预设的 6 Night 更贴用户的研究节奏。

**这是 Phase 7 候选 feature**（不是 Phase 6）：
- 在用户语料 ≥30 文档时，跑一次 community detection
- 把发现的 community 与系统 6 Night 对比 → "你实际上在用 4 个 Night，而不是 6 个 — 要不要简化预设？"
- 高 cohesion community → 给用户一个建议：合并成自定义 Night

不立即做：这需要先有大量真用户语料才有意义。Phase 6/7 还没到那个量级。

---

## 模式 4 · "Surprising Connections" 跨社区桥节点是产品功能不是后台分析

### graphify 怎么做

跑完 community detection 后，找 **betweenness centrality 高 + 横跨 ≥2 个 community** 的节点 = 桥节点。报告里专门一节："Surprising Connections"——把这些桥节点 + 其连接的两端 surface 给用户。

**关键设计点**：这不是后台日志里的"分析师有空再看的统计"，是 GRAPH_REPORT.md 顶部三大栏目之一（与 God Nodes / Suggested Questions 并列）。**桥节点是产品功能不是后台分析。**

### 对应 Bridge Layer (ADR-0020 §2.7 4 Bridge)

ADR-0020 当前 4 Bridge 是**预定义的**（Question→Evidence Bridge / Evidence→Story Bridge / etc）。这是合理 default，但同样有盲区：

用户 corpus 里**真正活跃的桥**可能与预定义的 4 Bridge 不一样。比如用户实际上一直在 Q→S 直接跳过 Evidence（写小说式 essay），或者在 Counter-example Night ↔ Evidence Night 之间频繁来回（哲学家模式）。

**Phase 7 候选 feature**（与模式 3 配对）：
- 在用户语料上跑 betweenness centrality
- 发现的桥与预定义 4 Bridge 对比
- 高 betweenness 但不在 4 Bridge 里的连接 → "你似乎在 X ↔ Y 之间频繁来回，要不要把这升成显式 Bridge？"

不立即做：同模式 3，需要先有用户语料量级。

---

## 4 条模式汇总表

| 模式 | 即刻借鉴 | Phase | 触发 | 落地路径 |
|---|---|---|---|---|
| 1 · 三段边置信度 + score | ✅ W12 promote real tier 时 port | Phase 6 W12 | discovery-graph contract → real | `packages/schema` enum + `packages/ai-runtime` plugin |
| 2 · 持久化 + 增量 update | ✅ W12 promote real tier 时 port | Phase 6 W12 | 同上 | PG 表 `discovery_graph_edges`（不是 jsonb 侧通道） |
| 3 · Community detection on user corpus | ⏸ Phase 7 候选 | Phase 7 | 需用户语料 ≥30 文档 | 新 plugin `community-discovery@1` |
| 4 · Surprising bridge surfacing | ⏸ Phase 7 候选 | Phase 7 | 同上 | 同上 plugin |

---

## 不开 ADR-0021 的理由

CLAUDE.md §5.3 + improvement-plan §四 明确：**ADR-0012 / 0013 / 0014 dogfood gate 跑通并 promote 到 Accepted 之前不再起草新 ADR**。本文件是 research note，不是 ADR。

未来 real tier promote 时（W12），由 ADR-0020 review log §3 引用本文件即可，**不需要起 ADR-0021**。

---

## 参考

- graphify repo: <https://github.com/safishamsi/graphify>
- 本地 SKILL.md: `~/.claude/skills/graphify/SKILL.md`（1277 行）
- 本仓库 graphify 产物: `wiki/graph/plan0/` + `wiki/graph/code/`（2026-05-12 跑出）
- ADR-0020 Triadic Architecture: `plan0/adr/0020-night-bridge-day-triadic-architecture.md`
- improvement-plan §四 ADR moratorium: `plan0/improvement-plan-2026-05.md`
