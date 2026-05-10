# Onboarding · 3 分钟讲完所有差异化

> Phase 4 W10.4 落地。来源：`improvement-plan-2026-05.md §二 W10.4` —— "specimen 嵌 1 个 unsupported claim → 让用户点 maintenance scan → 看到 unsupported-claim finding → 派 researcher agent 补 evidence → coordinator 自动接 citation。3 分钟讲完所有差异化。"
>
> 5 步剧本同时演示 D1-D9 中 7 项差异化（D1 / D3 / D4 / D5 / D6 / D7 / D8）。

## 角色

- **作者**：用户，跨学科博士生，写综述
- **maintenance-scan agent**：定时跑的 SQL-pure 6 finding 生成器（ADR-0011）
- **researcher agent**：plugin（plugins/researcher-agent），调 CrossRef MCP 找 evidence（Phase 5 实测）
- **coordinator agent**：plugin（plugins/coordinator-agent），dispatch researcher → citation → 提议接受
- **citation agent**：plugin（plugins/citation-agent），用 W6.3 DOI 一键引用 + 提议 citation-ref 节点

## 5 步剧本

### 步 1 · 作者写一段 unsupported claim

作者从 `/(app)/docs/new` 选"文献综述"模板（W6.2 lit-review.json）→ 进入编辑器 → 写：

> 大语言模型在论文摘要生成上的表现已经达到与人类研究者相当的水平。

按 Phase 4 W6.5 + W6.1 落地：用户 select 这一段 → ⌘K → InlineAgentMenu floating menu → 4 chip 中点 "**核引用 / Verify citation**"。

但用户**没点**。模板里 `claim-tpl-unsupported` 是个空 claim，无 evidence。

作者继续写 30 秒。

**演示能力**：
- D8 CJK pre-pass（"水平。"全宽句号紧邻 "。" 不贴 Latin）
- W6.4 cjk-spacing 标点 boundary fix
- D4 Claim 一等节点（"已经达到与人类研究者相当的水平" 是 PM `claim` 节点 + `id=claim-tpl-unsupported`）
- W6.1 inline AgentPanel（顶部 chrome 没 chat 边栏）

### 步 2 · maintenance-scan agent 自动找到 unsupported claim

作者打开新标签 `/(app)/maintenance` → Server Component dashboard → severity 排序 → 看到一行：

> **unsupported-claim** · medium · "大语言模型在论文摘要生成上的表现..." · 点 → 跳到对应 block

dashboard 用 `<StatusPill status="proposed">` 而非 amber/red filled badge（W10.7 design audit 落地）。MonoDisc kind=agent monogram=M（提示该 finding 来自 maintenance-scan agent）。

作者点 "查看详情" → 看到 finding metadata：claim text + 当前 evidence count = 0 + suggested action "派 researcher 找 evidence"。

**演示能力**：
- D4 Claim/Evidence + maintenance scan 6 类 finding（ADR-0011）
- D3 Provenance（点 finding → 看到生成它的 agent 是 maintenance-scan worker）
- D2 Capability（dashboard 三档动作 知悉/已修复/忽略 受 capability 控制）

### 步 3 · 派 researcher agent

作者点 "派 researcher 补 evidence" → 跳回编辑器 → ⌘K InlineAgentMenu → 自动选 "**找证据 / Find evidence**" chip（kind=researcher）→ passage 自动取 claim 文本 + blockId 自动取 `claim-tpl-unsupported`。

POST `/api/agent/invoke` body `{ kind: 'researcher', documentId, passage, blockId }` → ai-runtime → researcher plugin 走 `input.provider.runAgent(...)`（W7.2 切完，Anthropic SDK 调用次数 = 0；走 `MockModelProvider` fallback OR Ollama OR Claude per BYO model resolver）→ 调 CrossRef MCP `lookup-by-keywords("LLM paper abstract human-level")` → 返回 3 篇候选 paper。

researcher agent 写 RevisionInbox 加 1 条 pending revision：建议插入 3 个 evidence 节点 + 1 个 citation-ref。

**演示能力**：
- D7 Coordinator-style multi-step（researcher 内部多步）
- D5 plugin/skill/MCP 三层（researcher = plugin，调用 CrossRef MCP）
- D6 ModelProvider 4 wire（self-host 用户切 Ollama 也能跑）
- D3 Provenance 写入：每条 revision 含 actorPrincipalId + agentContext + promptHash + toolCalls

### 步 4 · 作者打开 RevisionInbox 接受

作者从 inbox 接受第 1 条 revision → coordinator agent 接力。

coordinator-agent plugin 走 `runCoordinatorLoop`（W7.4 落 batch + step boundary flush；ai-runtime 100→111 测）：

1. **step 1**: dispatch citation-agent（kind=citation, mode=doi-direct, doi=10.XXXX/...）
2. **step 2**: citation-agent 调 CrossRef MCP `lookup-by-doi(...)` 返回 metadata → propose citation-ref 节点
3. **step 3**: dispatch back to researcher → 把 evidence 节点写到 claim 旁边
4. **step 4**: `[final]` 终止

