# 项目状态 · Living Dashboard

> 唯一的"项目当前在哪"快照。每个 phase 推进 / commit landed / ADR 状态变化时更新本文件。
> 历史 / 决策细节看 `plan0/`；本文件是执行视角。

最后更新：2026-05-12（main，**Phase 5 W3 Pre — ADR-0020 Night-Bridge-Day Triadic Architecture Proposed + improvement-plan §十二 land**）。承接 plan Iteration 1-4 演进（`/Users/jili/.claude/plans/night-science-day-science-snoopy-widget.md` 700+ 行 deliberation）+ jili 自有 night-science 文档 2021 行（`/Users/jili/project/nightscience/`）：(d1) `plan0/adr/0020-night-bridge-day-triadic-architecture.md` 战略 ADR Status=Proposed，Phase 5 W3+ 横跨 Phase 5/6；核心决策 = **三层等价知识产出系统**（Night 草图/隐喻/反例/思想实验/矛盾/问题 → Bridge 概念验证/设计虚构/技术预印/类比 → Day 论文/代码/政策；三类产出 attribution/archive/citation 等价）+ 5 创意触发模式作 schema tags（隐喻/矛盾/重提问/跨界/思想实验）+ 6 种交互流双向 contract（假设输出/反常输入/约束传递/隐喻桥接/问题回流/方法迁移）+ 4 角色分化（Explorer/Bridge-builder/Validator/Connector）+ contribution-graph attribution 反 priority race；声明为战略 ADR moratorium 例外（§0），ADR-0017/0018/0019 仍归 client-first 预留；8 既有 ADR review log 待追加（0001/0002/0008/0010/0011/0014/0015/0016）；(d2) `plan0/improvement-plan-2026-05.md` §十二 "Night-Bridge-Day Pivot" 12 小节 land：起因/核心 shift/5 维度新增/与砍清单关系/ADR 影响表扩充/moratorium 例外声明/与 client-first 合并叙事/Wave D-1~D-5 路线（W3-W12）/9 个 dogfood gate G-T1~G-T9/风险与未决问题 R-T1~R-T6+Q-T1~Q-T3/立即动作清单/Stop conditions；(d3) §四砍清单两项以 night/bridge 为名复活（spatial canvas → thought-DAG view / ADR-0014 subdocument-level ACL → cross-layer visibility tiers）；其余仍砍（章节 fork-merge / Loro 切换 / 跨设备 storage / Plugin marketplace）；(d4) 9 dogfood gate 包含 jili 30 天 ≥50 Night + ≥10 Bridge + ≥3 Day promotion + 6 交互流至少触发 4 种 + 4 角色至少切换 2 个 + contribution-graph ≥10 多人 artifact + Phase 4 Wave B5/B6/C2/C4 无 regression + Wave A quota-enforcer P0 不被推后 + 5 创意模式分布 ≥4 个。**注意**：Wave A quota-enforcer (P0) 仍为下次会话首要工作（per memory `wave_a_a1_next.md`），与 Iteration 4 解耦。**下一笔**：(a) STATUS §2 ADR 表加 ADR-0020 row + 8 既有 ADR row Iteration 4 caveat；(b) `paper-platform-system-prompt.md` 第一性原理 #12 #13 加 + #1 #3 修订；(c) Wave A quota-enforcer (P0)；(d) Wave D-1 `packages/discovery-graph/` schema scaffold（W4 kickoff）。本笔仅 plan + ADR + improvement-plan landed，无代码改动。

上次更新：2026-05-12（claude/phase5-wave-c-dogfood，**Phase 5 Wave C C4 — landing page 加 Differentiation + Specimens 段**）。落地 improvement-plan §三 Wave C C4 公开物料：(d1) `apps/web/src/lib/i18n/locales/{zh,en}.ts` 新加 `landing.differentiation`（heading + sub + rows[4] vs Curvenote/MyST/Quarto/Notion + footnote）+ `landing.specimens`（heading + sub + 3 alt/caption: Typst PDF / AgentTimeline / Review DAG）中英对照齐发；(d2) 3 specimen SVG：(a) `apps/web/public/demo/landing-specimen-typst.svg` Typst PDF 样张 mockup（paper bg / 双语 title / 摘要 EN+CN 字体独立 / Garamond + Songti / 学刊页眉页码）；(b) `landing-specimen-timeline.svg` AgentTimeline 父子树（coordinator running + reviewer done + researcher cancelling，含 StatusPill / MonoDisc / quota badge / 已禁用的 Cancel button — Phase 5 Wave A A1+A2 dispatch tree 可见验收物）；(c) 复用 B6 commit `desci-review-pilot-fig1.svg` review DAG；(d3) `apps/web/src/components/landing/Landing.tsx` 加 2 节：(a) **Differentiation** 4 hairline-separated row grid（vs <competitor> 标签 + theyDo italic ink-3 + weDo serif ink）+ footnote 链接 README/plan0/；(b) **Specimens** 3 figure（`<SpecimenFigure>` 新加 helper：a 链接 SVG + lazy/async img + hairline border + serif italic caption + aspectRatio CSS）；Design.md tokens 全：no shadow / no rounded / no zinc / no blue palette；reject grep 全 0；data-prose="bilingual" 让 CJK 排版 pre-pass 接管；(d4) apps/web 327 测仍 PASS（landing 渲染无测试，纯 UI）；全 workspace typecheck PASS。**Wave C 阶段性收尾**：C2 demo paper + C4 landing 全交付（AI 可独立完成的部分）；C1 用本平台写 plan0/ + C3 学术社区邀请是用户亲自 dogfood，AI 不直接 commit。**下一笔**：用户决定 (a) merge Wave C 到 main、(b) 继续 C1/C3 dogfood (user-driven)、(c) Phase 5 Wave D 收尾。

上次更新：2026-05-12（claude/phase5-wave-c-dogfood，**Phase 5 Wave C C2 — demo paper specimen 落地（5 年差异化锚点公开物料）**）。Wave B 全 6 笔已 fast-forward 合 main（7 commits `acaac79 → 18ec5eb`）。Wave C kickoff 落地 C2 demo paper：(c1) `apps/web/public/demo/desci-review-pilot.md` 双语 ~500 字综述：5 claim（main/counter/synthesis 全类型 + ai-suggested/human-reviewed/approved 多 status）+ 3 evidence（supports/qualifies/challenges relation 全覆盖）+ 1 ORCID-签名 endorse verdict + 1 ORCID-签名 challenge with counter-evidence verdict + 一节 "How to verify the ORCID signatures" 给出 `curl orcid.org/oauth/jwks + jose jws verify` 第三方独立验证命令 —— 文末显式说明 "5 年差异化锚点 = 评审可信度不依赖 Collaboration Tool 在线"；(c2) `desci-review-pilot.json` AI context-pack export shape（ADR-0011 §2.7 扩展加 reviews + aggregate buckets）：5 claims / 3 evidences / 2 claimLinks / 3 sources / 2 reviews / 2 provenance rows / aggregate 节按 claim_id 索引 verdict 桶 + orcidSignedCount + aiVerdictCount + withdrawnCount；(c3) `desci-review-pilot-fig1.svg` review DAG 图：claim 节点居中 + 左 endorse accent-moss + 右 challenge accent-ox + 反例证据虚线连回；CSS 走 `var(--color-accent-moss/ox/ink)` 让页面 Design.md token cascade 接管，静态 fallback 留 hex；(c4) `apps/web/public/demo/README.md` 双语索引 + 用法（阅读 / 模板 import / CI smoke 三场景）+ Wave C dogfood gate 注：真 paper 落地后 desci-review-pilot.* 退为历史基线；JSON valid + 仍标 "synthetic / illustrative"（ORCID iD / JWS payload 都是 placeholder，避免发布到 public/ 时引入测试签名）。**下一笔 C4**：landing page —— 4 段 vs Curvenote/MyST/Quarto/Notion 叙事 + specimen Typst PDF 截图 + AgentTimeline 截图 + claim review DAG 截图。**C1/C3 是用户亲自操作的 dogfood + 学术社区邀请**，不由 AI 直接 commit。

上次更新：2026-05-12（claude/phase5-wave-b-claim-review，**Phase 5 Wave B B6 — public claim lineage view（Wave B 收尾）**）。落地 ADR-0016 §2.8 review DAG 前端 surface（lineage GET API 已在 B3 commit 落地）：(d1) `apps/web/src/app/(app)/claim/[claimId]/lineage/page.tsx` Server Component force-dynamic：claim row + claim_review rows ASC by submittedAt + 解引用 evidence chain（inArray）+ aggregateLineage roll-up；(d2) 渲染：header（claim text quote + id 前 16 + claimType + status + 回 doc link）+ aggregate section（active reviews + verdict 分布 + orcidSignedCount/aiVerdictCount/withdrawnCount 中英）+ 时序 lineage list（每节点 MonoDisc kind=agent|human + monogram A|R + accent-moss/ox/ink verdict 标签 + StatusPill blocked 撤回 badge + ORCID iD 链接到 orcid.org/<id> profile + submitted date + 签名时间）+ 每节点 details/summary 折叠引用 evidence（悬空 ref 显式标记）+ ORCID-signed JWS pre 块 + 验证链接到 `https://orcid.org/oauth/jwks` 让第三方独立验证；(d3) Design.md tokens 全：HairlineRule / MonoDisc / StatusPill / accent triad / 中英双语 / Design.md reject grep 全 0；Phase 5 scope 仍 require session（与 lineage API 一致），Wave C dogfood gate criterion 4 require 公共匿名访问时一起切换（page + API auth check）；(d4) apps/web 327 测仍 PASS（页面无测试，纯渲染）；全 workspace typecheck PASS。**Wave B 全 6 笔交付**：kickoff(ADR-0016) + B1 schema + B2 PM mark + B3 API + B4 unverified-claim finding + B5 Reviewer Inbox + B6 lineage view（共 7 commit on `claude/phase5-wave-b-claim-review`）。**剩余 Wave B**：dogfood gate 5 criteria 跑通后 ADR-0016 Proposed → Accepted（需真 paper + 5 ORCID reviewer + JWKS 真验证 + 公共匿名 view 切换 + withdraw 正确性）。**下一笔**：Wave C 元 dogfood (C1 用本平台写 plan0/ + C2 demo paper + C3 alpha tester 邀请 + C4 landing page)。

