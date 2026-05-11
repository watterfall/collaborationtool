# Phase 5 启动 Trigger — 候选场景与反推

> 起草：2026-05-11（Phase 4.5 W0.4）
> 议会评议：`.codex-review/COUNCIL-2026-05-11.md` blind spot —
> "Phase 5 启动 trigger 是什么？" 没人问，所以"Phase 5 blocker"讨论悬空。
> 本文档解决这个 blind spot。
> 下一步：W2.1 把 5 候选收敛到 1（附"为什么不是其他 4"trade-off）。

---

## 0. 为什么需要 Trigger（不是 Roadmap）

Phase 0-4 的每个 phase 启动都是"上一 phase 收尾后自然推进"——按时间和上一 phase 交付物启动。
这个模式到 Phase 5 失效：

1. **改进计划 §四**（`improvement-plan-2026-05.md`）已经把多件"看起来 Phase 5 该做"的事砍 / 推到 Phase 6+：spatial canvas / 章节 fork-merge UI / Loro 切换评估 / 跨设备 storage adapter / plugin marketplace。如果按"上一 phase 自然推进"启动 Phase 5，没有任何具体 wave 可做。
2. **ADR moratorium**（CLAUDE.md §5.3）：在 ADR-0012 / 0013 / 0014 dogfood gate 跑通并 promote 之前不起新 ADR——Phase 5 没有 ADR 入口。
3. **codex review 2026-05-11**：标 P1 的 5 件（ADR-0001 doc-store yDoc / ADR-0008 quota / ADR-0012 sandbox macOS / ADR-0013 主路由 / ADR-0014 multi-subdoc）——议会 Strategist 指出 "P1 是否真 P1 取决于 Phase 5 wave A 是否用到该路径"。
4. **新 ADR-0016 Claim-on-Claim Review** 起草权限明文写"Phase 5 Wave B kickoff 前 1 周起草"——Wave B 是 Phase 5 内部节点，需要 Wave A 先启动；Wave A 需要 trigger 先定义。

⟹ Phase 5 必须由 **"第一个真实使用场景"** 触发，不是按时启动。
"真实使用场景" 的定义：**有具体用户 + 具体场景 + 验收信号**，trigger 落地后反推 P1 真子集。

---

## 1. 5 个候选 Trigger（按团队差异化重要性排序）

### Trigger A：双语论文协作（"bilingual paper writing"）

**用户**：1 对作者，一位中文母语 + 一位英语母语，合作写一篇跨学科论文（如 HCI × 教育 / NLP × 语言学）。
**典型工作流**：
1. 双语作者并发编辑 1 个 document（CJK 段落 + 拉丁段落混排）
2. 一方写 claim，另一方挂 evidence 节点 + verify citation chip（CrossRef MCP）
3. 一方用 inline-editor chip 改写另一方草稿
4. 导出 Typst PDF 双栏 / 双语 + JATS for submission

**验收信号**（落地后才算 trigger fired）：
- 2 位 real user 跑完 ≥ 1 篇 end-to-end（草稿 → review → submit）
- 双语作者 self-host 总耗时 ≤ 1 小时（codex 报告 §7 提的 30 min 目标暂调到 1h）
- Provenance 完整覆盖 AI 介入 + 双方编辑（grep `apps/web/src/app/api/agent/invoke` + commit serializer + revision accept/reject 路径 = 全部 actorPrincipalId 写）

**反推真 P1**（这个 trigger 启动后会卡住的）：
| codex P1 | 是否 blocker | 理由 |
|---|---|---|
| ADR-0001 doc-store yDoc removal | **Soft blocker** | 双语单文档不需要切 CRDT；但 doc-store API 偶尔泄漏 yDoc 会让 commit serializer + revision accept 路径心智复杂 |
| ADR-0008 quota / cancel | **Not blocker** | 2 user × 单文档 LLM 调用频次低，没有 runaway 风险 |
| ADR-0012 sandbox macOS / Windows | **Not blocker** | 双语作者多半 macOS——UI 拦截已兜底，不安装第三方 plugin |
| ADR-0013 ModelProvider 主路由 | **Blocker** | 一位作者用 Anthropic + 一位用 OpenAI 是真实场景；W0.3 已堵 |
| ADR-0014 multi-subdoc routing | **Not blocker** | 单文档场景不触发 subdoc |

