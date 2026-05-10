# 差异化矩阵 · D1-D9 vs 4 竞品

> Phase 4 W10.3 落地。complement `plan0/paper-platform-landscape.md`（已调研竞品全景），本文件聚焦"我们已交付的 9 项硬差异化 vs 主要竞品"。
>
> 来源：`.brainstorm/role-product.md §1`（产品策略 + 竞品分析 role agent 调研）。
>
> 日期：2026-05-11。

## 矩阵

| # | 能力 | Prism | Curvenote | PubPub | Overleaf |
|---|---|---|---|---|---|
| **D1** | **Y.Doc-as-tree + PG-as-graph 拆分**（CRDT 体只放 inline-mergeable PM；引用 / claim / evidence / contribution / provenance 全部落 PG 关系图） | ✗ 单 LLM 编辑器，无文档图 | ⚠ MyST AST 树，引用是 attr 不是关系图 | ⚠ block 列表 + 评论线程，无关系图 | ✗ .tex 文件树 |
| **D2** | **Capability + Principal（user/org/service/agent）+ 36 capability + 5 role bundle** | ✗ 单用户 | ✗ owner/editor/viewer 三档 RBAC | ✗ 三档 RBAC + 评审者外加 | ✗ 项目级 owner/collaborator |
| **D3** | **Provenance 写入是 commit boundary 硬契约**（actorPrincipalId / agentContext / promptHash / toolCalls[] 缺一即拒；approvalChain DAG） | ⚠ diff approval 但无 promptHash schema | ✗ 无 | ✗ 无 | ✗ 无 |
| **D4** | **Claim/Evidence/Counterpoint/Synthesis 一等节点**（PM schema + PG）+ maintenance scan 6 类 finding（unsupported-claim / contradicted / duplicated / broken-citation / outdated-source / unverified-ai-block） | ✗ 无 | ✗ 无（论证图不在范围）| ⚠ Manubot 风 fork-able doc，无 claim 图 | ✗ 无 |
| **D5** | **MCP server 注册表 + 三层扩展（plugin / skill / MCP）**（plugin 是 agent 实现；skill 是 Anthropic-style SKILL.md 自然语言能力包；MCP 是数据/工具 bus）| ⚠ MCP 已支持但无 SKILL.md | ✗ 无 plugin/MCP/skill | ✗ 无 | ✗ 无 |
| **D6** | **ModelProvider 4 wire abstraction + 4 档 resolver**（document-override > user-pref > manifest-hint > env-default；anthropic / openai-compat / ollama / custom-http；W7.2 plugin contract `provider: ModelProvider` 全切，Anthropic SDK 调用次数 = 0）| ✗ GPT 锁定 | ✗ 无 LLM 集成 | ✗ 无 | ✗ 无 |
| **D7** | **Coordinator multi-step dispatcher**（sync+async handoff / scratchpad / `[final]` 终止 / maxSteps 硬停 / capability gating；6 内置 plugin: citation / inline-editor / reviewer / researcher / source-extractor / coordinator） | ✗ 单 agent | ✗ 无 | ✗ 无 | ✗ 无 |
| **D8** | **CJK pre-pass 一等公民**（标点挤压 + smart-quote-by-language + 思源 / Noto fallback chain；packages/typography 24 测）| ⚠ 后想，CJK 间距残缺 | ⚠ 靠 LaTeX CJK 包 | ✗ 不支持 CJK 排版 | ⚠ 靠 LaTeX 用户自配 |
| **D9** | **三平台 plugin sandbox 描述符**（bwrap Linux + sandbox-exec macOS placeholder + AppContainer Windows placeholder）+ **capability prompt UI**（装前显示要的能力 + 用户勾选 superset）+ **非 Linux UI 显式拦截**替代 silent fallback | ✗ 无 plugin | ✗ 无 plugin | ✗ 无 plugin sandbox | ✗ 无 plugin |

✓ = 已交付完整且独有；⚠ = 部分支持但有缺口；✗ = 不存在 / 不支持

## 解读

### 真护城河（4 竞品全 ✗ 的能力）

