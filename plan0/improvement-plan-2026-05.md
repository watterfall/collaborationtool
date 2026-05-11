# 改进计划 · 2026-05（Council 评审驱动）

> 基于 `.brainstorm/COUNCIL.md` + 5 份 role 报告（产品/架构/用户/AI/设计），调整 Phase 4 收尾 + Phase 5 范围。
> 目的：把 D1-D9 内核差异化翻译成用户可感知的动作 + 堵 3 处 ADR-vs-代码诚实度赤字 + 砍掉无锚点 feature。
> 日期：2026-05-10。
> Status：**Proposed** — 待项目所有者评审 / 调整 / kickoff。

---

## 一、调整原则（Council convergence）

1. **内核差异化是真的（D1-D9）**——不在已交付能力上做"更多功能"，做"更可见 + 更扛 dogfood"。
2. **AgentPanel 是 sidebar disguised**——这一处不修，所有"AI 不是侧边栏"叙事都失重，是单一 feature 解锁多重叙事的 ROI 机会。
3. **3 处诚实度赤字**（doc-store / plugin provider / macOS sandbox）必须在 ADR promote 前堵上，否则 0001 / 0012 / 0013 promote Accepted 是基于文本而非代码现实。
4. **Phase 5 候选过载**——spatial canvas / fork-merge UI / Loro 评估 / 跨设备同步全部砍 / 推 Phase 6+。新 ADR moratorium 1 phase。
5. **5 年差异化锚点 = Provenance graph + Claim/Evidence**，Phase 5 主线是 **claim-on-claim review prototype**（reviewer 不是新角色，是 annotation on claim 的 ORCID-signed provenance lineage）。
6. **元 dogfood 是盲点**——把 plan0/ + landscape + ADR-INDEX 用 collaborationtool 自己写一遍，不做这一步所有差异化都是别人的故事。

---

## 二、Phase 4 W6-W10 调整（替换原 plan stub §一 W7-W10）

> 原 stub W7 章节 fork-merge UI / W8 ORCID + 开放评审 / W9 跨设备同步 / W10 Loro 评估
> → 全部重排。砍 W7 / 推 W9-W10。把 W7-W10 改成 "Surface 到现实 + 抽象债堵漏 + dogfood gate 跑通 + ADR promote"。

### W6 · 表层 to 现实（兑现第一性原理 #3 #4 #7）

> 单周交付。每条都已经有 backend，只缺前端 trigger / token 修。

| ID | 任务 | 路径 | 工程量 |
|---|---|---|---|
| W6.1 | **AgentPanel 拆门**：改 PM Mark + ⌘K floating menu，selection 自动取 passage / blockId（替代 `AgentPanel.tsx:46` `passage` 不接 selection + `blockId='blk-cursor'` 占位） | `packages/editor-core/src/extensions/agent-trigger.ts`（新）+ `apps/web/src/app/(app)/editor/[docId]/components/InlineAgentMenu.tsx`（新，保留 RevisionInbox 做 audit log） | 2-3 天 |
| W6.2 | **新建文档 3 模板**：空白 / 双语论文（specimen-bilingual） / 文献综述（claim+evidence 预填） | `apps/web/src/app/(app)/docs/new/page.tsx` 加模板选择 + `apps/web/public/templates/{blank,bilingual-paper,lit-review}.json` | 1 天 |
| W6.3 | **DOI 一键引用**：`@` trigger 调 inline-editor → CrossRef MCP propose-fragment | 复用 `mcp-servers/crossref` + `packages/ai-runtime/src/agents/citation.ts`，前端在 W6.1 menu 加 `@` 路径 | 1-2 天 |
| W6.4 | **cjk-spacing 标点 boundary 修**（设计报告 §5.1 实测 bug） | `packages/typography/src/cjk-spacing.ts:44-46` 加 `isCjkPunctuation` 分支 + 1 测试 | 半天 |
| W6.5 | **ShareDialog email fallback UI**：MAIL_WEBHOOK_URL 没配时把 acceptUrl 直接显示 + "复制邀请链接"按钮（替代 stderr） | `apps/web/src/app/(app)/editor/[docId]/components/ShareDialog.tsx` | 半天 |

**dogfood gate**：用户 A（跨学科博士生）30 分钟内完成"建文档 → 写 1 段中英混排 → @-DOI 引用 1 篇 → 选段 → ⌘K 让 inline-editor 改写 → 接受/拒绝"全流程，**0 次打开侧边栏**。

**ADR review log**：ADR-0007（cell auth-token 不动），新增 review log on ADR-0011（W6.1 把 inline-editor 从 panel 转 PM mark）。

---

### W7 · 抽象债堵漏（堵 D1 + D2）

> 这两处不堵，Phase 5 dogfood 全裂。