**差异化锚点**：这是项目第一性原理 #4（CJK / 拉丁双语一等公民）的唯一直接验证场景。没有其他产品认真做 CJK + 拉丁混排排版。

---

### Trigger B：文献综述（"lit-review with claim/evidence map")

**用户**：1 位研究生 + 1 位导师，做一个领域 lit-review，目标产出综述论文。
**典型工作流**：
1. 学生用 researcher chip 找 evidence（PubMed / arXiv MCP — Phase 5 W1 才装）
2. 把 claim / counter-claim 标到 PM tree 节点
3. 导师用 reviewer chip 跑 maintenance scan：unverified-claim / contradicted-conclusion
4. 双方在 Evidence Map 视图（ADR-0011）上 review + merge

**验收信号**：
- 1 篇 lit-review 实跑端到端（≥ 30 篇引用，每篇有 claim+evidence link）
- maintenance scan 6 finding kind 全 real PASS（codex blind spot：当前 4/6 real，2 kind mock）
- reviewer/researcher 路径不再是 markDone stub（codex §3 第一指控）

**反推真 P1**：
| codex P1 | 是否 blocker | 理由 |
|---|---|---|
| ADR-0008 quota / cancel | **Blocker** | researcher chip 跑 30+ MCP 调用，没 quota = cost runaway；scan job long-horizon |
| ADR-0011 finding kind 全 real | **Blocker** | 6/6 finding kind real 是 maintenance dashboard 的硬话 |
| ADR-0013 ModelProvider | **Soft blocker** | 学生 BYO 模型，但 W0.3 已堵 |
| ADR-0001 doc-store yDoc | **Not blocker** | lit-review 主文档结构稳定 |
| ADR-0014 multi-subdoc | **Soft blocker** | 30+ 引用做 subdoc 拆分会快，但单 doc 也跑得动 |

**差异化锚点**：第一性原理 #8（异构内容图）+ #11（Provenance 一等数据）+ ADR-0011 Claim/Evidence/Counterpoint/Synthesis 落地。没有其他产品做"科学评论一等对象层"。

---

### Trigger C：实验室数据集 citation 维护（"lab dataset citation upkeep"）

**用户**：1 位 lab manager + 多位 lab members，维护 lab 引用过的所有数据集（CITATION.cff / DOI 列表）+ 给每个数据集贴 claim/evidence。
**典型工作流**：
1. lab manager 把 1000+ DOI 批量 paste 到 documents（chip-citation-doi 一键引用）
2. members 在 Provenance Card 上标 evidence
3. 跨 lab document 引用关联（ADR-0014 cross-ref-sync）
4. 一周一次 maintenance scan + dashboard

**验收信号**：
- 1 个 lab 跑 ≥ 100 数据集 / 1 个月真实使用
- cross-ref-sync 在多 document 间真同步
- sandbox 内 plugin 真安装（lab member 装第三方 PubMed plugin）

**反推真 P1**：
| codex P1 | 是否 blocker | 理由 |
|---|---|---|
| ADR-0014 multi-subdoc + 50-client | **Blocker** | 多 doc + 跨 doc 引用是核心，sync-gateway 必须 multi-subdoc routing |
| ADR-0012 sandbox 真启动 | **Blocker** | lab 装第三方 plugin（PubMed / arXiv MCP / Zotero MCP）真启动 |
| ADR-0010 user-installed plugin clone/extract | **Blocker** | 同上 |
| ADR-0008 quota | **Soft blocker** | lab 集体跑会暴露 cost；但短期可用人工 cap |
| ADR-0013 ModelProvider | **Soft blocker** | lab 多半统一一个 endpoint |

