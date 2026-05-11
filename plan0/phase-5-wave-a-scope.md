# Phase 5 Wave A — Scope（trigger A 双语论文协作反推）

> 起草：2026-05-11（Phase 4.5 W2.2）
> 决议依据：`plan0/phase-5-trigger.md §3.1`（W2.1 选定 Trigger A）
> 议会评议：`.codex-review/COUNCIL-2026-05-11.md`
> 上游 codex review：`.codex-review/REVIEW-2026-05-11.md`

---

## 0. 启动前提（Gate）

Wave A **不主动启动**。启动条件 = 以下 3 项全部命中：

1. **第一对作者签字承诺** — 项目所有者 + 1 位中英文混合写作合作者，明确同意把一篇真实论文（约 8000-12000 字）放在本平台上完成
2. **W0-W2 全部 completed**（本文件状态 = ready）— 见 `STATUS.md §12 Codex review 验证记录`
3. **`pnpm typecheck` + 包级 `:test` 全 PASS**（baseline 干净，layout.tsx React 19 typing 例外按议会 Contrarian §"反对全清"显式列例外）

不满足上述 3 项 = 本文件冻结。

---

## 1. Wave A 5 个 W（4-6 周）

> 每 W 完整定义：目标 / 关键文件 / 验收 / 依赖。
> Trigger A 第一用户找寻 ≠ 工程 W；用户找寻在 W0 之前并行做。

### W1 — doc-store / commit boundary 完整闭环（1 周）

**目标**：把 W0 + 4.5 W1.1 的 yDoc 移除推到 Phase 5 闭环——commit boundary
+ snapshot worker + sync-gateway + IndexeddbPersistence 之间的 raw Y.Doc 流转
走 doc-store API（除 3 个 sync-transport 边界 stay）。

**关键文件**：
- `packages/editor-core/src/sync/setup.ts` — 2 个 boundary 调用点
  （`IndexeddbPersistence(room, handle.yDoc)` + `WebsocketProvider({ydoc: handle.yDoc})`）
  → 各自抽 helper：`bindIndexeddbPersistence(handle, room)` + `bindWebsocketProvider(handle, url)`，
  内部仍取 `.yDoc`，但业务代码不直接接触
- `apps/sync-gateway/src/backends/y-sweet.ts` — 同 pattern
- `packages/doc-store/src/index.ts` — re-export 上述 helper（或新建
  `packages/doc-store/src/integrations.ts`）

**验收**：
- grep gate（已建于 W1.1）继续通过
- 业务代码 `.yDoc` 命中 = 0（包括 sync/setup.ts 内部，全部走 helper）
- `pnpm doc-store:test editor:test sync-gateway:test e2e` 全 PASS
- ADR-0001 §8.2 加 W1 实施记录

**依赖**：W1.1 完成（✅ 已完成 2026-05-11）

### W2 — Export 路由从真 Y.Doc snapshot 重建 PM tree（1 周）

**目标**：codex review §1 §4 + ADR-0005 Evidence Tier mixed 修正——`apps/web/src/app/api/export/[docId]/[format]/route.ts`
当前优先 `?content=<base64-pm-json>` query override 或空 doc fallback；
Wave A 把"从真实 Y.Doc snapshot（snapshot-worker 周期 dump 的 yjs_doc_binary
bytea 列）重建 PM tree → 5 emitter"的路径打通。

**关键文件**：
- `apps/web/src/app/api/export/[docId]/[format]/route.ts:113-124` — 当前
  fallback 逻辑替换
- `apps/snapshot-worker/src/index.ts` — 读 path 验证
- `packages/editor-core/src/sync/setup.ts` — Y.Doc → PM tree 重建辅助
  函数（如已存在 reuse）

**验收**：
- 跑 e2e：`/api/export/<docId>/pdf` 不依赖 `?content` 参数，从真 PG snapshot
  返 PDF
- byte-stable round-trip：commit → PG snapshot → PG fetch → PM tree 重建 →
  emitter → 输出 PDF / JATS bytes 与"先 emit 再 commit"路径一致