| ID | 任务 | 路径 | 工程量 |
|---|---|---|---|
| W7.1 | **`packages/doc-store/` 抽象骨架**：`DocStore.getDocument(id) → DocumentHandle` 接口，把 `editor-core` / `snapshot-worker` / `sync-gateway` / `ADR-0014 subdocument` 的 `Y.Doc` import 全收口 | `packages/doc-store/src/{index,types,yjs-backend}.ts` + 替换全 `import * as Y` 直接调用 | 4-5 天 |
| W7.2 | **`AgentPluginInput.anthropic` → `provider: ModelProvider`**（ADR-0013 §2.5 承诺） | `packages/ai-runtime/src/plugins/types.ts:218` + 5 plugin（citation / coordinator / inline-editor / researcher / reviewer）各 ~30 行 | 2-3 天 |
| W7.3 | **`materialiseRoleBundleBulk(rows[])`**：单次 multi-row INSERT 替代逐行 | `packages/permissions/src/acl-loader.ts` | 半天 |
| W7.4 | **`persistProposalBatch(inputs[])`**：单 transaction 多 INSERT，coordinator dispatch loop step boundary flush | `packages/ai-runtime/src/provenance-writer.ts` + `packages/ai-runtime/src/coordinator/loop.ts` 加 buffer | 1-2 天 |

**dogfood gate**：
- W7.1 验收：`grep -r "import.*from 'yjs'" packages/{editor-core,snapshot-worker,sync-gateway,ai-runtime} apps/` 命中数 → 应只在 `packages/doc-store/` 内
- W7.2 验收：把 `ANTHROPIC_API_KEY` 拔掉、设 `OLLAMA_HOST=http://localhost:11434`，5 plugin 全部走 `OllamaProvider` 真完成 1 次 invoke
- W7.3 验收：500 reviewer × 50 subdoc × 16 cap = 400,000 行写入 < 5s（多行 INSERT 单语句）
- W7.4 验收：coordinator 真 LLM dispatch loop 1 个 goal 触发 ≥ 20 contribution，SQL 总数 < 10（不再是逐条 5 SQL）

**ADR review log**：ADR-0001 §7（doc-store 抽象迟到 + 落地）；ADR-0013 §3（plugin contract 切换 + Ollama dogfood）；ADR-0002 §8（bulk insert 阈值）。

---

### W8 · macOS sandbox 选择 + ORCID 真集成

| ID | 任务 | 路径 | 工程量 |
|---|---|---|---|
| W8.1 | **macOS sandbox-exec profile 真写 OR UI 显式拦截**（二选一，ADR-0012 review log 写明） | (a) `packages/ai-runtime/src/plugins/install.ts:217` 真写 sandbox-exec DSL（参考 `man sandbox-exec` + Firefox sandbox） + spawn 路径；(b) `apps/web/src/app/(app)/settings/plugins/page.tsx` 在非 Linux 拦截 + 文案"plugin install 当前仅 Linux 支持，macOS / Windows 推 Phase 5" | (a) 3-4 天 / (b) 半天 |
| W8.2 | **ORCID 真集成**：better-auth ORCID provider 真 OAuth 回跳 + Principal kind=org bridge 验证 | `apps/web/src/lib/auth.ts` + 8 个 ORCID test 从 mock 改 real 测试 | 2-3 天 |
| W8.3 | **plugin install 让用户粘 manifest JSON 改 url-or-paste 双轨 + 友好预览**（替代 `searchParams.manifest`） | `apps/web/src/app/(app)/settings/plugins/page.tsx` UI 重写 manifest 输入步 | 1 天 |

**dogfood gate**：
- W8.1：macOS 用户可用 OR UI 拦截无 silent fallback
- W8.2：真 ORCID 账号 OAuth 完整跑通（test scope `/authenticate`）
- W8.3：用户从仓库 URL 粘贴 manifest，3 步内完成安装（输入 URL → 预览 capability → 勾选安装）

**ADR review log**：ADR-0012 §6（macOS 决策）；ADR-0015 §3（ORCID dogfood）。

---

### W9 · 全 dogfood gate 跑通（推迟项收尾）

> 把 Phase 4 W1-W5 的所有"推 dogfood gate"批量跑通。

| Gate | 来源 | 准备 |
|---|---|---|
| W1 dogfood：bwrap 真启动 + git clone + tarball SHA | ADR-0012 | Linux host CI 上跑 e2e（已就位仅缺 host） |
| W2 dogfood：4 endpoint round-trip（Anthropic / OpenAI-compat / Ollama / custom-http） | ADR-0013 | 4 个测试 API key（dev env），跑 plugin 5 个 invoke |
| W3 dogfood：端到端真 multi-agent（goal: "把这一节改投 Nature 风格 + 补全所有引用 + 评审"） | ADR-0008 | 真 ANTHROPIC_API_KEY + crossref 真 MCP；coordinator + inline-editor + citation + reviewer 4 串 |
| W4 dogfood：pgboss queue 真启 + 6 finding 各 1 fixture + dashboard 实测 | ADR-0011 | redis 已有 docker-compose，6 finding 写 fixture seed |
| W5-W6 dogfood：50 客户端 stress + cross-doc reference 真同步 + subdocument-level ACL | ADR-0014 | sync-gateway 多 subdoc 路由（已落 capability_resource_type=subdocument）+ snapshot-worker 增量 + Y.Map crossRefs ↔ crossref_index dual-write（owner = snapshot-worker）|