**差异化锚点**：local-first + plugin marketplace 真实场景。但触发条件最重——需要 sandbox / multi-subdoc / plugin marketplace 三件大件，工程量 ≥ 6 周。

---

### Trigger D：多作者 shared workspace（"shared author workspace"）

**用户**：3-5 位作者跨机构，共用 1 个 workspace（org-level Principal），管理多个 in-progress 论文。
**典型工作流**：
1. workspace 内权限 role bundle 真用（reader / commenter / editor / reviewer / admin）
2. heartbeat re-check ACL（codex §2 ADR-0002 caveat：当前 TODO）
3. 跨论文 reviewer 互审（ADR-0016 Claim-on-Claim Review 直接落地）

**验收信号**：
- ≥ 1 个真实 org（如某 lab）入驻
- 5 role × 3+ 用户 × 多 doc，无权限拒服 bug
- review 一等对象表 + 三 capability（review.submit / publish / sign）实装

**反推真 P1**：
| codex P1 | 是否 blocker | 理由 |
|---|---|---|
| ADR-0002 heartbeat ACL re-check | **Blocker** | 跨机构 + 长会话 + 多 doc 是 heartbeat 设计的核心 use case |
| ADR-0016 Claim-on-Claim Review | **Blocker** | 直接驱动这个 trigger 落地 |
| ADR-0008 quota | **Soft blocker** | 5 user × multi doc 集体 LLM cost 暴露 |
| ADR-0013 ModelProvider | **Blocker** | 跨机构必然多 provider（OpenAI / Anthropic / Ollama on-prem） |
| ADR-0010 plugin marketplace | **Not blocker** | workspace 内 plugin 默认信任，不真 marketplace |

**差异化锚点**：异质协作（人 + agent + reviewer 同台）—— 第一性原理 #9。

---

### Trigger E：plugin marketplace 第三方生态（"plugin marketplace MVP"）

**用户**：3+ 第三方 plugin 作者（社区或邀请）+ 装 plugin 的论文作者。
**典型工作流**：
1. plugin 作者按 ADR-0010 plugin API 写一个 plugin（如 Zotero MCP / Citationsy / OpenReview integration）
2. 用户在 settings/plugins 一键安装
3. capability prompt 真生效（用户拒 plugin 装失败）
4. sandbox 真启动 plugin 进程，agent invoke 走第三方 plugin

**验收信号**：
- 3+ 第三方 plugin 真跑通安装 → capability prompt → 真 spawn → agent invoke → Provenance
- sandbox macOS / Linux / Windows 三平台至少 2 平台 real
- plugin 烧用户 LLM 钱包有 quota cap（关键安全话）

**反推真 P1**：
| codex P1 | 是否 blocker | 理由 |
|---|---|---|
| ADR-0010 user-installed clone/extract real | **Blocker** | 整个 trigger 的核心 |
| ADR-0012 sandbox 真启动（≥ 2 平台） | **Blocker** | 同上 |
| ADR-0008 quota enforcer + cancel | **Blocker** | 第三方烧钱钱包是 P0 安全话 |
| ADR-0013 ModelProvider | **Blocker** | plugin 必须能用用户的 BYO 模型 |
| ADR-0014 subdoc | **Not blocker** | 单 doc 内 plugin 调用 |

**差异化锚点**：第一性原理 #5（可组合优于大一统）+ #12-15（扩展系统）。
**风险**：工程量最大（≥ 8 周），且需要第三方生态种子——没有现成种子时 trigger 假性 fire。

---

## 2. 候选 trigger 对比矩阵