上次更新：2026-05-12（claude/phase5-wave-b-claim-review，**Phase 5 Wave B B5 — Reviewer Inbox dashboard**）。落地 ADR-0016 §2.7 reviewer 命令面：(d1) `apps/web/src/lib/reviewer-inbox.ts` 纯逻辑：`parseInboxFilter`（URL params 或 Next.js searchParams 对象 → typed filter，mineOnly 与 excludeMine 互斥时 mineOnly 优先，blank 值 drop）+ `assembleInbox(claims, reviews, callerPrincipalId, filter, now)`（候选 claim 集合按 hasEndorsingHuman 排除 + 7 天 aging 阈值 `REVIEWER_INBOX_OPEN_AGING_DAYS` + filter 4 维度 documentId/topicPrefix/mineOnly/excludeMine + 按 agingDays DESC 排序 — 最老的最先；mineOnly 视图绕过 aging+endorsement 闸让 reviewer 看自己的 verdict）+ `REVIEWER_INBOX_OPEN_AGING_DAYS = 7` 常量；(d2) `apps/web/src/app/(app)/reviewer-inbox/page.tsx` Server Component — `force-dynamic` + candidate claims query INNER JOIN principal where kind='agent' + status IN (ai-suggested/human-reviewed/approved) ORDER BY created_at DESC LIMIT 200；JS 端 assembleInbox 过滤；3 filter Link（全部 / 待我评审 / 我已评审），MonoDisc kind='human' monogram='R' / StatusPill / HairlineRule / Design.md tokens；(d3) `ClaimVerdictForm.tsx` 'use client'：3 verdict radio buttons + body markdown textarea + evidence ids 空白逗号分隔输入；POST `/api/claim/<id>/review` → 201 后 router.refresh()；错误结构化展示；已 verdict 的 claim 显示"撤回 + 重提"提示而非二次提交（ADR-0016 §2.4 ORCID-signed immutable）；(d4) **测试**：apps/web tests/reviewer-inbox.test.ts **17 测** 覆盖 parseInboxFilter 5 cases（empty/normal/mineOnly 互斥/object 源/blank drop）+ assembleInbox default view 6 cases（aging happy / 太新 hide / endorsing human hide / AI endorse 不算 / withdrawn 不算 / callerVerdict 暴露 + 常量 = 7）+ filter constraints 4 cases（documentId / topicPrefix / mineOnly 绕过 / excludeMine 排除）+ sort 1 case（agingDays DESC）；apps/web **310→327 测全 PASS**；全 workspace typecheck PASS；Design.md reject grep 全 0。**Wave B B5 收尾**。**剩余 Wave B**：B6 公共 review DAG 渲染（lineage API 已在 B3 落地，前端 surface 待补；Wave B6 dogfood gate 第 4 项 require 未登录访问 — Wave C 元 dogfood 时切换）。

上次更新：2026-05-12（claude/phase5-wave-b-claim-review，**Phase 5 Wave B B4 — maintenance scan 第 7 类 finding `unverified-claim`**）。落地 ADR-0016 §2.6 SQL-pure 扫描器：(d1) migration 0015 `ALTER TYPE finding_kind ADD VALUE IF NOT EXISTS 'unverified-claim'`（PG 12+ 幂等，docker-compose 16）；Drizzle enum 同步 6→7 档；(d2) `apps/agent-worker/src/maintenance-scan.ts` 加 `ScanFindingKind = 'unverified-claim'` + `unverifiedClaimAgingDays?: number` 配置（默认 30 天）+ `scanUnverifiedClaims(db, input)` 函数 — 两步查询：① claim INNER JOIN principal WHERE created_at < cutoff AND principal.kind='agent' AND status NOT IN ('deprecated','superseded')；② claim_review WHERE verdict='endorses' AND is_ai_verdict=false AND withdrawn_at IS NULL；两集合 LEFT 减法找出"AI 创建但无人类背书"的 claim；severity = medium；ADR-0016 §2.6 原说"provenance.actor_kind 全是 agent"用 `principal.created_by.kind='agent'` 作 proxy（claim 与 provenance 之间无直接 FK；准确路径需 walk contribution rows by affected_block_ids，B4 范围内不做，留 Wave D 评估）；(d3) **测试**：apps/agent-worker tests/maintenance-scan.test.ts 加 5 测覆盖 unverified-claim：happy 30 天 agent-created 未背书 / 已 endorsed 不计 / deprecated+superseded 跳过 / 空候选 / 自定义 agingDays=7；新加 `makeFifoStubDb` 因 claim/claim_review 表名子串冲突使共享 stub 的 substring matcher 歧义；agent-worker **26→31 测全 PASS**；全 workspace typecheck PASS。**下一笔 B5**：Reviewer Inbox dashboard `/(app)/reviewer-inbox` —— filter (topic/myself/paper) + 一键 verdict button + body editor + evidence picker + 自动 ORCID-sign 跳转。

上次更新：2026-05-12（claude/phase5-wave-b-claim-review，**Phase 5 Wave B B3 — claim-review API endpoints**）。落地 ADR-0016 §2.3 5 endpoints + 服务层 invariants。(d1) `apps/web/src/lib/claim-review.ts` 纯逻辑 3 validators：`validateSubmitClaimReview` 8 reject reasons（invalid-verdict / empty-body / challenges-requires-evidence / ai-must-not-sign / sign-requires-orcid / invalid-evidence-ref-id 等）实现 ADR-0016 §2.1 3 invariants；`validateApplySignature` 7 reject（unauthorized / ai-cannot-sign / already-signed / withdrawn / no-orcid-linked / empty-jws / not-found）；`validateWithdraw` 4 reject（unauthorized / already-withdrawn / empty-reason / not-found）；`aggregateLineage(rows)` 纯 roll-up（endorses/challenges/refines/orcidSignedCount/aiVerdictCount/totalReviews/activeReviews/withdrawnCount，withdrawn 不算入活跃 verdict 计数）。(d2) **5 endpoints**：`POST /api/claim/[claimId]/review` submit（capability `claim.review:create`，加载 claim → document_origin_id 做 capability scope，验证后写 provenance row + claim_review row；reviewer_orcid_id + signed_payload_jws 提交时一律 null，sign 步骤单独走）；`GET /api/claim/[claimId]/review` list（capability `claim.review:read`，返回 reviews + aggregate buckets）；`POST /review/[reviewId]/sign`（ORCID id_token 作 detached JWS，更新 4 字段，stub 不做 JWKS verify — Wave B dogfood gate 第 3 项 require 真 JWKS round-trip）；`POST /review/[reviewId]/withdraw`（mark-only，仅 reviewer 自己；ownership 先于 terminal）；`GET /api/claim/[claimId]/lineage` 公共 review DAG（claim + 时序排序 reviewDag + 解引用 evidenceChain + aggregate；公共未登录视图留 Wave B6 dogfood gate 第 4 项 require 移除 session 检查）。(d3) **测试**：apps/web tests/claim-review-service.test.ts **27 测**覆盖：CLAIM_REVIEW_VERDICTS 集合完备性 + submit 4 happy + 7 reject + sign 7 cases + withdraw 4 cases + aggregateLineage 4 cases（空/分区/withdrawn 不计 orcid 等）；apps/web **283→310 测全 PASS**；全 workspace typecheck PASS。**下一笔 B4**：maintenance scan 第 7 类 finding `unverified-claim`（SQL-pure，无 endorsing review > 30 天 + provenance.actor_kind 全 agent）。

上次更新：2026-05-11（claude/phase5-wave-b-claim-review，**Phase 5 Wave B B2 — PM mark `claim-review-anchor` + render emitter**）。落地 ADR-0016 §2.2 PM mark：(d1) `packages/editor-core/src/extensions/claim-review-anchor.ts` — TipTap Mark（非 Node，因 review 是 claim 装饰；`spanning: false` 一 claim 一 anchor），3 attrs（`claimId`/`verdictBuckets`/`latestReviewerOrcidId`），2 commands（addClaimReviewAnchor/remove），renderHTML 走 accent triad CSS class（accent-moss/ox/ink/mixed/empty 5 态）；导出 pure helpers `dominantVerdict(buckets)` + `anchorAccentClass(buckets)` 供 SoT 共享；(d2) `packages/editor-core/src/extensions/all.ts` + `index.ts` 注册 + 导出，paperSchema 自动含 `claimReviewAnchor` mark；(d3) `packages/render-myst/src/types.ts` `MystMark` union 加 `'claim-review-anchor'` 变体；`ast-from-pm.ts` 收集 mark → ast；`html.ts` 包裹规则 bold → italic → annotation-anchor → claim-review-anchor（review 最外层，accent 颜色读过 inline 格式）+ HTML data attrs（`data-claim-id` / `data-verdict-buckets="endorses=N;challenges=N;refines=N"` / `data-latest-reviewer-orcid` optional）+ 内联 CSS 5 accent class 规则；(d4) `packages/render-typst/src/source-from-pm.ts` mark 命中 dominant verdict 时 emit `#underline(stroke: rgb("#6b8e23|#8b0000|#1a365d"))[text]`，mixed / empty 不修改（accent only when 单赢家）；(d5) **测试**：editor-core tests/claim-review-anchor.test.ts 15 测（5 dominantVerdict 分支 + 4 anchorAccentClass accent class + 3 mark schema 注册/attrs key 顺序 + 3 helper edge cases）+ schema.test.ts 加 claimReviewAnchor 断言；render-myst tests/claim-review-anchor.test.ts 11 测（3 AST 翻译 + 5 accent class HTML 输出 + ORCID 出现/缺席 + buckets data attr 格式）；render-typst tests/source-from-pm.test.ts 加 1 测（5 dominant verdict + 2 negative）；**测试基线**：editor-core 78→93 测；render-myst 29→40 测；render-typst 17→18 测；全 workspace typecheck PASS。**下一笔 B3**：4 API endpoints (`POST /api/claim/<id>/review` submit + `/review/<id>/sign` 两步 + `GET /reviews` + `POST /withdraw` + `GET /lineage` 公共 DAG)。

上次更新：2026-05-11（claude/phase5-wave-b-claim-review，**Phase 5 Wave B kickoff — ADR-0016 Claim-on-Claim Review 起草**）。Wave A 全 4 笔已合并 main（commit `df16ac1 / 1f49678 / a31b51c` fast-forward）；Wave B 是新 ADR moratorium 例外，5 年差异化锚点显形。落地：(c1) `plan0/adr/0016-claim-on-claim-review.md` 一页内 ADR（Status: Proposed），覆盖：(§2.1) 新表 `claim_review` schema（id/claim_id/reviewer_principal_id/reviewer_orcid_id?/is_ai_verdict/verdict (3-enum endorses/challenges/refines) /body_markdown/evidence_refs[]/signed_payload_jws?/orcid_signed_at/provenance_id/withdrawn_at/verdict_meta jsonb 前向兼容）+ 4 复合索引 + 3 应用层 invariants（challenges⇒evidence_refs 非空、AI verdict⇒no ORCID、signed⇒ORCID+orcid_signed_at）；(§2.2) PM mark `claim-review-anchor`（非 Node 因 review 是 claim 装饰；3 视图 reviewer/author/public 渲染规则 accent triad SoT）；(§2.3) 4 API endpoint（POST /review submit / GET /reviews / POST /review/<id>/sign 两步签 / POST /withdraw / GET /lineage 公共 DAG）；(§2.4) 3 capability vocab claim.review:{create,read,withdraw} 不加 :edit（ORCID-signed 不可改）；(§2.5) 状态机 draft（in-flight）→ ai-submitted | human-submitted → orcid-signed | withdrawn；(§2.6) maintenance scan 第 7 类 finding `unverified-claim`（SQL-pure，无 endorsing review > 30 天 且 provenance.actor_kind 全 agent）；(§2.7) Reviewer Inbox dashboard surface；(§2.8) Wave B6 public review DAG 渲染规则；(§2.9) dogfood gate 5 criteria（1 paper / 10 claim / 5 ORCID reviewer / 每 ≥3 verdict + 1 challenge with evidence / 公共 lineage 渲染 / withdraw 正确性）；(§3) 5 trade-offs（schema +1 张表 / ORCID 依赖 / evidence_refs 软 FK / Reviewer Inbox 新 surface 9→10）；(§4) 5 Alternatives rejected（A 复用 evidence.relation / B 复用 ADR-0015 review 表 / C annotation_thread / D 无 ORCID / E ORCID 强制）；(c2) `plan0/ADR-INDEX.md` 快表 + Phase 5 时间线 + 依赖图 (0001/0002/0008/0011/0015 ←0016) + 协作/评审主题聚类 + 阅读顺序建议追加 Wave B；(c3) STATUS §2 ADR-0016 row 从"Drafting permitted"升 **Proposed** + 完整 caveat 行。**下一笔 B1**：migration 0014 落 claim_review 表 + claim_review_verdict enum + Drizzle schema 同步 + 3 capability 加 `packages/permissions/src/capability-vocab.ts` + 进 reviewer/commenter role bundles。