**ADR-0014 §5 dual-write 决策（W5-W6 dogfood 前置）**：
- crossRefs Y.Map 主、PG 后台同步
- owner = `apps/snapshot-worker`（已经做 Y.Doc 增量持久化，新增 `Y.Map.observe` → PG INSERT 路径）
- 一致性窗口：snapshot tick 周期（默认 5s）
- maintenance scan broken-citation 跨 subdoc 检查文档明确 false negative 窗口

**ADR review log**：0008 / 0011 / 0012 / 0013 / 0014 各加一条 promote-trigger 记录。

---

### W10 · ADR promote + Phase 4 closeout

| ID | 任务 |
|---|---|
| W10.1 | ADR-0012 / 0013 / 0014 状态 Proposed → **Accepted**（W7-W9 dogfood 全 PASS 前置） |
| W10.2 | README 改写：5 条 vs-竞品独有叙事（用 `.brainstorm/role-product.md §2` 五条） |
| W10.3 | `plan0/paper-platform-landscape.md` 加 9×4 矩阵（D1-D9 vs Prism / Curvenote / PubPub / Overleaf）|
| W10.4 | `apps/web/public/demo/onboarding.json`：specimen 嵌 1 个 unsupported claim → 让用户点 maintenance scan → 派 researcher → coordinator 接 citation。3 分钟讲完所有差异化 |
| W10.5 | STATUS.md Phase 4 closeout 段：dogfood 矩阵 + 3 处诚实度赤字闭环报告 |
| W10.6 | `globals.css` editorial token v1（设计报告 §5.2）：measure / leading-cjk / palt+pkna / hyphens / tabular-nums / serif body |

---

## 三、Phase 5 Milestone（Proposed） · "Editorial · Honesty · 5-year Anchor"

> 8-10 周。聚焦 5 年差异化锚点，不再加新维度。

### Wave A · Honesty closeout（W1-W2）

| ID | 任务 | 路径 |
|---|---|---|
| A1 | **`packages/ai-runtime/src/quota-enforcer.ts`**：Phase 1 PG counter（Redis Phase 6+），invoke 路由前置 + agent-worker dispatch 前置；超 quota 429 + 写 `agent_job_event{kind='quota_blocked'}`。补 ADR-0008 §122 承诺。 | 新文件 + `apps/web/.../api/agent/invoke/route.ts` 前置 + `apps/agent-worker/src/index.ts` 前置 |
| A2 | **`POST /api/agent/job/<jobId>/cancel`**：补 ADR-0008 §93。worker 在每个 MCP `callTool` 前 poll `agent_job.status === 'cancelling'`，是则 graceful shutdown。 | `apps/web/src/app/api/agent/job/[jobId]/cancel/route.ts`（新）+ `apps/agent-worker/src/index.ts` poll |
| A3 | **`AgentExecutionContext` 扩**：`actualIterations / promptTokens / completionTokens / retries[]`。Phase 5 maintenance dashboard / AgentTimeline 直接消费。 | `packages/ai-runtime/src/provenance-writer.ts` schema + `packages/schema/src/contribution.ts` |
| A4 | **`AgentTimeline.tsx`**：消费 `agent_job_event` + `parent_job_id` 渲染父子树，每节点点开看 promptHash + toolCalls + scratchpad。 | `apps/web/src/app/(app)/editor/[docId]/components/AgentTimeline.tsx`（新） |

**dogfood gate**：coordinator 真跑 5 步 multi-agent，A4 timeline 视图能看到完整 dispatch 树 + 中途 cancel 一个 step 真 graceful 终止 + 超 quota 拒新 invoke。

---

### Wave B · 5 年差异化锚点 — Claim-on-Claim Review（W3-W6）

> Phase 5 唯一新功能。Reviewer 不是新角色，是 annotation on claim 的 ORCID-signed provenance lineage。

| ID | 任务 |
|---|---|
| B1 | **schema**：`claim_review` 表（PK + claim_id + reviewer_principal_id + verdict {endorses/challenges/refines} + evidence_refs[] + orcid_signed_at + provenance_id） + migration 0012 |
| B2 | **PM mark**：`claim-review-anchor` mark + 渲染层显示 reviewer ORCID + verdict 颜色（reviewer 视图 / 作者视图 / 公共视图三档） |
| B3 | **API**：`POST /api/claim/<id>/review`（capability `claim.review:create`）+ `GET /api/claim/<id>/reviews`（capability `claim.review:read` 默认 commenter+ 持有） |
| B4 | **maintenance scan 第 7 类 finding**：`unverified-claim`（claim 无任何 endorsing review > 30 天 + provenance.actorKind 全是 agent）|
| B5 | **dashboard / Reviewer Inbox**：reviewer 看到所有"open for review"的 claim 列表 + 一键发表 verdict + 自动 ORCID-sign |
| B6 | **可验证 review 图**：每个 claim 暴露 `/api/claim/<id>/lineage` 返回 review DAG（含 ORCID + signed-at + evidence-chain） |

**dogfood gate**：1 篇双语论文（10 个 claim）邀请 5 位真 ORCID reviewer，每人发表 ≥ 3 verdict + 1 challenge with counter-evidence；公共视图渲染 review DAG 无错。