| 维度 | A 双语 | B lit-review | C lab dataset | D shared workspace | E plugin marketplace |
|---|---|---|---|---|---|
| **典型用户数** | 2 | 2 | 5-10 | 3-5 | 3+ plugin 作者 + N 用户 |
| **第一性原理直接命中** | #4 双语 | #8 异构图 + #11 provenance | #1 local-first + #5 可组合 | #9 异质协作 | #5 可组合 + #12-15 扩展 |
| **真 P1 blocker 数（codex 5）** | 1 (ADR-0013) | 2 (ADR-0008 + 0011) | 3 (ADR-0014 + 0012 + 0010) | 3 (ADR-0002 + 0016 + 0013) | 5（全部 P1 真 blocker） |
| **预估工程量到 first real use** | ≤ 1 周 | 3-4 周 | ≥ 6 周 | 4-5 周 | ≥ 8 周 |
| **第一用户找寻难度** | 低（项目所有者 + 1 合作者） | 中（学术圈研究生 + 导师对） | 高（需要真 lab buy-in） | 高（org-level 入驻） | 极高（需第三方生态种子） |
| **失败可逆性** | 高（重新选 trigger 不大改代码） | 中 | 低（投入 6 周后换 trigger 沉没成本大） | 中 | 低 |
| **议会 Strategist 友好度** | ✅ 解锁度低 + Phase 6+ 砍件不冲突 | ✅ 与 ADR-0016 直接绑定 | ⚠️ 触发 sandbox / multi-subdoc 大件 | ✅ ORCID + Wave B 直接绑定 | ⚠️ 触发 4 件大件 |
| **议会 Minimalist 友好度** | ✅ 最少前置 | ⚠️ 需补 finding kind real | ❌ 大件多 | ⚠️ 需 ADR-0016 | ❌ 全开 |
| **codex review 覆盖率** | 1/5 risks 命中 | 2/5 命中 | 3/5 命中 | 3/5 命中 | 5/5 命中 |

---

## 3. W2.1 收敛方向预判

议会 5 角色 + codex 议程交叉得到候选偏好：

| 角色 | 偏好 trigger | 拒绝 trigger | 理由 |
|---|---|---|---|
| Architect | C 或 E | A | "解锁的结构基础设施越多越好" |
| Pragmatist | **A** | C / E | "1 周内能跑通的最重要" |
| Contrarian | **A** 或 B | E | "用户在哪？双语作者 + 学术研究生最容易找；plugin marketplace 没生态种子是假触发" |
| Strategist | **A** 或 D | C / E | "差异化锚点 + 风险可控 + 失败可逆" |
| Minimalist | **A** | E | "最少前置即可启动" |

**初步收敛方向**：**Trigger A 双语论文协作**

**为什么 A 是当前最优**：
1. **最少前置**：codex 5 P1 中只有 1 件（ADR-0013，W0.3 已堵）；W1.1 doc-store yDoc removal 是软 blocker，做完 trigger A 就能跑
2. **差异化最锐利**：CJK / 拉丁双语一等公民是项目唯一难复制的锚点
3. **第一用户容易找**：项目所有者自己 + 1 位英文合作者即可
4. **失败可逆**：A 跑通后换 B / D 不损失基础设施投资
5. **Council blind spot 直接堵**：trigger 定了，"P1 是不是真 P1" 立即变成可验证问题

**W2.1 任务**：收敛到 A，写 trade-off 表（为什么不是 B / C / D / E），并附 "trigger fired 的 6 个硬验收信号"。

---

## 3.1 W2.1 决议（2026-05-11）：选定 Trigger A 双语论文协作

### 为什么是 A 而不是 B/C/D/E

