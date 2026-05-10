# 架构演化性评审 · collaborationtool（Phase 4 W5 进行中）

> Staff-level 视角，**找雷比夸优点重要 10 倍**。所有引用对得上 ADR# / 文件路径。

---

## 1. 架构亮点（真护城河，应该强化）

**A1. ADR-0011 一等知识对象层 + 5 SQL-pure scanner**
`packages/schema/src/`（claim/evidence/contribution/provenance 早 Phase 0 就 8 实体齐备），Phase 4 W4 `apps/agent-worker/` 6 finding kind 里 5 个**纯 SQL EXISTS / NOT EXISTS / GROUP BY**——意味着 maintenance scan 横向扩到 Phase 5 时**不依赖 LLM token / embedding 服务可用性**，dogfood 离线也能跑。这是少见的"先把廉价确定性能力做穿"再考虑 vector 的克制。强化路径：保持 `scanForFindings` 默认 5 SQL-pure，broken-citation 注入式 `DoiResolver` opt-in 模式延伸到所有未来 network-bound finding。

**A2. ADR-0002 capability + Principal kind=agent 的同位**
Agent 拿 principal-kind=agent 跑、capability_grant 带 expiresAt + resourceType=block——意味着 Phase 5 加新 actor（reviewer-bot / RAG-agent / git-bot）零 schema 改动，只多一行 principal + 一组 grant。`packages/permissions/roles.ts` 的 5 个 default bundle 是**冻结的 Capability[]**，TS 类型保证编译期校验。

**A3. ADR-0005 Render API 5 emitter + PM JSON wire format**
`packages/render-{myst,typst}/`+ paperSchema 锁定 PM JSON 作 single source；emitter 是纯函数。Phase 5 加 LaTeX / DOCX / EPUB emitter 是新文件而非改 core——这是真扛得住 fork-merge 的边界。

**A4. ADR-0006/0010 plugin / MCP 双轨 + skill 元数据**
Phase 2 W3 dogfood gate 已经把"plugin 路径正确 / 第三方 tmpdir / no internal-only API" 三件事跑过；hardcode `agents/citation.ts` 已经全删（STATUS §2 ADR-0010 行）。这意味着核心和扩展边界**真在 git 里被强制过**，不是文档承诺。

**A5. Migration idempotency + monotonic numbering**
0001-0011 严格顺序、`_drizzle_migrations` 表保 idempotent、CLAUDE.md §8 写明"不可改历史"——Phase 5 多 host fleet 升级仍然安全。

---

## 2. 架构债务（隐藏雷，选错会重写）

### 🔴 D1. ADR-0001 §5.D 承诺的 `packages/doc-store` 抽象 **从未存在**
ADR-0001 §5.D 字面写"Phase 1 用 Yjs，但 `packages/doc-store` 抽象一层接口让 Phase 4 切到 Loro / Automerge 3 是 1-2 周迁移"。我 `ls packages/`：**没有 doc-store**。`y-prosemirror`、`y-sweet`、`Y.Doc`、`Y.Map("crossRefs")` 直接散在 editor-core / sync-gateway / snapshot-worker / ADR-0014 里。
**后果**：Phase 4 W10 "Loro 1.0 / Automerge 3 切换评估"**没有迁移脚手架**。承诺的 1-2 周实际是 6-8 周（要切 awareness 协议 + persistence layer + ProseMirror binding + subdocument API）。**这是 ADR 写得很美但代码偷工减料的典型**。
**建议**：本周开 `packages/doc-store/` + `DocStore.getDocument(id) → DocumentHandle` 接口，把 editor-core / snapshot-worker 的 `Y.Doc` 引用全收口，否则 ADR-0014 落地后 Y.Map crossRefs 也要进 doc-store —— 越晚越贵。

### 🔴 D2. ADR-0013 ModelProvider 抽象**只盖在 host 上，没穿透到 plugin contract**
`packages/ai-runtime/src/plugins/types.ts:218` 仍是 `anthropic: Anthropic | null`；5 个 plugin（citation/coordinator/inline-editor/researcher/reviewer）的 agent.ts 都 `if (input.anthropic) { client: input.anthropic }`。`plugin-host.ts:148` 把 `input.anthropic` 透传。
**ADR-0013 §2.5 明文说**：`AgentPluginInput.anthropic` → `AgentPluginInput.provider`。**没做**。
**后果**：Phase 4 W2 dogfood gate 跑 vLLM / Ollama 时，5 个内置 plugin **全部走 mock 分支**（因为 `input.anthropic` null）。settings UI + resolver 是漂亮的"半交付"——真接 OpenAI-compat endpoint 时 plugin 内部还是 Anthropic SDK shape。第三方 plugin 作者以这个 contract 写代码 → Phase 5 切 provider 全员 break。
**建议**：W2 dogfood gate 之前必须改 `AgentPluginInput.anthropic` → `AgentPluginInput.provider: ModelProvider`，5 个 plugin 各 ~30 行迁移。**否则 ADR-0013 promote Accepted 是假象**。