上次更新：2026-05-11（claude/phase5-wave-a-quota-enforcer，**Phase 5 Wave A A3+A4 — ExecutionContext 扩 + AgentTimeline 落地（Wave A 收尾）**）。补 improvement-plan §五 Wave A 收尾两笔；CLAUDE.md §5.6"AI provenance 空白零容忍"延伸：execution telemetry（iterations/tokens/retries）现在和现有 toolCalls + promptHash 一起入 provenance。落地：(b1) **A3 — `packages/schema/src/provenance.ts`**：新加 `RetryRecord`（attempt/errorClass/errorMessage?/delayedMs/occurredAt）+ `AgentExecutionContext` 扩 4 字段 `actualIterations? / promptTokens? / completionTokens? / retries?: RetryRecord[]`，**全部 optional** 不破现有 8 个 callers（agent-runner mock + 3 ModelProvider adapter + 2 prototype + provenance-writer + types.ts）；agentContext 在 PG 是 jsonb 列，加字段无 schema migration（5 contract test 锁住 minimal Phase 1-4 shape + populated A3 shape + JSON 序列化 roundtrip 无损 + RetryRecord minimal/empty-array）；ai-runtime **124→129 测全 PASS**；(b2) **A4 — `apps/web/src/lib/agent-timeline.ts`**：纯逻辑 `buildTimelineTree({jobs, events, rootJobId})` BFS 装配父子树 + orphan detection（parentJobId 指向 missing / parentJobId 为 null 但非 root 都进 orphans 不进 tree）+ children 按 startedAt ASC 排序（startedAt=null 排尾）+ events 按 bigserial id ASC 排（emit order）+ cycle guard（visited Set 防 parent_job_id 误成环）；rollup helper `totalCostUsdMilli` + `countDescendants` + `classifyJobStatus`（cancelling→in-progress 因 worker 未确认，unknown→error 默认）；(b3) **`GET /api/agent/job/[jobId]/tree`**：BFS expand frontier 直到 MAX_DESCENDANT_FAN_OUT=1024 + inArray events 拉取 + buildTimelineTree 装配；404 / 401 标准；(b4) **`apps/web/src/app/(app)/editor/[docId]/components/AgentTimeline.tsx`**：'use client' + fetch tree + 4s poll (terminal status 自动停 poll) + 节点 expand 看 events 载荷 + cancel button（queued|running 才显示 → POST /cancel → 局部 refresh）+ MonoDisc + StatusPill + HairlineRule + accent ox 错误条 + 中英 bilingual label（Design.md §3.4）；reject grep 全 0；(b5) **测试**：apps/web tests/agent-timeline.test.ts 14 测覆盖 root-only / 2-level dispatch / 3-level chain / startedAt 排序（null 排尾）/ orphan 两路径 / event bigserial 排序 / classifyJobStatus 6 status + unknown + cancelling 行为 / totalCost rollup / countDescendants 不含 root；ai-runtime tests/agent-execution-context-contract.test.ts 5 测；apps/web **269→283 测全 PASS**；agent-worker 26 + **全 workspace typecheck PASS**；(b6) STATUS §2 ADR-0008 row Evidence Tier 升 `mixed`（quota+cancel real；A3+A4 contract，Wave A 4 笔全交付）；ADR-0008 §7 review log 追 A3+A4 段。**Wave A 收尾**：A1-A4 全 commit，剩 reviewer/researcher 真 LLM round-trip 跑通（Wave B/D） + bwrap real spawn / 4-endpoint real round-trip（Phase 5 W1 dogfood gate gated on host）。**下一笔**：Wave B Claim-on-Claim Review kickoff（ADR-0016 起草解禁）—— B1 claim_review schema migration + B2 PM mark + B3 API + B4-6。

上次更新：2026-05-11（claude/phase5-wave-a-quota-enforcer，**Phase 5 Wave A A2 — cancel API + worker poll 落地**）。补 ADR-0008 §93 / §156 承诺 + CLAUDE.md §5.7 红线"agent 必须有 quota + timeout + 可中断"中 **可中断** 维度。落地：(a1) migration 0013 新增 §3：`ALTER TYPE "agent_job_status" ADD VALUE IF NOT EXISTS 'cancelling'`（PG 12+ 幂等）；Drizzle `agentJobStatusEnum` 同步加 'cancelling' 第 3 档；(a2) `apps/agent-worker/src/job-types.ts` `AgentJobStatus` union 增 'cancelling'（5→6 档）+ `JobEventPayload` union 增 `{kind:'cancelled', reason}` 第 5 档（区别于 'error'，让客户端能渲染"被你停了"而不是"agent 失败了"）；(a3) `apps/agent-worker/src/job-store.ts` 新增 4 个 helper：`markCancelling`（无校验写侧，guard 在 validator）、`markCancelled`（terminal + finishedAt + progressFraction 保留）、`isCancelling(jobId)` poll、`readJobOwnership(jobId)`；(a4) `apps/web/src/lib/agent-job-cancel.ts` 纯 validator + 3 集合（CANCELLABLE / ALREADY_CANCELLING / TERMINAL）+ `validateCancel({job, callerPrincipalId})` 状态机：queued|running→cancelling (apply)、cancelling→cancelling (idempotent no-op)、done|error|cancelled→409；ownership 校验 优先于 terminal 校验（stranger 看 done 也返 403，不泄漏状态）；(a5) `apps/web/src/app/api/agent/job/[jobId]/cancel/route.ts` POST 接 validator：reason→status code (not-found→404 / unauthorized→403 / terminal-state→409)；apply 时直写 `agentJob.status='cancelling'`；emit `agent.job.cancel.{requested,rejected}` observability 事件；(a6) `apps/agent-worker/src/index.ts` 新增 `respectCancellation(db, jobId, boundary)` helper —— poll + markCancelled + appendEvent({kind:'cancelled', reason}) + return true；接入 3 个边界：① markRunning 前（queued→running 边界）② 配额校验后、maintenance-scan dispatch 前（pre-dispatch）③ scanForFindings 后、writeFindings 前（maintenance-scan pre-write，长扫描中途 cancel 不留半写 findings）；(a7) **测试**：`apps/web/tests/agent-cancel.test.ts` 14 测覆盖：3 集合完备性 + 6 status 全分类 + 3 happy path（queued/running/cancelling）+ 5 拒绝路径（not-found / unauthorized / done / error / cancelled）+ 2 优先级保证（ownership 先于 terminal、not-found 先于 ownership）；apps/web **255→269 测全 PASS**；agent-worker job-types test 5→6 status 同步；**全 workspace typecheck PASS**；(a8) STATUS §2 ADR-0008 row Evidence Tier 更新 cancel 子能力 `mock → real`（HTTP route 真在 + state machine 真验 + worker poll 三边界真接，agent_job_event 'cancelled' 真 emit）；ADR-0008 §7 review log 追 A2 段。**剩余 Wave A**：A3 AgentExecutionContext schema 扩 + A4 AgentTimeline.tsx 渲染 agent_job_event 树。

上次更新：2026-05-11（claude/phase5-wave-a-quota-enforcer，**Phase 5 Wave A A1 — quota-enforcer 落地**）。补 ADR-0008 §122 承诺 + CLAUDE.md §5.7 红线"agent 必须有 quota + timeout + 可中断"中 quota 维度。落地：(d1) `infra/drizzle/migrations/0013_agent_quota.sql` 加 `agent.quota_per_day integer NOT NULL DEFAULT 50` + 新表 `agent_invocation_log (id, triggering_principal_id, kind, created_at)` + 复合索引（principal, kind, created_at DESC）；Drizzle schema 同步 `agentInvocationLog` + `DbAgentInvocationLog` 类型导出；(d2) `packages/ai-runtime/src/quota-enforcer.ts` —— 纯逻辑核心 `checkAndConsumeQuota({counter, principalId, kind, quotaPerDay, now})`：rolling 24h window count → 超 quota 返回 `{allowed:false, currentCount, limit, resetAt}` 不消耗；否则 `counter.log()` 后返回 `{allowed:true, currentCount: n+1}`；伴 `QuotaExceededError`、`enforceQuotaOrThrow`、`createDbQuotaCounter(db)` PG 适配器（select count + insert + earliestIn 三方法走 `agent_invocation_log` 表）；invariant 校验 quotaPerDay >= 0；(d3) `apps/web/src/app/api/agent/invoke/route.ts` 前置接入：principalId + kind 拿到后立即 `checkAndConsumeQuota(DEFAULT_QUOTA_PER_DAY=50)`，超 quota 返 429 + `Retry-After` 头 + `error: quota-exceeded` + `currentCount/limit/resetAt` body + `agent.invoke.quota_blocked` observability 事件；(d4) `apps/agent-worker/src/index.ts` `handleOne` 在 `markRunning` 后、`try` 块前防御式再校验：超 quota → `markError(jobId, 'quota-exceeded', msg)` + `appendEvent({kind:'error', errorClass:'quota-exceeded', errorMessage:...})` + `return`（不走 invokeAgentViaPlugin）；(d5) **测试**：`tests/quota-enforcer.test.ts` 11 测覆盖默认 50 / 边界 50 个允许 / 51 个拒绝 / 24h window 滑动 / (principal,kind) 分区 / 单 agent override quotaPerDay=5 / killswitch quotaPerDay=0 / 负数 invariant throw / resetAt 计算 / QuotaExceededError 结构化字段；rejected 调用 **必须不消耗** counter（quota reset 语义保鲜）；ai-runtime **113→124 测全 PASS**；apps/web 255 + agent-worker 26 + **全 workspace typecheck PASS**；(d6) STATUS §2 ADR-0008 row Evidence Tier 更新 quota 子能力 `mock → real`（PG counter 真起，rolling window 真生效；cancel API 仍 `mock` 等 A2）；ADR-0008 §7 review log Phase 5 Wave A A1 追条。**剩余 Wave A**：A2 cancel API（`POST /api/agent/job/<jobId>/cancel` + worker `callTool` 前 poll `cancelling`，1-2 天）→ A3 AgentExecutionContext 扩 → A4 AgentTimeline.tsx。