| 拒绝项 | 拒绝理由（具体 trade-off） |
|---|---|
| **B lit-review** 拒绝 | 第一用户找寻难度比 A 高（需要研究生 + 导师对，且对方愿意把真实评论流程交给本项目）；触发后 ADR-0008 + ADR-0011 同时升级到 P0 工程量 ≥ 3 周；ADR-0011 unverified-claim / counterpoint-needed 两 finding kind 从 mock → real 单独估 1 周；**当 A 跑通后，B 用 A 的 70% 基础设施直接复用，启动成本反而更低**。所以 B 推到 Wave B trigger，不是放弃。 |
| **C lab dataset** 拒绝 | 工程量最大（≥ 6 周）+ 失败可逆性最低；需要 ADR-0014 multi-subdoc routing real（codex §2 P1 + 议会 Strategist 也认为 deferred 是正确）；plugin marketplace 不在 Phase 5 Wave A 范围；**没有真 lab buy-in 信号**——主动启动 C 是猜需求 |
| **D shared workspace** 拒绝 | 需要先做 ADR-0016 Claim-on-Claim Review（仍 Drafting permitted 状态）；workspace 5-role × 多 doc 是大件，3-5 user 的 org-level 入驻找寻难度同样高；**当 A 跑通且第一对作者升级为 "我们 lab 也想用" 时，D 自然 fire**——是 A 的 emergent next step，不应主动启动 |
| **E plugin marketplace** 拒绝 | 工程量最大（≥ 8 周）且需要第三方生态种子（没有 → 假触发）；触发后 5 件 codex P1 全升 P0（议会 Pragmatist + Minimalist + Contrarian 三票反对全开 Phase 4.5）；**应当等社区有 ≥ 3 个 plugin 作者主动询问"如何写 plugin"信号再启动** |

### A 的具体定义

**第一用户**：项目所有者本人 + 1 位中文/英文混合写作的合作者（学术圈，跨学科论文方向）。
**第一论文**：1 篇 bilingual paper（约 8000-12000 字），跨学科主题（preference: HCI × 教育 / AI × 协作 / NLP × 语言学）。
**Trigger fired 时间窗**：第一对作者签字承诺合作起 4-6 周内完成 first real use。

### 6 个硬验收信号（trigger fired 才算真）

> 全部 6 项命中 = trigger fired = Phase 5 Wave A 启动；任何 < 4 项 = trigger 未 fire，回到 W2.1 重新选 trigger。

| # | 验收信号 | 验证方法 | 命中阈值 |
|---|---|---|---|
| 1 | 2 位 real user 共同 self-host 成功 | docs/SELF_HOST.md 跑完到 `pnpm web:dev` 起服 + 双语 demo doc 可加载 | self-host 总耗时 ≤ 1 小时（含 docker 起 PG + 安装字体 + better-auth secrets） |
| 2 | 双语并发编辑无 schema-recovery 静默删 | 2 user × 30 min 并发编辑 1 个 doc（CJK 段 + 拉丁段混排） | y-prosemirror schema-recovery 日志 = 0（proto-a findings.md §1 风险） |
| 3 | 至少 3 个 AI 协作动作端到端跑通 | inline-editor chip 改写 + citation chip 核引用 + DOI chip 一键引用 | 每个动作 1 次 propose → 1 次 accept，Provenance 完整（actorPrincipalId + promptHash + toolCalls 非空） |
| 4 | 双语 Typst PDF 导出真打印质量 | `pnpm web:dev` → /api/export/<docId>/pdf 真返 PDF（不是 503）| PDF 双栏 / 双语字距 / CJK 标点 boundary 视觉验收（≥ 2 位作者签字"印刷质量"）|
| 5 | provider 真 round-trip（≥ 1 位作者 BYO） | `apps/web/src/lib/provider-resolver.ts` resolved.source = 'user-pref'（不是 'env-default'） | 至少 1 次 `agent.invoke.ok` event 携带 `providerSource: 'user-pref'` |
| 6 | review / submit 流程到位 | 1 位作者用 reviewer chip propose changes + 另一位 accept/reject + 导出 JATS for submission | `revision_accept_log` 表非空 + JATS export `<article>` 根元素 valid |

### 4 个明确 deferred（A 不需要的 ADR P1）

