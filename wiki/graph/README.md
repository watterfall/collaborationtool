# wiki/graph — collaborationtool 知识图谱

> graphify 在本仓库 plan0/ 与 packages/ 子语料上跑出来的知识图谱。
> 给新会话 / 新协作者 / 想找 prior art 的人当导航用——比 grep 50 次更快。

---

## 这是什么

| 子目录 | 语料 | 主用途 |
|---|---|---|
| `plan0/` | ADR + plan stub + improvement-plan + COUNCIL 5 份 role 报告 + landscape + research/ | docs-only 概念图。看哪些 ADR 是 hub、跨 ADR 的隐性关联、prior art 检索 |
| `code/` | `packages/` + `plugins/` + `mcp-servers/` | AST 主力的代码依赖图。看 import 拓扑、跨包潜在耦合、god functions |

每个子目录三件套：

- **`graph.html`** — 浏览器直接打开，零服务器，节点按 community 上色，hover 看 source location
- **`GRAPH_REPORT.md`** — 审计报告，三大栏目：God Nodes / Surprising Connections / Suggested Questions
- **`graph.json`** — 持久化图，可塞 GraphRAG / Neo4j / Claude Desktop MCP（详见"延期到将来"段）
- **`cost.json`** — 跑这次 graphify 消耗的 token 累计（可审）

---

## 什么时候看

### 新会话 / 新协作者 onboarding

1. 先开 `plan0/graph.html`，找 god nodes（degree 最高的节点）
2. god nodes 一定是 ADR-0010 (plugin runtime) / ADR-0014 (subdocument) / ADR-0020 (triadic) 这类 hub
3. 顺着 god nodes 的连接看，比从 STATUS.md 顶部一行行读快很多

### 任何"X 关连到什么"问题

```
/graphify query "ADR-0010 plugin runtime 怎么影响 Wave D-1 discovery-graph"
```

BFS 默认（广度优先，看相邻 3 层）；加 `--dfs` 走深度优先追一条链；加 `--budget 1500` 限制 token 输出。

### "X 和 Y 之间最短路径"问题

```
/graphify path "ADR-0014" "doc-store"
```

返回最短路径每一跳 + 边关系。

### 写新 ADR 前

**先看 `plan0/GRAPH_REPORT.md` 的"Surprising Connections"段**。这是 graphify 的核心 ROI：找出跨 community 的桥节点（betweenness centrality 高），帮你确认 prior art 没漏。

CLAUDE.md §5.4 红线："每次提方案先 grep landscape / ADR Context / findings.md 是否已经讨论过"。grep 50 次找 prior art 不如先看 surprising connections 一次。

---

## 什么时候 refresh

**手动触发，不装 post-commit hook**（git churn 大 + token 成本不可控）。

触发时机：
- Phase 推进（W -> W+1，或 phase N -> N+1）
- 大 ADR 改动（新 ADR / Proposed → Accepted promote）
- improvement-plan 改动
- 新 plugin 落地（新进 plugins/ 的文件夹）

命令：
```bash
# 增量（推荐，只 re-extract 改动的文件）
/graphify plan0 --update
# 或
/graphify packages --update

# 然后迁产物
mv graphify-out/graph.html wiki/graph/plan0/   # 或 code/
mv graphify-out/GRAPH_REPORT.md wiki/graph/plan0/
mv graphify-out/graph.json wiki/graph/plan0/
mv graphify-out/cost.json wiki/graph/plan0/
rm -rf graphify-out
```

完整重跑（罕见 — 比如想换 community labels）：
```bash
/graphify plan0    # 不带 --update
```

---

## 已知盲点 / honest audit

graphify SKILL.md §"Honesty Rules"明确：

- **`INFERRED` 边**可能误判（`confidence_score` 0.4-0.7 段需人工校验）。看到反直觉的 INFERRED 连接，去 source location 验证一下
- **`AMBIGUOUS` 边**不要直接当依据，是给人类 review 的（"AI 自己也不确定"的边）
- **跨 plan0/ 与 code/ 的关联**目前没建（需要合并跑 `/graphify .` 全仓，但 >200 files 会触发 graphify 拆子目录警告 — 延期到 Phase 6 W2+ 决策）
- **HTML viz 上限 5000 节点**（超出后只看 GRAPH_REPORT.md + graph.json）

---

## 想做但延期了

按 CLAUDE.md §5.3"不要塞功能到 core" + improvement-plan §四"新 ADR moratorium"，下面这些主动延期：

| 想做 | 为什么延期 | 复活条件 |
|---|---|---|
| `--mcp` stdio server 暴露 graph.json 给 Claude Desktop | 先验证图本身价值再决定 MCP 暴露 | 用户用 graph.html 用得舒服，主动要求"也能让 AI 查图" |
| 跨 plan0/ + code/ 合并跑全仓 | >200 files 触发拆子目录警告；分开跑 ROI 已足够 | Phase 6 W2+ 真要回答"哪条 ADR 在哪个 package 实现"时再决策 |
| 集成 graphify 模式进产品 runtime | Wave D-1 discovery-graph 6 Night 已 landed contract tier；W12 dogfood gate 才升 real | 见 `plan0/research/2026-05-12-graphify-methodology.md`（4 条模式备好等 promote real tier 时直接 port） |
| 装 `graphify hook install` post-commit 自动重跑 | git churn 大，每次 commit 都 token | 改成手动触发更合理 |
| Obsidian vault 输出（`--obsidian`） | 一节点一 .md 文件，本仓库不用 Obsidian | 改成 Obsidian 工作流的协作者可以本地开 `--obsidian` |

---

## 参考

- graphify repo: <https://github.com/safishamsi/graphify>（赞助 <https://github.com/sponsors/safishamsi>）
- 本地 SKILL.md: `~/.claude/skills/graphify/SKILL.md`（1277 行）
- 方法论笔记: `plan0/research/2026-05-12-graphify-methodology.md`（4 条模式）
- 工作 plan: `~/.claude/plans/https-github-com-safishamsi-graphify-spicy-turing.md`