**ADR**：ADR-0015 ORCID 从 Proposed → **Accepted**；新增 ADR-0016 Claim-on-Claim Review（**新 ADR moratorium 在 Wave B 落地后解除**）。

---

### Wave C · 元 dogfood（W7-W8）

> Council blind spot：第一个 100 用户从哪来。

| ID | 任务 |
|---|---|
| C1 | **把 `plan0/` + `landscape.md` + `ADR-INDEX.md` 用 collaborationtool 写一遍**（项目所有者亲自）。卡点全部进 issue + Phase 6 backlog。 |
| C2 | **demo paper：双语 500 字综述**（claim + evidence + 1 figure + 2 review verdict + ORCID 签名）发布到 `apps/web/public/demo/desci-review-pilot.{json,md,pdf}` —— 营销资产 |
| C3 | **学术社区路径**：清华 / 中科院 / Berkeley DeSci / Pluto.jl 各 1 位 alpha tester 邀请，2 周内 1 篇真 paper 写在 collaborationtool |
| C4 | **landing page**：4 段 vs Curvenote/MyST/Quarto/Notion 叙事（产品报告 §2）+ specimen Typst PDF 截图 + AgentTimeline 截图 + claim review DAG 截图 |

**dogfood gate**：≥ 1 篇真 paper 在 Phase 5 内 ship 出去（投预印本 / 投期刊 / 内部组会），全程不开侧边栏，全程 ORCID-signed review。

---

### Wave D · Phase 5 closeout（W9-W10）

| ID | 任务 |
|---|---|
| D1 | STATUS.md Phase 5 closeout：dogfood 矩阵（A/B/C 全 PASS）+ 5 年差异化锚点验收 |
| D2 | ADR-0011 review log Phase 5（claim-on-claim review 落地）|
| D3 | Phase 6 plan stub 起草（开放问题：reputation score / 跨设备 storage adapter / Loro 切换 / spatial canvas dogfood-trigger）|

---

## 四、砍 / 推 Phase 6+

| 砍 / 推项 | 来源 | 理由 | 复活条件 |
|---|---|---|---|
| **章节 fork-merge UI** | 原 W7 | Manubot 早做了，差异化价值低；ADR-0009 prosemirror-changeset 是单 Y.Doc 内 rebase，跨 subdoc 无实证 | dogfood 出现"我必须 fork 章节"用例 ≥ 3 次 |
| **Spatial canvas spike** | 原 W8 | system prompt §观测信号警告"无差异化锚点前别碰"；paperSchema 没预留 spatial-position mark | dogfood 出现"我把段落拉到画布"用例 ≥ 5 次 |
| **跨设备同步 + 用户挂 storage backend** | 原 W9 | y-sweet `BodyBackend` 是单后端抽象；用户 storage adapter 是 plugin 化未起 ADR | 真用户 pull request 自家 storage adapter |
| **Loro 1.0 / Automerge 3 切换评估** | 原 W10 | 没 doc-store 评估即妄言；Phase 4 W7.1 doc-store 落地后才能真评估 | doc-store 跑稳 6+ 周 + Yjs 实测 50+ 协作者性能塌方 |
| **Plugin marketplace** | Phase 4 §一 | shadcn registry 模式即可，不重蹈 Notion Integrations 弱平台 | 第三方 plugin ≥ 10 个 + 用户主动要求 |
| **Reviewer 多 prompt 模板扩展** | 推迟产品方向 | chocolate-covered broccoli；先把 1 个 reviewer dogfood 通过 | 现有 reviewer 真跑 ≥ 10 篇论文 |
| **新 ADR moratorium** | Council Minimalist | 15 个 ADR + 3 处诚实度赤字；先 promote 0012/0013/0014 真 Accepted 再起草新的 | Phase 5 Wave A/B 全 PASS |

---

## 五、ADR 影响表

| ADR | 当前状态 | Phase 4 W6-W10 操作 | Phase 5 操作 |
|---|---|---|---|
| 0001 | Accepted | §7 review log: doc-store 抽象迟到 + 落地（W7.1） | — |
| 0002 | Accepted | §8 review log: bulk insert 阈值（W7.3） | — |
| 0008 | Accepted (caveat) | §122 review log: dogfood gate 跑通（W9 W3） | §122/§93 review log: quota enforce + cancel API（A1/A2） |
| 0011 | Accepted | §7 review log: AgentPanel inline rewrite（W6.1）+ pgboss dogfood（W9 W4） | §7 review log: claim-on-claim review + 第 7 类 finding（B1-B6） |
| 0012 | Proposed | §6 review log: macOS 决策（W8.1）+ bwrap dogfood（W9 W1）→ **Accepted**（W10.1）| — |
| 0013 | Proposed | §3 review log: plugin contract provider 切换（W7.2）+ 4 endpoint dogfood（W9 W2）→ **Accepted**（W10.1）| — |
| 0014 | Proposed | §5 review log: dual-write owner = snapshot-worker（W9 W5-W6）→ **Accepted**（W10.1） | — |
| 0015 | Proposed | §3 review log: ORCID 真 OAuth dogfood（W8.2）| **Accepted**（B1-B6 落地后） |
| 0016 | — | — | **新建**：Claim-on-Claim Review（B 落地后起草）|