上次更新：2026-05-11（main，**Phase 4.5 W0-W2 execution: codex review 验证 + 议会综合迭代方案**）。承接 `.codex-review/REVIEW-2026-05-11.md`（codex 项目级评审 247K tokens）+ `.codex-review/COUNCIL-2026-05-11.md`（5 角色议会综合迭代方案）：(d1) **W0.1** `apps/web/src/lib/inline-agent-menu.ts` 删除 `ChipMode` 重复 export（line 62 与 line 29 同义 type alias）—— codex review 唯一 hard fact bug 闭环；(d2) **W0.2** STATUS §2 ADR 表新增 Evidence Tier 列（`real / mock / contract / mixed`），按 codex review honesty deficit table 重写 16 ADR caveat 句，移除"PASS"一词模糊性；(d3) **W0.3** 新增 `apps/web/src/lib/provider-resolver.ts` + `/api/agent/invoke` 接入 ADR-0013 §2.4 resolver 4-tier（document_model_override / user_model_pref / manifest_hint / env-default）——pre-W0.3 route 仅读 ANTHROPIC_API_KEY env，post-W0.3 走 `resolveAndInstantiateProvider`，observability 加 `providerSource` + `userConfigured` 字段；(d4) **W0.4 + W2.1** 新增 `plan0/phase-5-trigger.md`（5 候选 trigger 评估 + W2.1 决议选 Trigger A 双语论文协作 + 6 个硬验收信号 + 4 个明确 deferred）——回应议会 blind spot；(d5) **W0.5** STATUS 新增 §12 Codex review 验证记录段（5 risks 逐条 hard fact vs soft 框架判断分类 + 议会综合建议吸纳 / 推迟 / 拒绝表）；(d6) **W1.1** `packages/doc-store/` 业务代码 `.yDoc` 反射清零——DocumentHandle 加 `encodeDelta(baseStateVector)` 抽象方法，`commit.ts` 用 `isHandle` discriminator + `encodeStateVectorOf / encodeDeltaOf / applyUpdateTo` helper 替代 `toYDoc` polymorphic；`seed.test.ts` byte 断言改 `handle.encodeStateAsUpdate()`；types.ts JSDoc 显式列 3 个 integration boundary 例外（sync/setup × 2 + y-sweet backend）+ grep gate；**业务代码 `.yDoc` 命中 = 0**（doc-store 17 + editor-core 78 测试全 PASS）；(d7) **W1.2** ADR-0001 加 §8 Phase 4 / Phase 4.5 implementation review log——校正 §5.D "1-2 周可切 CRDT" → **2-3 周**（不撤销原承诺，校正估时），主要被 3rd-party PM binding / sync 协议 / 持久化吃掉；(d8) **W2.2** 新增 `plan0/phase-5-wave-a-scope.md` 5 W 反推（doc-store helper / export real snapshot / onboarding / provenance audit / Wave A 收尾）+ 4 个明确 deferred（ADR-0008 / 0012 / 0014 / 0010 复活条件锚定到具体 trigger，不是时间）。**全 workspace typecheck**：apps/web baseline 2 个 layout.tsx React 19 ReactNode 错误（pre-existing，议会 Contrarian §"反对全清"列例外），其余 workspace 全 PASS；ChipMode 重复 + provider-resolver typecheck clean。**Codex 5 risks 处置**：1 hard fact（ChipMode）已修；2 soft 框架（ADR-0008 quota / ADR-0014 multi-subdoc）STATUS Evidence Tier 三态化吸收；1 hard fact（ModelProvider 主路由）helper 接通；1 soft 框架（Design grep 命中）保留 SoT 范围 = `components/design/` 拒绝全清。

上次更新：2026-05-11（claude/phase4-closeout，**P4(19) W10.7 9-surface design compliance audit + globals.css 补全 + ShareDialog → StatusPill**）。承接 W10.8（commit `9ded9ae`）的 8 SoT components 落地：(d1) `apps/web/src/app/globals.css` 补全 W10.8 报告缺的 utility class —— `.btn-link` / `.btn-size-{sm,md,lg}` / `.mono-disc-{sm,md,lg}` / `.is-disabled` / `.block-hover-rail{,-btn,-visible}` / `.rule-{dashed,thick-dashed}` / `.citation-popover{,-body,-author,-title,-detail,-doi,-doi-link,-actions}` / `.provenance-card{,-cap,-actor,-actor-name,-actor-time,-detail,-intent,-prompt,-tools,-meta,-hash,-model,-cost}` / `.margin-entry-{head,body,foot,monogram,actor,time,meta}`，全部走 `var(--color-*)` / `var(--font-*)` / `var(--space-*)` / `var(--radius-*)` token，0 hex / 0 Tailwind palette；globals.css 317 → 693 行，class 选择器 12 → 54。(d2) 5 surface compliance audit + 硬编码迁移：Editor (34 → 0)、Maintenance (11 → 0)、Settings(+models +plugins) (6 → 0)、orgs/new (1 → 0)；invite/[id] 文件不存在（Phase 5 follow-up）。Editor 子组件（InlineAgentMenu / RevisionInbox / RevisionDiff / ExportDrawer / ShareDialog / editor-client）全部去 zinc-50/100/200/300/700/800/900 + amber-50/100 + emerald-50/100 + red-50/100 banner + rounded-md/lg；改用 SoT `<Button variant=primary|ghost|link>` / `<HairlineRule />` / `<StatusPill>` / `<MonoDisc>` 或 inline `var(--color-*)` 内联样式。(d3) **W6.5 ShareDialog amber/emerald banner → StatusPill**：webhook OK → `status=applied 邮件已发送 · Mail dispatched`，fallback → `status=blocked 邮件未配置 · Mail unsent`，错误 → `borderLeft accent-ox` + 中英斜体；helper `share-dialog-fallback.ts` 的 `tone: 'amber' | 'emerald'` 留作向后兼容（W6.5 20 unit test 不动），仅 JSX 颜色映射改写。(d4) Maintenance severity badge 4 色（red/amber/blue/zinc filled）→ StatusPill 3 状态（high/medium → blocked / info → proposed / low → applied）+ `severityToPillStatus` helper 抽到 `lib/maintenance.ts`；severity 行加 `<MonoDisc kind="agent" monogram="M">`（提示 finding 来自 maintenance-scan agent）。**Design.md reject grep 全 5 surface 实际命中 0**（diff 内剩余 6 命中全在我新加的 W10.7 改动注释里），255 web 测试全 PASS（含 W6.5 20 + W10.8 32），typecheck 4 baseline 错误（apps/web layout React 19 ReactNode + lib/inline-agent-menu Duplicate ChipMode，预先存在）不变。剩余 invite/[id] surface + auto-fix-bot 集成留 Phase 5 W10.7 follow-up。

上次更新：2026-05-11（claude/phase4-closeout，**P4(15) Design.md + editorial design system refactor**）。Claude Design 给出 9-surface 低保真线框稿（bundle `TOywn3TlXABHckELmx7iLw`），用户 chat 决策：editorial 风格胜出（OWL 出局），中文 lead、light only、accent triad（ink-blue=AI / oxblood=human / moss=community）、provenance reveal 作 delight moment。本次落地：(d1) `plan0/Design.md` 16 节单一来源 design spec（tokens / 字体阶梯 / 组件清单 / 9 surface 准则 / reject criteria 13 条 / wireframe 与 production 偏离表）；(d2) docs list 从 SaaS table 重写到 hairline list（200px collections aside + `<ol>` 索引 4 列 grid + 序号 onum mono + 编辑相对时间 + 双语模式 label）；(d3) (app)/layout 顶 chrome 改用 `--color-paper` + `--color-hairline` + `--color-ink-2` token，去 zinc / `bg-white`；(d4) login + signup 改成 ORCID 优先 + serif `开始一篇论文 · start a paper` hero + paper 输入框 + `--accent-ox` error；ORCID iD chip 保留 brand 标记。globals.css `@theme inline` editorial token 已在 P4(13) 一并落（paper / ink / hairline / accent triad / serif·sans·mono 三族 + `.btn-primary` `.btn-ghost` `.mono-disc` `.pill` `.margin-entry` `.label-cap` `.rule` 编辑性原子）。剩余 5 surface（/docs/new、/maintenance、/settings、/orgs/new、/invite/[id] + editor）按 Design.md §13 Phase 1 必做项分批迁移。

上次更新：2026-05-10（claude/update-docs-jvHKl，**Phase 4 W4 closeout + W1/W2 settings UI + W5 subdocument 启动**）。本分支 8 commits：(d1) README 重写 + CLAUDE.md 工作指南；(d2) USER_GUIDE 升级到 Phase 4 W4 视角（4 agent + 7 export + claim/evidence + Plugin/MCP/BYO）；(d3) SELF_HOST 升级（4 进程 + agent-worker 启动 + BYO model env vars + bwrap prereq + §9 进程拓扑图）；(d4) plan0/ADR-INDEX 导航（依赖图 + phase gate 时间线 + 主题聚类 + 阅读顺序）；(d5) **P4(7): W4 maintenance scan 残 3 finding kind** —— `scanContradictedConclusions` 纯 SQL（claim 有 `evidence.relation='challenges'` 且无 `claim_link link_type='synthesizes'` 来自 synthesis-typed claim 的 resolution）+ `scanDuplicatedClaims` 纯 SQL exact-text-match（GROUP BY text HAVING count > 1，每个 group 展开为 N findings + `details.otherClaimIds[]`；语义/embedding 推 Phase 5 vector index）+ `scanBrokenCitations` 注入式 `DoiResolver` 接口（生产 wire 到 `httpDoiResolver` 走 doi.org HEAD redirect=manual + 8000ms timeout + 100/scan batch limit）+ apps/agent-worker dispatch 接 `httpDoiResolver` 默认 + `WorkerConfig.doiResolver` 测试注入 + 14 单元测试（7 finding + 7 doi-resolver）；**agent-worker 测试 12 → 26 PASS**；(d6) **P4(8): W4 dashboard UI** —— `/api/maintenance/findings` GET（按 vault 筛 + status/severity/kind/documentId 过滤 + severity 排序 + counts）+ `/api/maintenance/findings/<id>/transition` POST（vault 所有权校验 + 状态机校验 + 4 类 invalid 4xx）+ `/(app)/maintenance` Server Component 仪表盘（severity 颜色徽章 + 中文 kind 标签 + filter chip 计数 + 知悉 / 已修复 / 忽略 Server Actions + revalidatePath）+ apps/web layout 加导航 + 抽 `apps/web/src/lib/maintenance.ts` 共享 transition matrix（API + Server Action 同源校验）+ 12 单元测试覆盖 4 状态 × allowed 矩阵 + 6 拒绝路径。**apps/web 测试 23 → 35 PASS**；**全 workspace typecheck PASS**；(d7) **P4(9): W2 BYO model + W1 plugin install settings UI** —— `/(app)/settings/{models,plugins}` 仪表盘 + 4 API route（`GET/POST /api/settings/models`、`DELETE /api/settings/models/<id>`、`GET/POST /api/settings/plugins`、`DELETE /api/settings/plugins/<id>`）+ 抽 `lib/byo-model.ts`（4 wireFormat + 验证矩阵）+ `lib/plugin-install.ts`（manifest paste 预览 + capability prompt + sandbox 平台探测）+ `ai-runtime` top-level 加 7 个 install helper 导出（`buildCapabilityPrompt` / `buildSandboxDescriptor` / `buildLinuxBwrapArgs` / `buildInstallRowPayload` / `InstallRejectedError` 等）；W2 流程：填表 → `validateModelPrefInput` → INSERT user_model_pref；W1 流程：粘贴 manifest JSON → `previewManifest` 渲染 capability prompt → 用户勾选 → `buildInstallRowPayload` 校验 + INSERT plugin_install row；用户安全：`api_key_env_var` 字段只存环境变量名（密钥不落库；UI 标"已配置 / 未设"）+ capability superset 校验 + git URL https-only 校验。**apps/web 测试 35 → 56 PASS**（+13 byo-model + 8 plugin-install）；**全 workspace typecheck PASS**；(d8) **P4(10): W5 subdocument 启动 backend** —— migration 0011 `subdocument` + `crossref_index` 两张新表 + `block_metadata.subdocument_id` + `document_acl` PK 重构（surrogate `id` + (`document_id`, `principal_id`, `subdocument_id`) `NULLS NOT DISTINCT` 唯一索引）+ `capability_resource_type` enum 加 'subdocument' 第五档；Drizzle schema 同步；`packages/permissions/acl-loader.ts:materialiseRoleBundle` 加 `subdocumentId` 可选参数（root 兼容默认 null）；`packages/editor-core/src/subdocument/` 加纯 PM JSON walker：`detectSubdocBoundariesByH1` 按 heading-1 切 + Preamble 兜底 + ord 0..N-1 + "Section N" 空标题 fallback；`extractCrossRefs` 4 类 ref 提取（citation / dataset → kind=citation / figure / claim / evidence）+ (kind, target, sourceBlockId) 去重 + 跳过无 enclosing block；14 单元测试。**editor-core 测试 29 → 43 PASS**（+7 detectSubdocBoundariesByH1 + 7 extractCrossRefs）；**全 workspace typecheck PASS** —— `scanContradictedConclusions` 纯 SQL（claim 有 `evidence.relation='challenges'` 且无 `claim_link link_type='synthesizes'` 来自 synthesis-typed claim 的 resolution）+ `scanDuplicatedClaims` 纯 SQL exact-text-match（GROUP BY text HAVING count > 1，每个 group 展开为 N findings + `details.otherClaimIds[]`；语义/embedding 推 Phase 5 vector index）+ `scanBrokenCitations` 注入式 `DoiResolver` 接口（生产 wire 到 `httpDoiResolver` 走 doi.org HEAD redirect=manual + 8000ms timeout + 100/scan batch limit）+ apps/agent-worker dispatch 接 `httpDoiResolver` 默认 + `WorkerConfig.doiResolver` 测试注入 + 14 单元测试（7 finding + 7 doi-resolver）。**agent-worker 测试 12 → 26 PASS**；**全 workspace typecheck PASS**。Phase 4 推迟项：W1 dogfood gate（bwrap 真启动 require Linux）+ W2 dogfood gate（4 endpoint round-trip require API key）+ W3 端到端真 multi-agent 跑通。ADR-0011 6 finding kind 全部交付（5 SQL-pure + 1 网络）→ §7 review log 加 W4 末 closeout；ADR-0012/0013 维持 **Proposed**；ADR-0014/0015 起草 **Proposed**，分别 W5-W6 / W8 dogfood gate 后 promote。)