scratchpad 累积每步状态；`maxSteps=6` 硬停（不会无限）；`allowedAgentKinds=[citation, researcher]` 二次过滤。

**演示能力**：
- D7 Coordinator 真 multi-step dispatcher（不是 router）
- D3 Provenance approvalChain 完整（accept revision → supersede 原 → coordinator dispatch → 子 job parent_job_id）
- W7.4 provenance batch（这一连串 8-10 条 contribution 走 1 transaction，SQL 量级 O(N steps × 3) 不是 O(N × M × 5)）

### 步 5 · 作者看到完成

作者回到编辑器 → 看到 claim 旁出现：

- 1 个 evidence node（"**Smith et al. 2024** · arXiv:24XX.XXXXX · 指出 GPT-4 摘要在 ROUGE-L 上略高于人类基线，但在事实准确度上低 7%。 · `endorses`"）
- 1 个 citation-ref mark（dotted underline accent-ink 蓝；hover → CitationPopover w/ APA 字段 + DOI mono dotted underline + 2 button）

claim 旁的 maintenance finding 在下次 scan 后自动转 `resolved`（W4 状态机 transition matrix）。

**演示能力**：
- D1 Y.Doc-as-tree（claim + evidence + citation-ref 在 PM 文档体）+ PG-as-graph（claim_id ↔ evidence_id ↔ citation_id ↔ contribution + provenance 全在 PG 关系图）
- D4 Counterpoint（evidence 的 `relation='challenges'` 也支持 —— Smith 文里事实准确度低 7% 是反 endorse 的细节）
- D9 plugin sandbox（researcher / citation 在 bwrap 沙箱里跑，capability 矩阵限制网络访问只到 CrossRef）

## 时长统计

| 步 | 操作 | 时长 |
|---|---|---|
| 1 | 选模板 + 写一段 unsupported claim | 60s |
| 2 | 打开 maintenance dashboard 看 finding | 15s |
| 3 | ⌘K 派 researcher | 5s |
| 4 | 等 researcher + coordinator + citation 跑完 | 60-90s |
| 5 | 接受 revision + 看到 claim + evidence + citation 出现 | 15s |
| **合计** | | **~3 分钟** |

## D1-D9 演示覆盖率

| # | 能力 | 步骤覆盖 |
|---|---|---|
| D1 | Y.Doc + PG-as-graph | 步 5 |
| D2 | Capability + Principal | 步 2（dashboard action 受 capability 控制）|
| D3 | Provenance schema | 步 3 + 步 4 + 步 5 |
| D4 | Claim/Evidence + maintenance scan | 步 1 + 步 2 + 步 5 |
| D5 | plugin/skill/MCP 三层 | 步 3 + 步 4 |
| D6 | ModelProvider 4 wire | 步 3（user 自配 Ollama 也能跑）|
| D7 | Coordinator multi-step | 步 4 |
| D8 | CJK pre-pass | 步 1 |
| D9 | Plugin sandbox | 步 5 |

## 实现状态

- 步 1：W6.1 + W6.2 + W6.4 ✅
- 步 2：ADR-0011 + W4 maintenance scan + dashboard ✅；6 finding 全交付（5 SQL-pure + 1 网络）
- 步 3：W6.3 DOI 一键 ✅；researcher agent W7.2 切 provider ✅；CrossRef MCP ✅；真跑通 demo paper require Phase 5 W9 G3 dogfood gate（real ANTHROPIC_API_KEY）
- 步 4：W7.4 coordinator buffer ✅；真 multi-agent goal require W9 G3
- 步 5：D1-D9 schema + W10.7 audit + W10.8 components/design/ ✅

**当前可跑路径**（mock LLM）：步 1 → 步 2 全可 sandbox；步 3-5 走 MockModelProvider fallback（W7.2），路径完整但 LLM 输出是固定 mock；真 Claude / Ollama 跑通 require external API key。

## 配套截图（W10 closeout 后补）

- 镜头 1：步 1 specimen Typst PDF 渲染上半页（中英 + 公式 + cite + serif body）
- 镜头 2：步 2 maintenance dashboard StatusPill + MonoDisc 横向 list
- 镜头 3：步 3 InlineAgentMenu floating menu 4 chip + DOI input
- 镜头 4：步 4 AgentTimeline 父子树（Phase 5 Wave A 落地后）
- 镜头 5：步 5 evidence + citation-ref + CitationPopover hover

镜头 1-3 当前已有 surface 可截；镜头 4 等 Phase 5；镜头 5 W10.7 后落定。

## 修订记录

- 2026-05-11 v1：Phase 4 W10.4 落地。
- 后续修订：Phase 5 Wave A 完成后镜头 4 加入；Wave B Claim-on-Claim Review 落地后加步 6（reviewer ORCID-sign verdict）。