---

## 六、STATUS.md 更新点

每周 commit landed 时同步：

- 第 0 行"最后更新"：日期 + 当前 wave
- §1 当前阶段：Phase 4 W6 / W7 / W8 / W9 / W10 推进
- §2 ADR 状态表：0012 / 0013 / 0014 promote 时切 Accepted
- §3-§5（特性 / schema / 包列表）：W7.1 doc-store 落地、W7.2 plugin contract 切换、W6.1 AgentPanel 拆门、Phase 5 Wave A/B/C 启动均要更新
- §7 已知工作项：从原 12 项改为 Council 5 大约定（在 commit 时打勾）

---

## 七、验收门 / Definition of Done

**Phase 4 W6-W10 整体 closeout 通过条件**：

1. ✅ W6 用户 30 分钟 dogfood "0 次打开侧边栏"完整跑通
2. ✅ W7 doc-store 收口 + plugin contract `provider` 切换 + bulk insert + provenance batch 全 PASS
3. ✅ W8 macOS 决策落定（真写 OR UI 拦截二选一无 silent fallback）+ ORCID 真 OAuth + plugin install URL/paste 双轨
4. ✅ W9 5 道 dogfood gate（W1 bwrap / W2 4 endpoint / W3 multi-agent / W4 maintenance / W5-W6 stress + cross-doc）全 PASS
5. ✅ W10 ADR-0012/0013/0014 promote Accepted + README 改写 + landscape 9×4 矩阵 + onboarding demo doc + globals.css editorial token v1

**Phase 5 Milestone 通过条件**：

1. ✅ Wave A：quota enforcer + cancel API + AgentTimeline 全 dogfood
2. ✅ Wave B：1 篇 10-claim 论文走完 5 reviewer × ORCID-signed verdict + review DAG 公共视图
3. ✅ Wave C：≥ 1 篇真 paper 写在 collaborationtool 内 ship 出去
4. ✅ Wave D：ADR promote + Phase 6 plan stub

---

## 八、风险与未答问题

1. **Phase 4 W6-W10 工程量**：W6 + W7 是 8-10 工作日 + W8 3-7 + W9 dogfood gate（依赖外部 host / API key / 真用户）2-3 周 + W10 1 周 = 整体 5-7 周。**风险**：Wave A/B/C 可能不得不并行起跑而非串行。
2. **macOS sandbox 二选一**：W8.1 真写 sandbox-exec 是 3-4 天但风险（macOS sandbox-exec 文档残缺）。**建议**：W6-W7 期间项目所有者评估，W8 进入前确定走 (a) 或 (b)。
3. **ORCID 真集成依赖**：better-auth ORCID provider 需要确认是否官方支持 OR 需要自写 OAuth 适配器。
4. **claim-on-claim review schema**：Wave B B1 schema 是新增不是改，但 PM mark `claim-review-anchor` 跨 subdocument 引用 → 撞上 W9 dual-write 决策（已经在 W9 答），相互依赖。
5. **元 dogfood 时间窗**：Wave C C3 4 位 alpha tester 招募 → Phase 5 W7-W8 → 学术社区周期慢，可能跨 Phase 6 边界。**建议**：Phase 5 W3 启动招募并行。

---

## 九、立刻动作（项目所有者 kickoff 前的待办）

- [ ] 评审本计划 + 调整范围（删 / 加 / 顺序）
- [ ] 确认 macOS sandbox 决策路径（W8.1 (a) 或 (b)）
- [ ] 确认 ORCID 集成方案（better-auth 官方 OR 自写）
- [ ] 决定 Wave A/B/C 串行 vs 并行（取决 Wave A bandwidth）
- [ ] STATUS.md §8 公开问题段加入"元 dogfood 启动时机"
- [ ] 起草 ADR-0016 Claim-on-Claim Review 草稿（在 Wave B 启动前 1 周内）

---

## 十、产物清单

- 本文件：`plan0/improvement-plan-2026-05.md`（**Proposed**，待项目所有者评审）
- Council 评审：`.brainstorm/COUNCIL.md`
- 5 份 role 证据：`.brainstorm/role-{product,architecture,user,ai,design}.md`
- 设计 SoT：`plan0/Design.md`（2026-05-11 v1，Claude Design 9-surface 落地）+ `plan0/claude-design-brief.md`

---

## 十一、Design.md 对齐（2026-05-11 增订）

> `plan0/Design.md` 是设计 SoT；本节列出 W8-W10 与 Phase 5 受其影响的调整。

### 11.1 已交付 commit 的回审（W6 阶段交付物 vs Design.md reject criteria）