| 项 | 理由 |
|---|---|
| ADR-0008 quota enforcer + cancel route | A 是 2 user × 单 doc × LLM 调用频次低，没有 runaway 风险 |
| ADR-0012 sandbox macOS / Windows real bwrap | A 不装第三方 plugin（双语作者用 citation / inline-editor 即可） |
| ADR-0014 sync-gateway multi-subdoc + 50-client real stress | A 是单文档场景，不触发 subdoc 拆分 |
| ADR-0010 user-installed plugin clone/extract/sandbox real | 同 ADR-0012 |

**议会决议**：上述 4 项 deferred 不主动启动；如果 A 跑通后第一用户主动要求"我想装一个 Zotero plugin"或"我们 lab 想 5 个人用"，再视情况启动 B/C/D/E trigger 和对应 P1 升级。

### 下一步（W2.2 输入）

W2.2 写 `plan0/phase-5-wave-a-scope.md`，按本节决议：
- Wave A 5 个 W 反推 P1 真子集
- 4 个 deferred 项显式列入 "trigger 未达成则不做" 段
- 给出第一用户找寻清单（项目所有者 reach-out 候选名单，私下问）
- Wave A 完成定义 = 6 个硬验收信号全部命中

---

## 4. Phase 5 Wave A 反推预判（W2.2 详写）

如果 W2.1 真选了 trigger A，Phase 5 Wave A scope 反推：

| W | 标题 | 来源 | 验收 |
|---|---|---|---|
| W1 | doc-store yDoc escape hatch 移除完成（W1.1 已起）| codex §2 + 议会 Architect | grep `\.yDoc` in `packages/doc-store/src/` = 0 |
| W2 | export 路由从真 Y.Doc snapshot 重建 PM tree | codex §1 §4 + ADR-0005 Tier mixed | 移除 `?content=<base64-pm-json>` override 优先路径 |
| W3 | 双语作者 onboarding 5 步剧本端到端跑通 | onboarding.md + USER_GUIDE | 2 user 自助 1 小时内 self-host + 写完第一段 |
| W4 | Provenance writer audit — direct human edit 路径 | codex §1 + 议会 Architect blind spot | grep 所有 commit serializer / revision accept 路径覆盖 actorPrincipalId |
| W5 | Wave A 收尾 + Wave B trigger 评估 | 决定是否进 ADR-0016 起草 | review ADR-0001 review log + Phase 5 retrospective |

**Wave A 明显 deferred**（codex P1 但 trigger A 不需要）：
- ADR-0008 quota enforcer + cancel route（trigger A 不用）
- ADR-0012 sandbox macOS / Windows real（trigger A 不装第三方 plugin）
- ADR-0014 multi-subdoc routing + 50-client real（trigger A 单文档）
- ADR-0010 user-installed plugin clone/extract（trigger A 不装第三方）

**议会建议**：trigger 不强制的 P1 一律 deferred，等 trigger B / D / E 启动再补——这是 W0-W2 议会综合建议的核心。

---

## 5. 下一步

- W2.1（≤ 2 d）：本文档 §3 候选偏好实际收敛 → 选定 1 个 trigger，附 trade-off 表
- W2.2（≤ 1 d）：基于选定 trigger，写 `plan0/phase-5-wave-a-scope.md`
- W2.3（不计入本周）：找到第一用户（项目所有者 + 1 合作者 / 学术研究生对 / lab manager）— 这是 trigger 真正 fire 的最后一步

**直到 trigger fire**：不动 ADR-0008 quota / ADR-0012 macOS sandbox / ADR-0014 multi-subdoc。

---

## 元信息

- 起草来源：议会 blind spot（`.codex-review/COUNCIL-2026-05-11.md`）
- 议会 5 角色一致认为 trigger 未定义 = 所有 "Phase 5 P1" 讨论悬空
- W2.1 收敛后本文档变成 "candidates considered" 历史记录，决议落到 phase-5-wave-a-scope.md