### 🔴 D3. Plugin sandbox 跨平台**只有 Linux 真路径**
`packages/ai-runtime/src/plugins/install.ts:217-227`：macOS 返回字符串 `'(version 1)\n(deny default)\n; Phase 5 W1 implements'`；Windows 返回 SID 名字串。**两个都没 spawn 路径**。13 单元测试只测"placeholder 字符串生成对了"。
**后果**：(a) self-host 用户多数是 macOS / Windows 个人研究者，**装不了第三方 plugin**（admin override `unsafe_user_install` 是绕过沙箱）；(b) ADR-0012 §6.2 写 macOS / Windows "推 Phase 4"——已被推到 Phase 5；(c) Phase 4 W1 dogfood gate 限 Linux host，真用户测试面缩到运维 ≤ 5%。
**建议**：要么 ADR-0012 review log 显式承认"非 Linux 用户 Phase 4 不能装第三方 plugin"并 UI 拦截（不是只显示 placeholder），要么本 phase 把 macOS sandbox-exec profile DSL 真写出来（Apple 文档全在，2-3 天工程量）。**现状是诚实度问题**。

### 🟠 D4. Capability 模型在"100 人开放评审"会爆炸
ADR-0002 §3 demo "50 人 ORCID-verified open-reviewer"：`capability_grant 50 × N rows`（N = bundle size，paper-reviewer 16 caps → 800 rows）。Phase 4 W8 真上 ORCID + open peer review，加 ADR-0014 subdoc-level grant（每个 reviewer × 每个 subdoc × N caps）= **50 reviewer × 50 subdoc × 16 caps = 40,000 rows / paper**。`document_acl` materialised view 每次 grant 重写。
现在 `packages/permissions/acl-loader.ts` `materialiseRoleBundle` 没批量插入路径，逐行 INSERT。
**后果**：Phase 4 W8 dogfood gate 50 reviewer 邀请单次操作可能 30s+；revoke 时连接级 broadcast 的"主动断开"在 100+ WS conn 时也会风暴。
**建议**：`acl-loader.ts` 加 `materialiseRoleBundleBulk(rows[])` 单次 multi-row INSERT；`expiresAt` 改 60s 心跳重检（ADR-0002 §4 已写"对策"但代码没落）。Phase 4 W8 ADR-0015 review log 必须写 stress test 阈值。

### 🟠 D5. ADR-0014 `crossref_index` dual-write 是个**未答**的开放问题
ADR-0014 §5 明白写"crossRefs Y.Map vs PG 主存：倾向 Y.Map 主 + crossref_index PG 表后台增量同步（dual write 但 Y.Map 仲裁）"。**待答**。Migration 0011 落了 PG 表，但 `editor-core/src/subdocument/` 只加了纯 PM JSON walker（detect / extract），**没有 dual-write 实现**。
**后果**：W5-W6 dogfood "cross-doc reference 真同步"那一刻撞上：(1) 谁负责把 Y.Map.observe 转 PG INSERT？sync-gateway 还是 snapshot-worker？(2) 一致性窗口（Y.Map 改完到 PG 反映）在 maintenance scan 跨 subdoc broken-citation 检查时是 false negative 风险。
**建议**：W5-W6 dogfood 之前必须答这两个问题。**snapshot-worker** 是更合理的 owner（已经做 Y.Doc 增量持久化）。在 ADR-0014 §7 review log 里 commit before 真 multi-subdoc 挂载。

### 🟠 D6. Provenance writer 单点 但**没有批量 / queue 路径**
`packages/ai-runtime/src/provenance-writer.ts` 4 个写函数（persist / accept / reject / supersede）都包在 `runInTransaction` 里——意味着每个 reviewer agent job 产 10-20 条 contribution 是**10-20 次独立 transaction**。ADR-0008 §2.2 也提"reviewer 一次跑可能让单 doc provenance 行数翻倍"。
**后果**：Phase 4 W3 coordinator 真 LLM dispatch loop 跑通后，单个"把这一节改投 Nature 风格"goal 触发 dispatcher → reviewer × N → researcher × M，可能产 50+ provenance 写。每写一次走 5 SQL（select revision + select original + insert provenance + insert revision + update approval chain）= 250+ SQL / goal。
**建议**：(a) `persistProposalBatch(inputs[])` 单 transaction 多 INSERT；(b) coordinator dispatch loop 每 step 累积 contribution buffer，step 结束 flush。**不会成 bottleneck 的前提是有 batch 接口**——现状没有。