| Commit | 任务 | Design.md 风险点 | 处理 |
|---|---|---|---|
| `fd6fa1b` W6.5 | ShareDialog amber/emerald 双 banner | reject #5 rainbow status pill —— amber-50 / emerald-100 / red-50 全用 → ban | W10 design audit 改为 status pill 风格（999px radius，1px 同色边 accent-ink/ox/moss，无填充） |
| `824617d` W6.2 | doc 3 模板 | reject #4 emoji icon —— 自查模板 JSON 无 emoji | 通过；JSON 内是 specimen 自身内容 |
| `633b1c8` landing/i18n/theme | LocaleToggle / ThemeToggle | §14 v1 不做 dark；§13 reject criteria #10 dark mode 用 slate ban | 保留 ThemeToggle 基础设施（cookie + FOUC script + `.dark` class），dark token 留 v2 warm-deep；当前 dark 渲染仍走 light tokens 不破坏视觉 |
| `633b1c8` landing/i18n/theme | maintenance / settings dark variant amber/red 改 | 同 reject #5 → 已迁移到 hairline list，需对齐 status pill | W10 design audit 中复核 |
| `d654040` Design.md + 4 surface refactor | Landing / docs list / chrome / docs/new | Phase 1 必做 4 项已 ✅ | 保留；W10 verify |

### 11.2 W8 调整

- **W8.3 plugin install URL/paste 双轨**：UI 使用 Design.md §5.4 Provenance card 风格（paper bg + 1.5px hairline + 3 节布局），不用 Tailwind 默认 card。capability prompt 列表 → hairline list（§5.8）
- **W8.2 ORCID 集成 UI**：Login / Signup 走 Design.md §6.5 single column 400px + 右侧 specimen quote + ORCID CTA primary（accent-ink）+ email/password 折叠次级；现有 OrcidSignIn 组件需要重 styling

### 11.3 W10 新增子项

| ID | 任务 |
|---|---|
| **W10.7** | **Design.md 9-surface compliance audit**：逐 surface 跑 reject criteria #1-#13 验收。已交付 4 surface（Landing / docs list / chrome / docs/new）verify；新增审计 5 surface：Editor / Maintenance / Settings(+models +plugins) / orgs/new / invite/[id] |
| **W10.8** | **`apps/web/src/components/design/` token-driven 组件库**：Button / Mono-disc / Status pill / Provenance card / Citation popover / Block hover-rail / Margin marginalia entry / Hairline rule —— 8 个 SoT 组件，散落硬编码全清 |
| **W10.9** | **Provenance reveal delight 动效**（Design.md §9）：3 状态（idle → click halo → unfolded card）180ms cubic-bezier；这是唯一被钦定的动效。Phase 5 Wave A AgentTimeline 之前必须落 |
| **W10.10** | **Phosphor `bold` 1.4px stroke icon 系统**（替代 emoji / 纯字符 / heroicons-outline）——评估 `phosphor-react` 包尺寸；不引则自家 SVG 子集 |

### 11.4 Phase 5 调整

- **Wave A AgentTimeline**：必须遵守 Design.md §5.2 Mono-disc + §8 quota + interrupt button + propose/apply 二元状态；不要 chat bubble drawer
- **Wave B Claim-on-Claim Review**：UI 落 Design.md §5.7 marginalia entry（`border-left: 2px solid var(--accent-*)` + caption-cap accent-color actor + 时间）；reviewer verdict 走 status pill（accent-ox endorses / accent-ink challenges / accent-moss refines）；ORCID 签名展示用 Provenance card §5.4
- **Wave C 元 dogfood**：landing 4 段叙事按 Design.md §6.3 12-col 1.1fr 0.9fr hero + 4 段 hairline 内联格式；不要 marketing animation / hero gradient

### 11.5 reject criteria 进 commit gate

每次提交动 `apps/web/src/` 时 **commit 前自查 Design.md §11 reject criteria 13 条**（grep `bg-blue` `rounded-(lg|xl|2xl)` `bg-zinc-(50|100|200)` `shadow-(sm|md|lg|xl)` 命中数），新增不能为正。

### 11.6 不再起 ADR-0017 设计系统

Design.md 自身是设计 SoT，无需新 ADR（遵守 §三新 ADR moratorium）。设计修订改本文件 §16 修订表。如未来重大改版（v2 dark / 大幅 type ramp 改）再起 ADR-0017。
- 待新建：ADR-0016 草稿（Wave B kickoff 前 1 周）

---

## 十二、Night-Bridge-Day Pivot（Iteration 4，2026-05-12 增订）

### 12.1 起因 — 5 次方向反思的演进

`/Users/jili/.claude/plans/night-science-day-science-snoopy-widget.md` 记录了从 turn 1 到 turn 16 的 4 次方向迭代：

| Iter | 框架 | 否决 / 通过 |
|---|---|---|
| 1 | "协作论文平台 + AI 增强" | 否决（commodity 红海） |
| 2 | "Night Science Pivot — 补 thought_fragment schema 到 day-science 框架" | 否决（仍从论文反推） |
| 3 | "Scientific Discovery System — question-centric + Frame A/C/D" | 部分通过，但**缺 Bridge 层** |
| **4** | **"Night-Bridge-Day Triadic Architecture — 三层等价产出系统"** | **通过 → ADR-0020 Proposed** |

Iteration 4 整合了 jili 在 `/Users/jili/project/nightscience/` 累积的 2021 行自有 night-science 文档（5 创意模式 + 93 同构概念 + 6 交互模式 + 四层架构 + 7 大原则），其框架比 Yanai-Lercher 三篇文献系统化得多。