- ADR-0005 Evidence Tier 从 mixed 升 real（5 emitter 全部从真 snapshot 验证）

**依赖**：W1 完成

### W3 — 双语作者 onboarding 5 步剧本端到端跑通（1 周）

**目标**：trigger A 验收信号 1（self-host ≤ 1 小时）+ 信号 2（schema-recovery
日志 = 0）的工程实证。

**关键文件**：
- `docs/SELF_HOST.md` — 实测 macOS + Linux 各跑一次，时长记录
- `docs/USER_GUIDE.md` — 双语作者首次使用 5 步流程
- `apps/web/public/demo/onboarding.md` — 5 步剧本对齐 trigger A（不是
  generic onboarding）
- `apps/web/public/demo/specimen-bilingual.{json,md}` — 真双语 demo

**验收**：
- 2 位 real user（项目所有者 + 第一对合作者）从 git clone 到看到双语 demo doc 完成
  时长 ≤ 1 小时（手动记 timeline 写入 `STATUS.md §4 Phase 5 交付物`）
- 30 min 并发编辑后 chrome devtools console 无 y-prosemirror schema-recovery
  warning（proto-a findings.md §1 风险闭环）

**依赖**：无（可与 W1/W2 并行）

### W4 — Provenance writer audit（direct human edit 路径覆盖）（1 周）

**目标**：codex review §1 + 议会 Architect blind spot——`persistProposalBatch`
是唯一集中入口（agent proposal 路径），但 **direct human edit（非 agent
contribution）的 provenance 覆盖率没审计过**。Phase 5 trigger A 要求
"Provenance 完整覆盖 AI 介入 + 双方编辑"。

**关键文件**：
- `packages/ai-runtime/src/provenance-writer.ts` — 已有入口
- `apps/web/src/app/api/revision/` — accept/reject/modify 3 endpoint
- `packages/editor-core/src/commit.ts` — commit serializer
- `apps/snapshot-worker/src/index.ts` — 周期性 contribution 写入路径

**验收**：
- grep 所有写入 `contribution` 表的路径，每条都附 `actorPrincipalId` 非空验证
- direct human edit 路径写 `provenance` 行（非 agent 介入也有 provenance：
  `actorPrincipalId` = user principal，`agentContext` = null，`promptHash` =
  null）
- 加单测：`packages/ai-runtime/tests/provenance-writer.test.ts` 覆盖
  human-edit-only 场景
- ADR-0001 §2.3.7 + ADR-0011 review log 加 W4 记录

**依赖**：W1 完成

### W5 — Wave A 收尾 + Wave B trigger 评估（1 周）

**目标**：
- 6 个硬验收信号（phase-5-trigger.md §3.1）逐条命中验证
- Wave A retrospective（哪些 ADR 升 tier、哪些发现是新问题）
- Wave B trigger 判定（第一用户主动信号？lab buy-in？plugin 询问？）

**关键文件**：
- `STATUS.md §12` 加 Phase 5 Wave A 验证记录
- `plan0/phase-5-retrospective.md` — 新建
- 决议是否进入 ADR-0016 Claim-on-Claim Review 起草（trigger B 启动条件）

**验收**：
- 6 个硬验收信号文档化命中 / 未命中
- Wave A 完成定义 = 至少 5/6 信号命中（信号 4 PDF 印刷质量主观，允许 1
  项软命中）
- Phase 5 retrospective merge 后 `STATUS.md` Phase 5 section 收尾

**依赖**：W1-W4 全部完成 + 6 个验收信号实测

---

## 2. 4 个 deferred（trigger A 不需要的 codex P1）