---

## 1. 当前阶段

**Phase 0：✅ 完成**（6/6 交付物，3 个原型实证，4 个 ADR 落地）

**Phase 1：✅ 完成**（10/10 交付物 D7–D16，5 个 ADR 全部 Accepted，2 篇用户文档，1 个 Phase 2 plan stub）

**Phase 1.5：✅ 完成**（7/7 patch 全部 close；见 `plan0/phase-2-plan-stub.md §二`）。

**Phase 2：✅ 完成** —— W1-W7 全部交付：
- W1: mcp_server 表 + plugins 骨架 + ADR-0006/0010
- W2: AgentPluginModule 契约 + 等价性测试 + agent_job 表 + apps/agent-worker stub
- W3: dogfood gate 三项 criteria 全 PASS（plugin path 正确性 / 第三方 tmpdir / no internal-only API）
- W4: molab-protocol 6 kind postMessage + Figure.sourceCellId + cell auth-token JWT
- W5: ADR-0011 + Claim/Evidence schema + 2 PM block container + inline-editor 切 plugin
- W6: import-typst + import-latex + auto-fix 三 scaffold 包
- W7: Evidence Map API + AI context pack export 路由

**Phase 2.5（工程对接 + 真服务实测）：6/7 工程对接已交付**（剩 3 项依赖真服务推 dogfood 环境）。spike 结论：Typst.ts WASM **推 Phase 3+ 重测**；Loro **继续 Yjs through Phase 3**（subdocument trigger 时再评估）。

**Phase 3：✅ backend 完成（W1-W7 schema + scaffold + closeout 4 件）**。详见 `plan0/phase-3-plan-stub.md` + `plan0/phase-4-plan-stub.md`：
- W1+W2: source + source_extraction PG schema + source-extractor plugin（PDF.js / readability 真 ingestion 流水线 + Source Reader UI 推 Phase 4 W4）
- W4: maintenance_finding PG 表 + scan job descriptor（real scan logic + LLM "duplicate detection" 推 Phase 4 W4 实施）
- W5: ADR-0012 plugin sandbox 设计 + plugin_install PG 表（migration 0010）；Bubblewrap + capability deny e2e 推 Phase 4 W1 dogfood gate
- W6: coordinator handoff types + dispatch 工具（parseCoordinatorDecision + dispatchSyncHandoffs，9 单元测试）+ agent_job.parent_job_id 字段；LLM dispatch loop 推 Phase 4 W3
- W7: ADR-0013 ModelProvider abstraction + 4 adapter（anthropic / openai-compat / ollama / custom-http）+ user_model_pref + document_model_override PG 表；4 endpoint 真 round-trip 推 Phase 4 W2 dogfood gate
- 推迟：W3 Draft Composer（dogfood-trigger）+ W8 spatial canvas spike（前端）

**Phase 4：启动**（`plan0/phase-4-plan-stub.md` W1-W10）。本会话已交付 W1-W4 backend + 2 新 ADR：
- W1 (ADR-0012): plugin install backend + settings UI — capability prompt + 沙箱描述符（bwrap arg vector / macOS sandbox-exec 占位 / Windows AppContainer 占位）+ install row 校验（capability superset / https-only git-url）+ 13 单元测试（backend）；`/(app)/settings/plugins` 粘贴 manifest → 预览 capability prompt → 勾选 → 安装；`GET/POST /api/settings/plugins` + `DELETE` uninstall；`lib/plugin-install.ts` 共享 `previewManifest` + `filterAcceptedCapabilities` + 8 单元测试（UI）；dogfood gate 真 bwrap 启动 + git clone + tarball SHA 推 W1 末 require Linux host
- W2 (ADR-0013): provider resolver + settings UI — 4 档优先级 lookup（document-override > user-pref > manifest-hint > env-default）+ manifest schema 加 `prefers_provider` 字段 + coordinator-agent manifest 已声明长上下文偏好 + 9 单元测试（backend）；`/(app)/settings/models` 增删 user_model_pref + ENV 兜底状态显示；`GET/POST /api/settings/models` + `DELETE`；`lib/byo-model.ts` 共享 `validateModelPrefInput` + 4 wireFormat 默认值预设 + 13 单元测试（UI；密钥从不入 PG —— 行只存 env-var 名）；4 endpoint 真 round-trip dogfood gate 推 W2 末 require API key
- W3 (ADR-0008): coordinator real loop — `runCoordinatorLoop` 多步 dispatcher（sync + async 混合 / scratchpad / `[final]` 终止 / maxSteps 硬停 / allowedAgentKinds 过滤）+ 7 单元测试（真 LLM 端到端推 W3 末）
- W4 (ADR-0011): maintenance scan worker + dashboard UI — **6 finding 生成器全部交付**（5 SQL-pure: unsupported-claim / outdated-source / unverified-ai-block / contradicted-conclusion / duplicated-claim + 1 网络: broken-citation 经注入式 DoiResolver / `httpDoiResolver` 走 doi.org HEAD）+ apps/agent-worker 路由 maintenance-scan job kind + WorkerConfig.doiResolver 测试注入 hook + dashboard `/(app)/maintenance` Server Component（severity 排序 + filter chip 计数 + 知悉/已修复/忽略 Server Actions）+ 2 API endpoint（GET findings + POST transition）+ 抽 `lib/maintenance.ts` 共享 transition matrix + 21 + 12 单元测试（agent-worker 14 finding/doi-resolver + apps/web 12 transition）
- W5 (ADR-0014): subdocument 启动 backend — migration 0011 落 2 新表（`subdocument` + `crossref_index`）+ `block_metadata.subdocument_id` 列 + `document_acl` 重构（surrogate id PK + 三元组唯一索引 NULLS NOT DISTINCT）+ `capability_resource_type` 加 'subdocument' 第五档 + `materialiseRoleBundle` subdocumentId 可选参数；editor-core 加 `detectSubdocBoundariesByH1` + `extractCrossRefs` 纯 PM JSON walker（14 单元测试）；W5-W6 dogfood（50 客户端 + cross-doc ref 真同步 + ACL 真生效）推 W5-W6 末（require sync-gateway 重路由 + snapshot-worker 增量改造 + 真多 subdoc Yjs 挂载）
- 起草 ADR-0014 / ADR-0015：subdocument 章节级拆分（W5-W6 启动 backend ✅；dogfood gate 推后）+ 开放同行评审 ORCID（W8）

**Phase 4 W6-W10 closeout（Council 评审驱动重排，2026-05-10/11）**

`plan0/improvement-plan-2026-05.md` Council 评审给出新 W6-W10 范围（替换原 W7 fork-merge / W8 spatial / W9 跨设备 / W10 Loro 评估）。21 笔 commit 落定：

- **W6 表层 to 现实** — W6.1 AgentPanel inline rewrite（`6c2676a`）/ W6.2 新建文档 3 模板（`824617d`）/ W6.3 DOI 一键引用（`bee3257`）/ W6.4 cjk-spacing 标点 fix（`d093e6a`）/ W6.5 ShareDialog email fallback UI（`fd6fa1b`）
- **W7 抽象债堵漏** — W7.1 `packages/doc-store/`（`a2c0ff0`，堵 ADR-0001 §5.D）/ W7.2 plugin contract `provider: ModelProvider`（`d0e2a61`，堵 ADR-0013 §2.5；Anthropic SDK 调用 = 0）/ W7.3 acl-loader bulk INSERT（`b67be58`）/ W7.4 provenance batch（`5cc8565`）
- **W8** — plugin install UI 非 Linux 拦截 + URL/paste 双轨 + Provenance card（`b76a59a`）；ORCID 真 OAuth 集成 + Login/Signup Design.md §6.5（`91f06d8`）
- **W9** — 5 dogfood gate CI workflow + sandbox 子集 + cross-ref-sync owner = snapshot-worker（ADR-0014 §5）+ dogfood-report-2026-05.md（`09b6b63`）：G4 maintenance 全 sandbox PASS；G1/G2/G3/G5 contract / mock 全 PASS
- **W10** — globals.css editorial token v1（`d654040`）+ 8 SoT design 组件（`9ded9ae`）+ 9-surface compliance audit（`7f9c638`，5 surface reject grep 全 0；globals.css class 12→54）+ README rewrite（`7e7326b`）+ Council 评审基线（`45cb96c`）+ improvement-plan + Design.md 对齐（`f490376`）

**测试基线（Phase 4 W6-W10 累计 +220 测试）**：typography 22→24 / permissions 44→48 / ai-runtime 100→111 / editor-core ~32→78 / docstore 0→17 / snapshot-worker 6→17 / agent-worker 12→26 / apps/web 23→255

**Phase 5+ 推迟项**：bwrap Linux CI runner（W9 G1）/ 4 endpoint API key dogfood（W9 G2）/ 真 multi-agent goal（W9 G3）/ subdocument 50 客户端 stress（W5-W6 + W9 G5，require sync-gateway 多 subdoc 路由）/ macOS sandbox-exec 真写（Phase 5 W1，当前 W8 UI 拦截兜底）/ invite/[id] surface（W10.7 follow-up）/ Provenance reveal delight 动效（Phase 5 Wave A）/ Phosphor icon（Phase 5）/ AgentTimeline + quota enforcer + cancel API（Phase 5 Wave A，CLAUDE.md §5.7 红线）/ Claim-on-Claim Review prototype（Phase 5 Wave B，5 年差异化锚点）/ 元 dogfood + alpha tester 招募（Wave C）

**砍 / 推 Phase 6+**：spatial canvas / 章节 fork-merge UI / Loro 切换评估 / 跨设备 storage / plugin marketplace（improvement-plan §四，每条复活条件）。**新 ADR moratorium** 直到 0012/0013/0014 真 promote；例外：ADR-0016 Claim-on-Claim Review（Phase 5 Wave B）。