### 12.2 核心 shift —— **三产出等价，不是 night/bridge 服务 day**

```
Night（生成/发散）   →  Bridge（转化/桥接）  →  Day（验证/收敛）
草图/隐喻/反例/         概念验证/设计虚构/      论文/代码/政策/
思想实验/矛盾/问题     技术预印本/类比论证       法律/诊疗方案
```

**Invariant**：三层产出**等价**——同样的 attribution、archive、citation、metric exposure。**不是** "Night/Bridge 服务 Day"。

**关键 take（来自 Iteration 4 plan §G.10）**：
> jili 不是优化日科学，是建**平行/等价/互补**的三产出系统。从"夜科学是日科学前置"→"三产出等价"——从文明的等级制到文明的分工制。

### 12.3 5 维度新增（vs Iteration 1-3）

1. **Bridge 层 first-class**（Iteration 3 缺）—— 新增 `packages/bridge-layer/`，含 concept-prototype / design-fiction / hypothesis-formalization / analogy-mapping
2. **5 创意触发模式作 schema tags**（不是 workflow）—— `mode:metaphor` / `:contradiction` / `:reframe` / `:cross-domain` / `:thought-experiment`
3. **6 种交互流双向 contract** —— hypothesis-output / anomaly-input / constraint-transfer / metaphor-bridge / question-return / method-transfer
4. **4 角色分化** —— Explorer / Bridge-builder / Validator / Connector（各 default surface）
5. **contribution-graph attribution**（反 priority race，per Council Merton modification）—— 三层产出各自跨多 contributor 平等 attribution

### 12.4 与 §四 砍 / 推清单的关系

**复活的（以 Night/Bridge 为名）**：
- Spatial canvas（原砍）→ 复活作 `apps/web/src/app/triadic/` 中的 thought-DAG view（Phase 6 W1+）
- ADR-0014 subdocument-level ACL（Proposed 状态）→ 重新定位为三层 artifact 的 cross-layer visibility tiers

**仍砍的**：
- 章节 fork-merge UI 完整实现（与 Night artifact lineage 重叠）
- Loro 切换评估（Yjs 已 sufficient for 三层协作）
- 跨设备 storage adapter（client-first 已覆盖）
- Plugin marketplace（core 4 角色 plugin 已 sufficient）

### 12.5 与 §五 ADR 影响表的扩充

新增 ADR-0020 行 + 既有 ADR review log 追加：

| ADR | Iteration 4 影响 |
|---|---|
| **ADR-0020（新，Proposed）** | "Night-Bridge-Day Triadic Architecture" 战略 ADR，Phase 5 W3+ 横跨 Phase 5/6 |
| ADR-0001 | Phase 5 W3+ 加 Night/Bridge data models（PM tree 之外新增 discovery-graph + bridge-layer） |
| ADR-0002 | 4 角色映射 5 role bundle + 新 capability vocabulary（`night.artifact.*` / `bridge.artifact.*`） |
| ADR-0008 | Coordinator 从 "goal-driven multi-step" 改为 "双向 6 交互流 metabolic orchestrator" |
| ADR-0010 | 5 创意模式作 plugin tag taxonomy（不是 hardcoded enum） |
| ADR-0011 | Claim/Evidence 保留作 Day 层 atomic units；Night/Bridge 层有各自 atomic unit 集 |
| ADR-0014 | subdoc-level 不变；新增 cross-layer reference |
| ADR-0015 | Day 层不变；Night/Bridge artifacts 加 ORCID-signed contribution-graph |
| ADR-0016 | Day 层 review 机制不变；Night/Bridge 层有更轻量 review/endorsement |
| ADR-0017/0018/0019 | 仍预留 client-first pivot 子 ADR（per memory `client_first_pivot_2026_05.md`） |

### 12.6 ADR moratorium 例外声明

§三 ADR moratorium 明确：
> "ADR-0012/0013/0014 dogfood gate 跑通并 promote 到 Accepted 之前，不再起草新 ADR"

**ADR-0020 是例外**——理由：
- ADR-0020 是**战略性 ADR**，不是 feature ADR
- moratorium 针对 feature ADR（避免承诺爆炸）
- 战略性 ADR 是 moratorium 的**前提**（没有方向就没有 feature ADR 的 prior art 基础）
- 后续 feature ADR（ADR-0021 discovery-graph schema / ADR-0022 bridge-layer schema / ADR-0023 triadic UI surface / ADR-0024 谜题分类 reflection）按 ADR-0020 框架展开，仍受 moratorium 约束（W12 dogfood gate 后才能起）

### 12.7 与 client-first pivot 合并叙事

Iteration 2 用户已选 Q2=A "合并叙事"。Iteration 4 保留：

```
                    Night-Bridge-Day Triadic Architecture
                                  ▲
              ┌───────────────────┼───────────────────┐
              │ 手段（client-first）              │ 目的（Triadic 三层等价）
              │ local-first storage              │ Night / Bridge / Day artifacts
              │ 私密 by default                  │ 5 创意模式 / 6 交互流
              │ selective publish                │ 4 角色分化
              │ Yjs CRDT 协作                    │ contribution-graph attribution
              └───────────────────┬───────────────────┘
                                  ▼
                            选择性导出
                                  ▼
                       Day 层 manuscript（论文）
```