| ADR | 推迟到 | 复活条件 |
|---|---|---|
| **ADR-0008 quota enforcer + cancel route + worker polling timeout** | Phase 5 Wave B+ | 任一 trigger B（lit-review，researcher chip 跑 30+ MCP 调用）/ C（lab dataset）/ E（plugin marketplace 烧用户钱包）fire |
| **ADR-0012 sandbox macOS / Windows real bwrap / sandbox-exec** | Phase 5 Wave B+ | trigger C / E fire；或第一用户主动询问"我想装第三方 plugin" |
| **ADR-0014 sync-gateway multi-subdoc routing + 50-client real stress** | Phase 5 Wave B+ | trigger C / D fire；或单 doc 大小超 200KB Y.Doc binary（subdoc 拆分性能压力出现） |
| **ADR-0010 user-installed plugin clone/extract/sandbox real spawn** | Phase 5 Wave B+ | trigger C / E fire |

**议会议决（CLAUDE.md §5.3 新 ADR moratorium 例外说明）**：
- 上述 4 项 P1 在 trigger A 期间**禁止主动启动**——议会 Pragmatist + Minimalist + Contrarian + Strategist 4 票一致
- 任何 PR 触碰上述 ADR 的代码需要在 PR 描述里**显式回答**：哪个 trigger fired？没有 trigger = PR 拒绝（即使工程上"看起来该做"）
- 例外：ADR-0008 仅当出现真实 LLM cost incident（单次调用 > $5）时允许紧急
  patch（quota 单点 cap，不是 full enforcer）

---

## 3. 第一用户找寻清单（不计入 Wave A 工程）

> 此节内容**私下**完成，不进 PR / git log；trigger A 第一用户签字承诺之前 Wave A 不启动。

候选合作者（议会 Empath + Strategist 评估优先级）：
1. **学术圈跨学科合作者**（HCI × 教育 / AI × 协作 / NLP × 语言学）— preference: 已经在双语论文写作中遇到痛点
2. **海外华人学者**（中文母语 + 英文学术写作）— preference: 有具体 paper deadline 6-8 周内
3. **国内研究生 + 海外导师对**（次优；触发难度更高）

找寻方式（非工程）：
- 直接 reach-out（项目所有者私交圈）
- 学术 conference 后 follow-up（CHI / NeurIPS / ACL 等）
- 投递 demo 给真实用户群（推 Twitter / Mastodon / RSS）

**Wave A 不启动 = 第一用户未签字**。这是 trigger A 的本质：**没有用户 = Phase 5 没有工程**。

---

## 4. 不做的事（明确清单）

### 4.1 Wave A 不做（推 Wave B / 后续）
- ADR-0016 Claim-on-Claim Review 起草（推 Wave B kickoff 前 1 周）
- ORCID JWS detached signature 真做（推 Wave B claim-review.sign）
- ADR-0011 unverified-claim / counterpoint-needed finding kind real（推 lit-review trigger B）
- subdocument cross-doc reference real sync（推 Wave B）

### 4.2 Wave A **禁止**做（议会一致反对）
- 主动启动 ADR-0008 quota enforcer（议会 4 票 deferred）
- 主动启动 sandbox macOS 真做（议会 4 票 deferred）
- 全清 Design grep 命中（议会 Contrarian 反对，保留 SoT 范围）
- 主动启动 plugin marketplace 工程（议会 Minimalist 评估为假触发）
- 任何"完美主义"性质的修复（codex 5 risks 中 1 个 hard fact + 4 个 soft 框架判断，W0-W2 已经处置）

---

## 5. 元信息

- 起草来源：phase-5-trigger.md §3.1 决议（W2.1）
- 议会综合建议吸纳率：
  - Architect "1 件实证展示" = ✅ W1（doc-store yDoc 已闭环 + Wave A W1 推到 helper 隔离）
  - Pragmatist "1 周尾巴清理" = ✅ W0 + Wave A W1-W2
  - Contrarian "保留 SoT 范围 + 拒绝全清" = ✅ §4.2
  - Strategist "trigger 决定 P1 真子集" = ✅ §2 deferred 表
  - Minimalist "不开 1.5 周专项" = ✅ Wave A 4-6 周但不是 4.5 专项
- 4 项 P1 deferred 复活条件全部锚定到具体 trigger（B/C/D/E），不是时间
- Wave A 完成 ≠ Phase 5 完成；Wave B 由 retrospective 决定是否启动 + 启动哪个 trigger