---

## 2. ADR 状态

> **Evidence Tier**（Phase 4.5 W0.2 新增，回应 codex review 2026-05-11 §2）：
> `real` = 端到端真 round-trip / 真客户端实测 / 真 binary spawn / 真 e2e
> `mock` = fixture-driven 或 stub fetch 单测，行为 shape PASS 但无真实依赖
> `contract` = 类型契约 + 单元测试 + CI workflow 就绪，未跑过真依赖
> `mixed` = 子能力分别命中不同 tier（见 gate 列细节）
>
> Promote 到 **Accepted**（无 caveat）的最低门槛 = 至少 1 个核心子能力达 `real`；
> **Accepted with caveat** = `mock` 或 `contract`，caveat 句中必须显式说明哪些子能力差 `real`。

| ADR | 标题 | 状态 | Evidence Tier | gate |
|---|---|---|---|---|
| 0001 | 数据模型 & CRDT/Postgres 拆分 | **Accepted** | real | D3 dual-tab Playwright 自动化 ✅；D16 加 Phase 1 implementation review log §7；**Phase 4.5 W1.1 加 §8 review log**（doc-store `.yDoc` 业务代码反射清零 + grep gate；§5.D "1-2 周可切 CRDT" 实测校正为 **2-3 周**——主要被 3rd-party PM binding / sync 协议 / 持久化吃掉，**不撤销原承诺，校正估时**）|
| 0002 | 权限模型（Capability + Principal） | **Accepted** | real | D8 + D9 + D14 + D15 实施 ✅；D16 promote + 加 §8 review log |
| 0003 | 技术栈锁定（11 项 + 双管线渲染） | **Accepted** | real | D7–D15 全部用本 ADR 11 项栈，无中途切换；D16 promote + 加 §9 review log |
| 0004 | 部署拓扑 + 安全基线 | **Accepted** | mixed | D16 直 Accepted；6 进程拓扑 + secrets / TLS / CORS / CSP / 备份基线（SELF_HOST 预算 1h `real`；30 min self-host 目标 `mock`——docs/SELF_HOST.md 显式列时长差） |
| 0005 | Render API 边界 | **Accepted** | mixed | D16 直 Accepted；PM JSON wire format + 5 emitter 签名锁定 `real`；export 路由从真实 Y.Doc snapshot 重建 PM tree `mock`（当前优先 `?content=<base64-pm-json>` override 或空 doc fallback，Phase 5 Wave A 补） |
| 0006 | MCP server 注册与发现 | **Accepted** | real | mcp_server PG 表 + registry.json seed + plugin loader 集成 W1-W3 全 PASS；§7 review log 记 W2 env-var → 注册表迁移完成 |
| 0007 | Computational cell embedding + iframe 协议 | **Accepted (with caveat)** | contract | molab-protocol 6 kind 类型化 + parseInbound/Outbound + Figure.sourceCellId attr + cell auth-token JWT 路由全 PASS；caveat: 真 molab.org iframe 端到端 e2e `real` 推 Phase 2.5（需 molab 实例可达） |
| 0008 | Long-horizon agent runtime + reviewer/researcher agent | **Accepted (with caveat)** | mixed | agent_job + agent_job_event 表 + apps/agent-worker pgboss subscribe stub 全 PASS（`contract`）；reviewer/researcher path 仍 `markDone` stub（`apps/agent-worker/src/index.ts:179-188` `mock`）；**Phase 5 Wave A 全 4 笔交付（2026-05-11）**：A1 quota enforce `real`（migration 0013 §1-§2 + quota-enforcer.ts PG counter + rolling 24h + (principal,kind) 分区 + invoke/worker 两层前置，11 测）；A2 cancel API `real`（migration 0013 §3 enum +'cancelling' + agent-job-cancel.ts validator + POST /cancel route + worker 3 边界 poll + 'cancelled' event variant，14 测）；A3 ExecutionContext 扩 `contract`（RetryRecord + 4 optional 字段 actualIterations/promptTokens/completionTokens/retries[]，5 contract test，JSON roundtrip 无损 + 不破现有 8 个 callers）；A4 AgentTimeline `contract`（agent-timeline.ts 纯 tree builder + orphan detection + cycle guard + rollups，GET /tree route，AgentTimeline.tsx 客户端组件，14 测）；reviewer/researcher path stub → 真 LLM round-trip 仍 `mock`（Wave B/D 跑通后 `real`）；caveat: reviewer/researcher 真 LLM round-trip 推 Wave B/D；A3/A4 字段填充由 W4-W7 真 invoke path 接手 |
| 0009 | Diff library + revision overlay UI + rebase semantics | **Accepted (Phase 0 spike + Phase 1 D14 实证)** | real | proto-d-diff-library spike + D14 acceptRevision 流程已实证 prosemirror-changeset 选型；Phase 2 W2-W3 实施未额外开 commit（已经在 Phase 1 D14 落地大部分 contributor 路径） |
| 0010 | 扩展系统边界 + Plugin API + Skill 元数据扩展 + Dogfood 路径 | **Accepted** | mixed | W3 dogfood gate 三项 criteria 全 PASS（`real`）+ W4-W5 follow-up inline-editor 切到 plugin 路径完成；caveat（codex §3）：user-installed plugin clone/extract/sandbox real spawn `contract`（registry 端到端走 plugin 表 + 沙箱真启动 Phase 5 Wave B） |
| 0011 | Claim/Evidence/Counterpoint/Synthesis 一等知识对象层 | **Accepted** | mixed | W5 schema + PM 节点 + W7 Evidence Map `real`；W4 6 finding 生成器交付，scan SQL `real` + reviewer/researcher 路径 `mock`（依 ADR-0008）；W9 G4 dogfood gate sandbox `real` 4/6 finding kind，剩 2 kind（unverified-claim / counterpoint-needed）`mock`；§7 review log 写 W7 + W9 dogfood criteria |
| 0012 | Plugin sandbox + 用户安装路径 + capability 提示 UI | **Accepted (with caveat)** | mixed | 起草 → Proposed → 2026-05-11 Accepted with caveat；Phase 4 W1 backend + 13 测（`contract`）；W4 W1 dogfood UI（capability prompt + sandbox descriptor）；**W8** 非 Linux 平台 UI 显式拦截（`real`：用户可见拒绝路径）+ URL/paste 双轨 + Provenance card capability prompt 风格；**W9 G1 bwrap dogfood CI** = `bwrap --version` smoke `real`，**真 plugin spawn 走 bwrap** `mock`（spec 在但 CI 未跑真启动）；caveat: bwrap 真启动 + macOS sandbox-exec 真写 `real` 推 Phase 5 W1（当前 UI 拦截兜底）|
| 0013 | ModelProvider abstraction + BYO 模型 + 配置存储 | **Accepted (with caveat)** | mixed | 起草 → Proposed → 2026-05-11 Accepted with caveat；Phase 3 4 adapter + 11 测（`contract` — stub fetch）+ Phase 4 W2 resolver 4 档 + 9 测（`contract`）；**W7.2 plugin contract `anthropic → provider: ModelProvider` 全切**（`real`：Anthropic SDK 调用次数 = 0；ai-runtime 105→111 测）；**W0.3（2026-05-11）`/api/agent/invoke` 接入 resolver 4-tier**（`apps/web/src/lib/provider-resolver.ts` + route.ts:112-128，document_model_override + user_model_pref + env-default `real`；manifest hint `contract` — 无 plugin 当前设置 `prefers_provider`；custom-http `mock` — 路由层无 serialize/parse 模板，归 plugin host mock fallback）；**W9 G2 CI matrix 就绪**（dogfood-providers.yml × 4 wire，`contract`）；caveat: 4 endpoint 真 round-trip `real` require API key secrets（ANTHROPIC / OPENAI / OLLAMA / CUSTOM_HTTP）|
| 0014 | Yjs subdocument 章节级拆分 + cross-reference sync | **Accepted (with caveat)** | mock | 起草 → Proposed → 2026-05-11 Accepted with caveat；W5 schema + W7.1 doc-store 抽象（DocumentHandle + YjsDocumentHandle + DocStore 缓存 + subdocument helper，17 测，`contract`，**doc-store 仍暴露 yDoc escape hatch** — Phase 4.5 W1.1 移除）；§5 dual-write owner 决策 = `apps/snapshot-worker`，W9 落 cross-ref-sync.ts（11 测：Y.Map.observe → PG crossref_index 增量 + reconcile 启动收敛，`mock` — fixture-driven）；**W9 G5 stress 5-25 client** `real`，**50 客户端 real stress + 真多 subdoc Yjs 挂载** `mock`（spec 在但 sync-gateway 无 multi-subdoc routing — codex §2 标 P1）；caveat: 50 客户端 + multi-subdoc routing `real` 推 Phase 5 W1（trigger 决定是否升级）|
| 0015 | Open peer review + ORCID-signed reviews | **Accepted (with caveat)** | mixed | 起草 → Proposed → 2026-05-11 Accepted with caveat；**W8.2 ORCID 真 OAuth 集成**（better-auth genericOAuth 复用，env 未配 ghost-disabled 替代 PROVIDER_CONFIG_NOT_FOUND，`contract`：env 未配走 ghost-disabled，env 配齐 `real` require sandbox.orcid.org client）+ Login/Signup Design.md §6.5 重 styling（`real`）+ 18 OAuth 测试（fakeOrcidTokenExchange，`mock`）+ §7.1 review log；caveat: 真 sandbox.orcid.org OAuth 回跳 + JWS detached signature 留 Phase 5 Wave B claim-review.sign（全 `real`）；review 一等对象表 + 三 capability（review.submit / publish / sign）落到 ADR-0016 Claim-on-Claim Review |
| 0016 | Claim-on-Claim Review — annotation on claim 的 ORCID-signed provenance lineage | **Proposed** | — | Phase 5 Wave B kickoff（2026-05-11 起草）：claim_review 表 + verdict enum (endorses/challenges/refines) + ORCID-sign 复用 ADR-0015 JWS pattern + 3 capability 新增 + maintenance finding 第 7 类 unverified-claim + Reviewer Inbox dashboard + lineage public DAG；新 ADR moratorium 例外；Wave B dogfood gate (1 篇双语 / 10 claim / 5 真 ORCID reviewer / 公共 DAG) 通过后 Accepted |
| 0017 | _Client-first runtime（预留，未起草）_ | — | — | client-first pivot 子 ADR（per memory `client_first_pivot_2026_05.md`）；待 Phase 6 起草 |
| 0018 | _Open content mechanisms（预留，未起草）_ | — | — | client-first pivot 子 ADR；待 Phase 6 起草 |
| 0019 | _Plugin runtime cross-platform（预留，未起草）_ | — | — | client-first pivot 子 ADR；待 Phase 6 起草 |
| 0020 | Night-Bridge-Day Triadic Architecture — 三层等价知识产出系统 | **Proposed** | — | Phase 5 W3+ 战略 ADR（2026-05-12 起草），横跨 Phase 5/6；ADR moratorium 例外（声明为战略 ADR，§0）；核心：三层等价产出（Night 草图/隐喻/反例/思想实验 → Bridge 概念验证/设计虚构/技术预印 → Day 论文/代码/政策）+ 5 创意触发模式 schema tags + 6 双向交互流 contract + 4 角色分化（Explorer/Bridge-builder/Validator/Connector）+ contribution-graph attribution 反 priority race；Phase 5 W3-W12 Wave D-1~D-5 渐进路线；W12 dogfood gate（jili 30 天 ≥50 Night + ≥10 Bridge + ≥3 Day promotion + 6 交互流至少触发 4 种 + 4 角色至少切换 2 个 + 5 创意模式分布 ≥4）通过后 Accepted；8 既有 ADR review log 待追加（0001/0002/0008/0010/0011/0014/0015/0016） |