### 12.8 Wave D-1 ~ D-5 路线（Phase 5 W3-W12，按 ADR-0020 §2.7）

| Wave | Week | 内容 |
|---|---|---|
| Pre-D | W3 | ADR-0020 Proposed + 本章节 + STATUS §1 修订 + system-prompt 第一性原理增补 |
| **D-1** | W4-W5 | `packages/discovery-graph/` schema scaffold + 6 Night atomic units 单测 |
| **D-2** | W6-W7 | `packages/bridge-layer/` schema scaffold + 4 Bridge atomic units 单测 |
| **D-3** | W8 | 6 交互流 reference edges + provenance writer 扩展 |
| **D-4** | W9-W10 | `apps/web/src/app/triadic/` UI skeleton（三层 surface 等价 prominent） |
| **D-5** | W11-W12 | jili 自 dogfood 30 天 + retrospective + ADR-0020 Proposed → Accepted |

### 12.9 9 个 dogfood gate（Phase 5 W12 验收）

加到 §七 既有 9 gate 之外的 Iteration 4 特定 gate：

- ☐ G-T1：jili 30 天内产生 ≥ 50 Night artifact（含 ≥ 10 metaphor / ≥ 10 contradiction / ≥ 10 question）
- ☐ G-T2：jili 30 天内产生 ≥ 10 Bridge artifact（含 ≥ 3 concept-prototype / ≥ 3 design-fiction）
- ☐ G-T3：jili 30 天内产生 ≥ 3 Day artifact（promotion from Bridge）
- ☐ G-T4：6 交互流至少触发 4 种（不要求全 6 种，避免 forced symmetry）
- ☐ G-T5：jili 在 30 天内切换 ≥ 2 角色（验证 4 角色分化真有用）
- ☐ G-T6：contribution-graph 含 ≥ 2 contributor 的 artifact ≥ 10 个（验证非个人独享）
- ☐ G-T7：Phase 4 已 landed 的 Wave B5/B6/C2/C4（claim/review/specimen）无 regression
- ☐ G-T8：Phase 5 Wave A quota-enforcer (P0) 未被 pivot 推后
- ☐ G-T9：5 创意模式 tag 在 50 Night artifact 中分布 ≥ 4 个模式（不能全集中在 1 个）

### 12.10 风险与未决问题

| # | 风险 | 缓解 |
|---|---|---|
| R-T1 | 复杂度（3 层 × 5 模式 × 6 交互 × 4 角色 = 360 概念交叉）| 5 Wave 渐进；onboarding 走 4 角色路径，每角色只暴露 1/3 概念 |
| R-T2 | jili 5 个 night-science 文件未通读全文（87KB Night.md / 75KB Cases_Expanded 未读）| W6 dogfood gate 前通读，必要时修订 ADR-0020 review log |
| R-T3 | citation 改变不被现有学术系统识别 | 保留传统论文 export 为 "机构对接 adapter" |
| R-T4 | Bridge 层概念新颖被误解为过渡层 | UI 用 `/translate` surface 显式承载；examples gallery 突出 Bridge artifact |
| R-T5 | AI 自动 tag mode vs 手动—— ADR-0020 Open Q11 | W6 dogfood gate 后决定 |
| R-T6 | 4 角色分化形成 silo | Connector 角色 + 6 交互流自动 surface cross-role matching |

**未决问题**：
- Q-T1：4 角色 onboarding 强制选择 vs 软性默认全角色？
- Q-T2：等价产出在 UI 如何体现"等价"？（同等 prominent / 同等 search rank / 同等 metric？）
- Q-T3：5 创意模式 tag 数量上限？防滥用阈值？

### 12.11 立即动作（W3 起，per §九 风格）

1. ✅ ADR-0020 Proposed 已 ship（`plan0/adr/0020-night-bridge-day-triadic-architecture.md`）
2. ✅ 本章节（§十二）已 ship
3. ⏳ STATUS.md §1 当前阶段 + 叙事行修订（同会话）
4. ⏳ paper-platform-system-prompt.md 第一性原理 #12 #13 加 + #1 #3 修订（同会话）
5. ⏳ CLAUDE.md §3 仓库地图加 `packages/discovery-graph/` `packages/bridge-layer/` 位置（下次会话）
6. ⏳ Wave D-1 schema scaffold（Phase 5 W4 kickoff）
7. ⏳ jili 通读 5 个 night-science 大文件（W6 dogfood gate 前）

### 12.12 Stop conditions

- ⚠️ Phase 5 Wave A quota-enforcer (P0) 因 Iteration 4 被 delayed > 2 周 → 立即冻结 Wave D
- ⚠️ jili dogfood 30 天后 Night artifact < 10 → 回滚 Triadic，回退到 Iteration 3 question-centric
- ⚠️ Bridge 层 dogfood < 2 artifact/week 持续 4 周 → 回退到 Iteration 3
- ⚠️ Phase 4 已 landed Wave B5/B6/C2/C4 regression → pivot 实施破坏沉没成本，紧急 rollback