### 🟡 D7. ADR-0008 reviewer agent quota / interrupt **schema 有，runtime 半空**
ADR-0008 §2.6 写 `quotaPerDay: 50` 在 agent 行；**没看见 enforce 代码**。CLAUDE.md §5.7 红线明确"任何 agent 自主行为都要有 quota + timeout + 可中断"。Phase 4 W3 真 LLM coordinator loop 上线（`packages/ai-runtime/src/coordinator/loop.ts:81` 默认 maxSteps=6）只防住步数没防住成本。
**建议**：W3 dogfood gate 之前在 `apps/agent-worker/` 加 daily quota counter（PG row + Redis 不必，PG counter Phase 4 够），超 quota 拒新 job。中断路径需要 `agent_job.status='cancelling'` + worker poll —— 现状只有 status 字段。

---

## 3. Phase 5+ 即将爆雷的位置

| 即将做的事 | 暴露当前抽象不足 |
|---|---|
| **Loro 1.0 / Automerge 3 切换评估**（W10） | D1：无 doc-store。真切要重写 editor-core / snapshot-worker / sync-gateway 三处 |
| **章节 fork-merge UI**（W7） | crossref_index dual-write（D5）+ subdoc-level rebase 跨 Y.Doc 边界——ADR-0009 prosemirror-changeset 是**单 Y.Doc 内** rebase，跨 subdoc 没实证 |
| **跨设备同步 + 用户挂 storage**（W9） | y-sweet `BodyBackend` 抽象是**单后端**；用户写自己 adapter 需要 plugin 化（ADR-0011 长期债"用户 storage" 没落 ADR） |
| **Spatial canvas spike**（W8） | 当前 PM 节点都是文字流；canvas 是异构内容图的另一坐标系，paperSchema 没预留 `spatial-position` mark / extension |
| **Inline computation cell**（ADR-0007 caveat）| 真 molab.org iframe e2e 推迟到 Phase 2.5 → 没实证；cell auth-token JWT 已发但 `Figure.sourceCellId` 后没人写 round-trip 测 |
| **ORCID 真集成**（W8） | `apps/web` ORCID 测试 8 个但全 mock；better-auth org → Principal kind=org bridge 写过没测过真 OAuth 回跳 |

---

## 4. 强化建议（具体到文件）

1. **本周开 `packages/doc-store/`**——把 `Y.Doc` import 全收口；ADR-0001 §7 加 review log "doc-store 抽象迟到，原因是 Phase 1 没做就拖到 Phase 4 W5"。否则 W10 Loro 评估只能写"撞上抽象债，推 Phase 5"。
2. **`packages/ai-runtime/src/plugins/types.ts:218` 改 `anthropic` → `provider: ModelProvider`**，5 plugin 跟改。这是 ADR-0013 promote Accepted 的硬前置。
3. **`packages/ai-runtime/src/plugins/install.ts:217` macOS profile 真写**（Apple 文档 `man sandbox-exec` + Bobby Holley 的 Firefox sandbox 参考）；要么 UI 在非 Linux 平台**显示拦截**而不是 silent fallback。ADR-0012 review log 写明哪个选项。
4. **`packages/permissions/acl-loader.ts` 加 `materialiseRoleBundleBulk`**——50+ reviewer 邀请单 SQL；ADR-0002 review log 加 "Phase 4 W8 stress 阈值"。
5. **`packages/ai-runtime/src/provenance-writer.ts` 加 `persistProposalBatch`**——coordinator loop step boundary flush；ADR-0008 §2 review log 写 "Phase 4 W3 dispatch loop 暴露写放大，加 batch"。
6. **ADR-0014 §5 "crossref_index dual-write owner" 在 W5-W6 dogfood 前答**——建议 snapshot-worker 走 Y.Doc observe → PG INSERT 增量；在 §7 review log 写 owner 决策。

---

## 结论

ADR 文档级架构非常成熟（15 ADR + index + 多次 review log），**但代码层有 3 处"诚实度赤字"**：doc-store 不存在（D1）、plugin contract 没切（D2）、跨平台 sandbox 是字符串占位（D3）。Phase 4 W2/W5/W10 三道 dogfood gate 通过前必须先把这 3 处堵上，否则 ADR-0001/0012/0013 promote 到 Accepted 是基于 ADR 文本而非代码现实。capability scale + provenance write amplification 是 P1 级运行时债，Phase 4 W3/W8 dogfood 时会先暴露。