---

## 3. Phase 0 交付物

| # | 名称 | 状态 | commit / 文件 |
|---|---|---|---|
| D1 | ADR-0001 数据模型 + 8 实体 schema | ✅ | `f051345` + `packages/schema/` |
| D2 | ADR-0002 权限模型 | ✅ | `41c39d1` |
| D3 | Prototype A（y-prosemirror 异构 schema） | ✅ | `453c61f` + `e4b9ed9` + `68a559b`（dual-tab 自动化） |
| D4 | Prototype B（MyST vs Typst CJK） | ✅ | `4ca72c0` |
| D5 | Prototype C（MCP + Skill + Provenance 闭环） | ✅ | `e99f2e0` |
| D6 | ADR-0003 技术栈锁定 | ✅ | `bb4059d` |
| — | 综合报告 | ✅ | `2d4d075` + `plan0/prototypes-report.md` |

**5 个假设答案**：H1 ✅ Y.Doc-as-tree + PG-as-graph / H2 ✅ Hybrid Provenance / H3 ✅ Capability + Principal / H4 ✅ Typst 印刷 / H5 ✅ molab iframe

---

## 4. Phase 1 交付物（10/10 ✅）

| # | 名称 | 状态 | 周 | 关键产出 |
|---|---|---|---|---|
| D7 | Postgres + Drizzle schema + migrations | ✅ | W1 | 13 表 + 18 round-trip 测；3 migrations |
| D8 | `packages/permissions` + `apps/sync-gateway` shim | ✅ | W1-W2 | 36 capability + 5 role bundle + JWT + WS gate（6 close codes） |
| D9 | `apps/web` Next.js 15 + better-auth + Principal bridge | ✅ | W2 | signup/login/session + Principal bridge（user/org/service） |
| D10 | `packages/editor-core` + snapshot worker | ✅ | W3 | 9 PM extension + paperSchema + commit serializer + Editor.tsx |
| D11 | y-sweet 自托管 + S3-compat 持久化 | ✅ | W2-W3 | BodyBackend 抽象（InMemory + YSweet）+ snapshot-worker |
| D12 | `packages/render-{myst, typst, typography}` | ✅ | W3-W4 | 5 格式导出（HTML/JATS/MD/Typst/PDF）+ CJK pre-pass |
| D13 | `mcp-servers/crossref` + `packages/ai-runtime` + 2 个 agent | ✅ | W3-W4 | real CrossRef MCP + Anthropic/mock runner + Provenance writer |
| D14 | Approval flow UI + commit boundary Provenance 联通 | ✅ | W4-W5 | RevisionInbox + 3 endpoints (accept/reject/modify) + approval_chain |
| D15 | 两人协作 E2E + 双语 demo + 投稿格式导出 | ✅ | W5 | tests/e2e（22.8s PASS）+ specimen-bilingual + USER_GUIDE/SELF_HOST |
| D16 | ADR-0004/0005 + 升 Accepted + Phase 2 plan stub | ✅ | W5 | ADR-0004 + ADR-0005 + ADR-0001/2/3 review log + phase-2-plan-stub |

详见 `plan0/phase-1-execution-plan.md` 与 各 ADR 的 Phase 1 implementation review log。

---

## 5. 仓库结构（当前）

```
collaborationtool/
├── apps/prototypes/           # Phase 0 三原型 + Phase 2 spike（proto-d）
│   ├── proto-a-yjs-schema/    # y-prosemirror 异构 schema + Playwright e2e
│   ├── proto-b-cjk-render/    # MyST vs Typst 对比
│   ├── proto-c-mcp-skill/     # MCP + Skill + Provenance 闭环
│   └── proto-d-diff-library/  # ⭐ Phase 2 W2 spike — prosemirror-changeset vs diff-match-patch + rebase 语义实证（ADR-0009 实证基础）
├── packages/schema/           # 8 实体 single source of truth（11 个 .ts，~330 LOC）
├── packages/permissions/      # ⭐ D8/D9 — 36 capability vocab + 5 role bundles + JWT + ACL loader + Principal bridge
├── packages/editor-core/      # ⭐ D10 — TipTap 9 extensions + paperSchema + commit serializer + Editor.tsx + sync-gateway transport
├── packages/typography/       # ⭐ D12 — CJK pre-pass: spacing + smart-quote-by-lang + font tokens
├── packages/render-myst/      # ⭐ D12 — PM JSON → MyST AST → HTML/JATS/Markdown
├── packages/render-typst/     # ⭐ D12 — PM JSON → Typst source + typst CLI compile wrapper
├── packages/ai-runtime/       # ⭐ D13 — skills loader + MCP client set + Anthropic/mock runner + Provenance writer + 2 agents
├── apps/sync-gateway/         # ⭐ D8/D11 — WebSocket capability gate + InMemory/YSweet body backends + y-sweet HTTP client
├── mcp-servers/crossref/      # ⭐ D13 — real CrossRef HTTPS MCP server
├── apps/web/                  # ⭐ D9/D10/D12 — Next.js 15 + better-auth + Editor + /api/sync-token + /api/export/<docId>/<format>
├── apps/snapshot-worker/      # ⭐ D10/D11 — periodic Y.Doc snapshot service + y-sweet HTTP fetcher
├── templates/                 # ⭐ D12 — myst/default style baseline (Phase 1.5: full mystmd templates mirror)
├── infra/                     # ⭐ D7/D9/D11 — docker-compose (Postgres 16 + MinIO + y-sweet) + Drizzle
│   ├── docker/                # docker-compose.yml + postgres-init/
│   └── drizzle/               # 13 + 7 better-auth 表 schema + 2 migrations + 18 round-trip tests
├── mcp-servers/crossref-mock/ # mock MCP server (CI / 离线 demo 保留)
├── skills/citation-lookup/    # Anthropic-style SKILL.md
├── tests/e2e/                 # ⭐ D15 — Playwright two-author MVP spec (HTTP-driven)
├── docs/                      # ⭐ D15 — USER_GUIDE.md + SELF_HOST.md
└── plan0/
    ├── adr/                   # 5 个 ADR（0001/02/03/04/05 全 Accepted）
    ├── phase-0-execution-plan.md
    ├── phase-1-execution-plan.md
    ├── phase-2-plan-stub.md   # ⭐ D16 — Phase 2 kickoff 前必看（待答开放问题）
    ├── prototypes-report.md   # ⭐ D16 加 §5.5 Phase 1 close-out
    ├── paper-platform-system-prompt.md
    └── paper-platform-landscape.md
```

---

## 6. 关键命令

```bash
# 一次性安装
pnpm install

# Phase 0 / proto-a：双 tab 自动化（CI gate）
pnpm proto-a:e2e            # Playwright headless，3/3 PASS / 0 warning，~52s

# Phase 0 / proto-a：本地 dev（双 tab 手动）
pnpm proto-a:sync           # terminal 1：y-websocket relay
pnpm proto-a:dev            # terminal 2：Vite

# Phase 0 / proto-a：CRDT 收敛压力测试
pnpm proto-a:stress         # 5 client × 50 ops，250 ops 全收敛 / 0 warnings

# Phase 0 / proto-c：MCP + Skill + Provenance 端到端 demo
pnpm --filter @collaborationtool/proto-c-mcp-skill demo            # mock 模式
pnpm --filter @collaborationtool/proto-c-mcp-skill demo:dump       # 含完整 Provenance JSON
ANTHROPIC_API_KEY=sk-... pnpm --filter @collaborationtool/proto-c-mcp-skill demo:dump  # 真 API

# Phase 1 / D7：Postgres + Drizzle
pnpm db:up                  # docker compose up -d Postgres 16
pnpm db:migrate             # 应用 migrations（idempotent）
pnpm db:seed                # 写入 seed fixtures（service principal / demo user / citation agent）
pnpm db:test                # 18 个 round-trip 测试（需 DATABASE_URL）
pnpm db:typecheck           # tsc --noEmit
pnpm db:down                # 停 Postgres

# Phase 1 / D8：permissions + sync-gateway
pnpm perms:test             # 60 个 permissions 测试（含 PG 集成 + bridge）
pnpm perms:typecheck
pnpm gateway:dev            # tsx watch（需 SYNC_TOKEN_SECRET）
pnpm gateway:start          # 生产模式
pnpm gateway:test           # 30 个 E2E + unit + env 测试
pnpm gateway:typecheck

# Phase 1 / D9：apps/web
pnpm web:dev                # next dev（需 BETTER_AUTH_SECRET + SYNC_TOKEN_SECRET）
pnpm web:build              # next build
pnpm web:start              # next start
pnpm web:typecheck
pnpm web:test               # 23 个单测（observability 8 + ORCID 8 + mailer 3 + invitation 4）

# Phase 1.5 #1：document-level invitation（替代 SQL grant）
# UI 入口：编辑器右上角 [分享 / Share] 按钮（要 capability.grant 权限）
# 邮件 backend：MAIL_WEBHOOK_URL 设了 → POST webhook；未设 → 链接 print 到 stderr

# Phase 1 / D10：editor-core + snapshot-worker
pnpm editor:test            # 21 个 schema/wire/commit round-trip 测试
pnpm editor:typecheck
pnpm snapshot:tick          # 单次 snapshot 扫描（CLI）
pnpm snapshot:start         # daemon（YSWEET_URL 时走 y-sweet HTTP）
pnpm snapshot:test          # 11 个测试（5 PG 集成 + 6 y-sweet 源 mock）
pnpm snapshot:typecheck

# Phase 1 / D11：y-sweet + MinIO 自托管
pnpm db:up                  # 起 docker-compose（Postgres + MinIO + y-sweet）
# YSWEET_URL=http://localhost:8080 + YSWEET_AUTH=... 切换 gateway 至 YSweetBackend

# Phase 1 / D12：渲染三剑客
pnpm typo:test              # 22 个 CJK / smart-quote / font tokens 测试
pnpm render-myst:test       # 24 个 PM-to-AST + HTML + JATS round-trip 测试
pnpm render-typst:test      # 17 个 source generation + escape 测试
# 端到端导出（GET /api/export/<docId>/<format>）：html / jats / markdown / typst-source / pdf
# PDF 需要服务器装 typst CLI；其他格式纯 TS

# Phase 1 / D13：AI runtime + agents
pnpm ai-runtime:test        # 9 个测试（D14 加 4: reject/modify/list + 已有 accept）
pnpm mcp-crossref:test      # 10 个测试（7 wrapper mocked-fetch + 3 stdio bin 子进程冒烟）
# 真 CrossRef stdio：CROSSREF_MCP_COMMAND=tsx CROSSREF_MCP_ARGS='["mcp-servers/crossref/src/bin.ts"]' pnpm web:start
# 端到端 invoke：POST /api/agent/invoke kind=citation|inline-editor
# 无 ANTHROPIC_API_KEY 时自动走 mock runner（CI / 离线均可跑）

# Phase 1 / D14：approval flow
# revision.proposal_metadata jsonb 存 fragments + uncertainties
# GET /api/revision?docId=... + POST /api/revision/<id>/{accept,reject,modify}
# UI: RevisionInbox + RevisionDiff（按 capability 显示）

# Phase 1 / D15：two-author E2E + bilingual specimen + onboarding docs
pnpm e2e:test               # Playwright HTTP-driven full flow，~22s
# specimen: apps/web/public/demo/specimen-bilingual.{json,md}
# docs: docs/USER_GUIDE.md + docs/SELF_HOST.md

# Phase 2 / W2 spike：diff library 选型 + rebase 语义（ADR-0009 实证基础）
pnpm proto-d:demo           # 跑 base / reviewer-A / reviewer-B / 两种 rebase 场景，~3s
pnpm proto-d:typecheck

# 全 workspace typecheck
pnpm typecheck              # 15 packages 全 PASS
```