- **D1 Y.Doc-as-tree + PG-as-graph 拆分**：把"论证图"建成关系数据库一等节点 —— Prism / Curvenote / Authorea / Notion 全无对应物。
- **D3 Provenance schema 硬契约**：每段 AI 介入 promptHash + toolCalls[] 进 PG schema。Cursor / Inkeep / Braintrust 是事后 trace 层，不是协作 commit 边界硬契约。
- **D4 Claim/Evidence + 6 maintenance finding**：唯一的"论文是论证图，不是文字流"落到代码。Manubot fork-able doc 没建论证图；Octopus 拆 IMRAD 没建论证图；PubPub 没 maintenance scan。
- **D6 ModelProvider self-host + per-document override**：4 wire × 4 档。Self-host 用户能在一篇论文挂 Ollama，另一篇挂 Claude，第三篇挂私有 vLLM。W7.2 后 Anthropic SDK 调用次数 = 0 真兑现。
- **D7 Coordinator 是产品功能不是 demo**："投 Nature → coordinator 编排 inline-editor → citation → reviewer 三步"是 Curvenote / Prism 都没有的复合任务。
- **D9 Plugin OS-level sandbox**：研究写作工具里第一个把 OS-level sandbox 做进 manifest 的（Obsidian 不 sandbox 已踩坑；VSCode process-level）。

### 部分领先

- **D2 Capability + 4 kind Principal**：Overleaf / Curvenote / Notion 都是简单 RBAC；agent 与人类共用同一权限模型是项目层独有。
- **D5 三层扩展（plugin / skill / MCP）**：Cursor 有 MCP 但无 SKILL.md；Anthropic Skills 有 SKILL.md 但没用在论文场景。三层在同一架构下交叉 = 当前独家。
- **D8 CJK pre-pass**：做成独立 package（packages/typography）而非选项是少见的；Curvenote / Overleaf 靠 LaTeX 用户自配；Prism 后想加。

## 战略含义

> ".brainstorm/COUNCIL.md Synthesis · Core Tension"：D1-D9 内核差异化是真的，但 README/UI/onboarding 把它们叙述成功能清单而非"vs 竞品独有"。**这张表是 README 锐化的实证基础**。

**接下来的策略**（Phase 5+）：

1. **5 年差异化锚点 = D3 + D4 组合**（Provenance graph + Claim/Evidence DAG）。Phase 5 Wave B 落地 **Claim-on-Claim Review**：reviewer = annotation on claim 的 ORCID-signed provenance lineage。这是表里"4 ✗"行的延伸 —— 把"评审是 claim 上的 annotation + 可验证 review 图"做出来，PubPub / ResearchHub 5 年内做不到。
2. **D5 三层扩展 = 中期开发者侧护城河**：第三方 plugin 生态（不重蹈 Notion Integrations 弱平台 —— shadcn registry 模式即可）。
3. **D6 ModelProvider self-host = self-host 圈最强卖点**：开放科学 / 隐私敏感实验室 / 跨学科群体的 default 选择。
4. **D8 CJK pre-pass 不要新加东西**：维护即可，做成营销资产（landing page 的 specimen Typst PDF 渲染上半页）。

## 反超风险窗口

- **D6 的反超时间**：Curvenote / Prism 任意一家上 Ollama / vLLM 适配器即可。建议 Phase 5 Wave A 加深 ModelProvider 测试覆盖（4 endpoint round-trip 真跑）+ AgentTimeline observability 把 model + cost + iterations 暴露。
- **D7 反超时间**：multi-agent coordinator 是产品功能没人做，但 LangGraph / CrewAI 是库（不是产品）。如果 Curvenote 集成 LangGraph 就追上。**Phase 5 Wave B Claim-on-Claim Review 是把 D7 用户感知度拉满的杠杆**（multi-step coordinator 真跑 multi-reviewer goal）。
- **D8 反超概率低**（CJK 排版投入高，现有竞品没意愿）。

## 修订记录

- 2026-05-11 v1：从 `.brainstorm/role-product.md §1` 提炼，对应 Phase 4 W6-W10 closeout 实际交付。
- 后续修订：Phase 5 Wave B 落地后增 D10 Claim-on-Claim Review 行；Phase 5 Wave C 元 dogfood 后给每行附"实际用户声音"佐证。