---

## 7. 已知 Phase 1 工作项（来自 prototypes findings）

合计 12 项；详细在 `plan0/prototypes-report.md §5` + 各 prototype `findings.md` 末尾：

**proto-a 缺口（4）**：clock-skew uuidv7 collision / NodeView caching / schema-recovery monitoring / y-websocket → sync-gateway 切换

**proto-b 缺口（3）**：mystmd template 镜像 / language-naive smart-quote / 字体打包

**proto-c 缺口（5）**：PM steps 真实序列化 / approval UI / prompt registry 表 / 网关 capability 检查 / approval chain 填充

---

## 8. 公开问题（用户决策需要）

来自 `phase-1-execution-plan.md §九`，Phase 1 D16 收尾时的实际处理：

1. 部署 target → ADR-0004 §2.1 锁定单 host docker-compose（Phase 1） + Vercel/K8s 留 Phase 2
2. 字体 → Source Han + Noto CJK，OFL，docker image apt-get（USER_GUIDE §1）
3. demo 论文方向 → bilingual specimen（500 字中英混排，跨学科风格；apps/web/public/demo/specimen-bilingual.{json,md}）
4. 第二位测试用户 → e2e fixture（HTTP-driven 注册第二个 user 而非真人）
5. 默认 LLM → ANTHROPIC_API_KEY 时 Claude Sonnet 4.6（ai-runtime/src/agent-runner.ts）；缺失时 mock runner
6. MCP server 范围 → CrossRef real（D13）+ crossref-mock（CI fallback）；Zotero OAuth 推 Phase 2
7. better-auth org → Principal kind='org' bridge → `principal-bridge.ts:createOrgPrincipal` 已实现
8. ORCID 登录 → 推 Phase 1.5（phase-2-plan-stub §二 #2）

新一轮开放问题已转入 `plan0/phase-2-plan-stub.md §三`（Phase 2 kickoff 前必答）。

---

## 9. 风险红绿灯（Phase 1 收尾结案）

| ID | 风险 | Phase 1 结果 |
|---|---|---|
| R1 | better-auth API 不稳 | 🟢 closed — D9 集成无重大 bug；drizzle-orm 0.45 升级解决 peer-dep |
| R2 | y-sweet 自托管运营 | 🟢 closed — docker-compose 路径打通；Phase 4 horizontal scale 重新评估 |
| R3 | mystmd template 镜像滞后 | 🟢 closed — D12 走自写 MyST emitter，未引入 mystmd CLI；Phase 1.5 可选 |
| R4 | Typst.ts WASM bundle 太大 | 🟢 closed — 服务端 typst CLI 默认（D12） |
| R5 | PM steps 序列化边角 case | 🟢 closed — D10 commit serializer 21 round-trip 测试；D13/D14 ai-runtime 17 测试 |
| R6 | Phase 1 一个月预算超出 30% | 🟢 closed — D7-D16 在 5 周内完成 |
| R7 | LLM API 成本 | 🟢 closed — mock 默认；ADR-0004 §2.7 quota 规划 |
| R8 | y-prosemirror schema-recovery 在生产 | 🟢 closed — D10 + D15 全程无 silent-drop |
| R9 | better-auth org → Principal kind=org 不直接对应 | 🟢 closed — `createOrgPrincipal` D9 桥接 OK |
| R10 | docker-compose 用户机器不可重现 | 🟢 closed — SELF_HOST.md 实测沙箱 + 无 docker daemon path |
| R11 | 字体许可 | 🟢 closed — OFL 明确 |
| R12 | Phase 0 没预留的 schema 字段 | 🟢 closed — Phase 1 实际未发现 schema gap，D7 + D14 仅加 prompt_template + revision.proposal_metadata 两个非破坏字段 |

Phase 2 风险登记 → `plan0/phase-2-plan-stub.md` 起草 ADR-0007/8 时新建。

详见 `plan0/phase-1-execution-plan.md §八`。

---

## 10. 工作分支

| 分支 | 状态 | 用途 |
|---|---|---|
| `main` | ✅ 主线（Phase 0 已 merge） | — |
| `claude/review-project-plans-oRIn8` | merged via PR #1 | Phase 0 D1–D6 + 综合报告 |
| `claude/d3-websocket-strictmode-UfP6w` | merged via PR #2/#3 | proto-a D3 follow-ups + Playwright 自动化 |
| `claude/analyze-project-status-jZyUu` | merged via PR #4 | Phase 1 plan + STATUS + D7 + D8 + D9 + D10 + D11 + D12 + D13 + D14 + D15 + D16 (Phase 1 close-out) |
| `claude/review-project-status-w2iNI` | 当前 | Phase 1.5 #6 Real CrossRef stdio MCP |

---

## 11. Maintenance 注记

更新本文件的 trigger：
- 任何 commit 影响 ADR 状态
- 任何 D 启动 / 完成 / 砍掉
- Phase 推进
- 新风险出现 / 老风险红绿灯变化
- 任何用户决策（§8 开放问题）回答

不要在 PR 描述里复述 STATUS——本文件是 source of truth。PR 描述里 link 到 `STATUS.md` 的相关 section。

---

## 12. Codex review 2026-05-11 验证记录（Phase 4.5 W0.5）

> 输入：`.codex-review/REVIEW-2026-05-11.md`（gpt-5.5 medium effort, 247K tokens）
> 议会评议：`.codex-review/COUNCIL-2026-05-11.md`（5 角色：Architect / Pragmatist / Contrarian / Strategist / Minimalist）
> 目的：把 codex 的 5 risks 当 5 hypothesis 验证，区分 **hard fact** 与 **soft 框架判断**。

| # | codex 指控 | 验证方法 | 结论 | 类型 | 处置 |
|---|---|---|---|---|---|
| 1 | ChipMode 重复导出（`apps/web/src/lib/inline-agent-menu.ts:29 + :62`） | `pnpm web:typecheck` baseline 报 `TS2300 Duplicate identifier 'ChipMode'` | ✅ 完全成立 | **hard fact** | W0.1 已修，typecheck 不再报 |
| 2 | ADR-0008 long-horizon runtime 没 quota enforcer / cancel route | `grep -rn "quotaEnforce\|cancelRoute" apps/agent-worker/src` = 0；`grep -n "AgentJobStatus" apps/agent-worker/src/job-types.ts:84-90` 仅 `cancelled`，无 `cancelling` | ✅ 成立 | **hard fact** | §2 ADR-0008 行 Evidence Tier 改 `mock`，caveat 句加 P0 标；具体 enforcer/cancel route 设计推 Phase 5 Wave A（trigger 决定 wave 位置） |
| 3 | ModelProvider 主路由没接 resolver | `apps/web/src/app/api/agent/invoke/route.ts:112-121`（pre-W0.3） 仅 `ANTHROPIC_API_KEY` env 直读 | ✅ 成立 | **hard fact** | W0.3 已修：新增 `apps/web/src/lib/provider-resolver.ts` + route 接 `resolveAndInstantiateProvider`，4-tier `document_model_override → user_model_pref → manifest_hint → env-default` 真生效；observability 加 `providerSource / userConfigured` 字段 |
| 4 | Subdocument 50-client real stress 没跑过 | `tests/e2e/specs/dogfood-stress.spec.ts:64-70` 明确 50-client deferred；sync-gateway 无 multi-subdoc routing | ✅ 成立 | **hard fact** | §2 ADR-0014 行 Evidence Tier 改 `mock`，caveat 句明示 50-client + multi-subdoc routing `real` 推 Phase 5 W1（**议会 Strategist + Minimalist 一致认为不应主动启动专项；Phase 5 trigger 决定**）|
| 5 | Design.md reject criteria 仍有命中（`docs/new/page.tsx` + `Editor.tsx:117-128`）| `grep -nE "bg-zinc-(50\|100\|200\|900)\|rounded-(md\|lg\|xl)\|border-zinc-" apps/web/src/app/\(app\)/docs/new/page.tsx packages/editor-core/src/Editor.tsx` 命中确实存在 | ⚠️ **soft 框架判断** | **soft** | 议会 Contrarian §"反对全清"：`docs/new` 是占位创建表单、`Editor.tsx` 是 editor-core 的 React 包——Design SoT 范围 = `apps/web/src/components/design/`；不在 SoT 范围内命中 ≠ Design SoT 违例。**处置**：保留范围 = `components/design/` + `editor/[docId]/components/`，`docs/new` + `Editor.tsx` 显式列例外；Phase 5 Wave A 起若有 trigger 强制再扩 |

**额外验证（议会指出的 codex blind spot）**：
- codex 没抓到 — `apps/agent-worker/src/index.ts:132-149` reviewer / researcher 路径 markDone stub —— 这意味着 W9 G4 maintenance scan dashboard "real PASS" 仅覆盖 4/6 finding kind（剩 2 kind 为 `mock`）。§2 ADR-0011 行 Evidence Tier 改 `mixed` 反映此事。
- codex 没抓到 — STATUS / ADR caveat 句过去把 "contract"、"mock"、"real" 混在一个 "PASS" 里。W0.2 已把 §2 拆三态。
- codex prompt 写 "挑刺优先于赞美"，所以把 *honest caveat* 升级成 *deficit*——议会 Contrarian §"反对最流行的解读"。这是 reflexive effect，不计入 hard fact 列。

**议会综合建议 → 本周已采纳 / 推迟 / 拒绝**：

| 议会建议 | 状态 | 备注 |
|---|---|---|
| ChipMode 删 | ✅ 采纳（W0.1） | hard fact |
| STATUS 拆三态 | ✅ 采纳（W0.2） | 直接堵 codex 4 条软指控 |
| ModelProvider 接主路由 | ✅ 采纳（W0.3） | 低成本高 leverage |
| 起草 PHASE-5-TRIGGER.md | ⏳ 进行中（W0.4） | 议会 5 角色一致认为是 blind spot |
| doc-store yDoc removal | ⏳ 进行中（W1.1）| 议会 Architect 单选 P1；Phase 4.5 一件实证展示 |
| 不开 1.5 周专项 Phase 4.5 | ✅ 采纳 | 议会 Pragmatist + Minimalist + Contrarian 三票反对 Strategist 全开 |
| 全清 Design grep 命中 | ❌ 拒绝 | 议会 Contrarian §"反对全清"——保留范围，显式列例外 |
| ADR-0008 quota enforcer 本周做 | ❌ 推迟 | 议会 Pragmatist + Minimalist + Strategist 三票认为应跟 Phase 5 trigger 绑定，不独立 P0 |
| ADR-0014 50-client stress 本周做 | ❌ 推迟 | 议会 Strategist 指出 Phase 5 改进计划已把 spatial canvas / 章节 fork-merge 砍 / 推到 Phase 6+；deferred 是正确选择 |

**结论**：codex 5 risks 经议会 + grep 验证后，1 条已直接修（ChipMode），2 条由 STATUS 三态化吸收（ADR-0008 / 0014），1 条新增 helper 接通（ModelProvider），1 条拒绝全清（Design grep——保留范围）。议会 blind spot（Phase 5 trigger）落 W0.4 + W2.1 + W2.2。
