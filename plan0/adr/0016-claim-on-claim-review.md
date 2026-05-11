# ADR-0016: Claim-on-Claim Review — annotation on claim 的 ORCID-signed provenance lineage

- **Status**: Proposed
- **Date**: 2026-05-11
- **Phase**: 5 Wave B
- **Deciders**: tech-lead
- **Gated on**: Phase 5 Wave B dogfood gate（1 篇双语论文 / 10 claim /
  5 真 ORCID reviewer / 每人 ≥3 verdict + 1 challenge with counter-
  evidence / 公共视图渲染 review DAG 无错）

---

## 1. Context

### 1.1 起因 — "5 年差异化锚点"

`plan0/improvement-plan-2026-05.md §三 Wave B` 明确：Phase 5 不再加新
维度，唯一新功能 = **Claim-on-Claim Review**：

> Reviewer 不是新角色，是 annotation on claim 的 ORCID-signed provenance
> lineage。

这是项目相对 Curvenote / MyST / Quarto / Notion 的 5 年差异化锚点：
不是又一个"协作论文 SaaS"，而是**可验证的 claim 级评审 DAG**——每条
claim 都能追溯它被哪些 ORCID 实体 endorse / challenge / refine，验证
链条独立于本平台可读。

### 1.2 与既有 ADR 的关系

- **ADR-0011 Claim/Evidence**：本 ADR 是 claim 的二阶层——别人对你 claim
  的"判断"（verdict）。不动 claim / evidence 表 schema；加新表
  `claim_review`。
- **ADR-0015 Open peer review + ORCID**：document-level review 是
  one-per-cycle 大粒度；claim_review 是 fine-grained，1 paper 可有
  N×M 条（N claims × M reviewers）。复用 ORCID 签名机制（
  `signed_payload_jws` 模式），不复用 review 表（不同生命周期 + 不同
  状态机）。
- **ADR-0008 reviewer agent**：AI reviewer 已 Accepted，可产 claim_review
  rows 但 `reviewer_orcid_id` 为 NULL + UI 显式标"AI suggestion"区分；
  本 ADR Wave B4 引入 `unverified-claim` finding（claim 只有 AI verdict
  无人类 endorsement > 30 天）。
- **ADR-0002 capability**：加 3 词汇 `claim.review:create` /
  `claim.review:read` / `claim.review:withdraw`，进 reviewer + author
  bundle。
- **ADR-0014 subdocument**：subdoc-level claim 自动支持（claim_id 是全局
  uuidv7，跨 subdoc / doc / 仓库 共享）。

### 1.3 哲学约束（第一性原理）

1. **Provenance 即一等数据**（§11）→ 每条 claim_review 必有
   `provenance_id`（即使没 ORCID 签名也得有内部审计链）
2. **不锁定**（§1）→ `signed_payload_jws` + canonical JSON 让第三方
   ORCID JWKS 独立 verify；review DAG export 跨平台可读
3. **AI 是协作者不是侧边栏**（§3）→ AI verdict 合法但显式标记
   `is_ai_verdict = true`，UI 视觉与人类 verdict 区分
4. **可演化性 > 当下完备**（§10）→ verdict enum 起步 3 态
   (endorses / challenges / refines)；Phase 6 不动 enum，加 jsonb
   `verdict_meta` 列容纳子语义（"endorses with caveat" / "challenges
   methodology only" / "refines scope"）

### 1.4 这是一项底层、Phase 5 Wave B 锁定的决策

**严格度高**：
- claim_review row 一旦 ORCID-signed + published 即视为不可变（withdraw
  仅 mark，不删除）
- verdict enum 数量 = 3，加第 4 个需要 schema migration 而非 plugin
  扩展（避免 enum 漂移）
- 与 ADR-0011 evidence.relation 同名 verb（`challenges`）**故意**：
  evidence.relation 描述"证据→claim"的支撑关系，verdict 描述"reviewer→
  claim"的判断关系，actor 不同但语义谱系一致

---

## 2. Decision

### 2.1 新表 `claim_review`

```sql
CREATE TYPE claim_review_verdict AS ENUM (
  'endorses',     -- reviewer 同意该 claim 成立
  'challenges',   -- reviewer 不同意该 claim 成立（必须有 evidence_refs）
  'refines'       -- reviewer 部分同意但要求范围 / 限定调整
);

CREATE TABLE claim_review (
  id text PRIMARY KEY,                       -- uuidv7
  claim_id text NOT NULL REFERENCES claim(id) ON DELETE RESTRICT,
  reviewer_principal_id text NOT NULL REFERENCES principal(id) ON DELETE RESTRICT,
  reviewer_orcid_id text,                    -- nullable: AI reviewer / 未 link ORCID 的人类
  is_ai_verdict boolean NOT NULL DEFAULT false,
  verdict claim_review_verdict NOT NULL,
  body_markdown text NOT NULL,               -- reviewer 论述（必填，光给 verdict 不够）
  evidence_refs text[] NOT NULL DEFAULT '{}',-- evidence.id[]；challenges verdict 强制非空
  -- ORCID detached signature (复用 ADR-0015 §2.2 pattern)
  signed_payload_jws text,
  orcid_signed_at timestamptz,
  signature_verified_at timestamptz,
  signature_algorithm text,                  -- 'RS256' typical
  -- Provenance audit (ADR-0001 §2.3.7)
  provenance_id text NOT NULL REFERENCES provenance(id) ON DELETE RESTRICT,
  -- Lifecycle
  submitted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,                  -- withdraw 仅 mark，不 DELETE
  withdrawn_reason text,
  -- Phase 6 forward compat
  verdict_meta jsonb                          -- 子语义；起步留空
);

CREATE INDEX claim_review_claim_verdict_idx
  ON claim_review (claim_id, verdict)
  WHERE withdrawn_at IS NULL;
CREATE INDEX claim_review_reviewer_idx
  ON claim_review (reviewer_principal_id, submitted_at DESC);
CREATE INDEX claim_review_orcid_idx
  ON claim_review (reviewer_orcid_id)
  WHERE reviewer_orcid_id IS NOT NULL;
CREATE INDEX claim_review_provenance_idx
  ON claim_review (provenance_id);
```

**强制 invariants**（trigger 或应用层校验，二选一）：
- `verdict='challenges'` ⇒ `array_length(evidence_refs, 1) >= 1`
- `is_ai_verdict=true` ⇒ `reviewer_orcid_id IS NULL AND signed_payload_jws IS NULL`
- `signed_payload_jws IS NOT NULL` ⇒ `reviewer_orcid_id IS NOT NULL AND orcid_signed_at IS NOT NULL`

Phase 5 用应用层校验（`packages/permissions` capability bag + service
layer），DB trigger 推 Phase 6+（避免一次性引入 PL/pgSQL 维护负担）。

### 2.2 PM mark `claim-review-anchor`

```ts
// editor-core/extensions/claim-review-anchor.ts
Mark.create({
  name: 'claim-review-anchor',
  attrs: {
    claimId: string,
    verdictBuckets: { endorses: number; challenges: number; refines: number },
    latestReviewerOrcidId: string | null,    // 最新 reviewer ORCID（用于 hover preview）
  },
  parseHTML / renderHTML — 渲染为 inline span，
  CSS：根据 verdictBuckets 不同显示 3 色小条码（accent-moss=endorses,
       accent-ox=challenges, accent-ink=refines），accent triad SoT
});
```

**Mark 而非 Node**：claim-review 是 claim 的**装饰**而非内容（claim
内容是 PM block container）；mark 跨 claim 边界无意义（一个 claim 一个
mark instance），但 mark 让 hover / click handler 与 inline citation
体验对齐。

**三视图**（Design.md §6 surface 准则一致）：
- Reviewer 视图：mark 高亮所有自己 endorse/challenge 的 claim
- Author 视图：每 claim 旁 margin entry 列出 verdict 统计
- 公共视图：claim 边缘小色条 + 点击展开 review DAG

### 2.3 API endpoints

```
POST   /api/claim/<claimId>/review
  body: {
    verdict: 'endorses' | 'challenges' | 'refines',
    bodyMarkdown: string,
    evidenceRefs?: string[],
    signedPayloadJws?: string  // optional at submit-time; sign step 后单独 PATCH
  }
  capability: claim.review:create
  → 201 { reviewId, provenanceId }

GET    /api/claim/<claimId>/reviews
  capability: claim.review:read (默认 commenter+)
  → 200 { reviews: ClaimReview[], aggregateBuckets: {endorses, challenges, refines} }

POST   /api/claim/<claimId>/review/<reviewId>/sign
  body: { orcidIdToken: string }  // OIDC id_token JWT
  capability: claim.review:create + ORCID linked
  → 200 { signedPayloadJws, orcidSignedAt }

POST   /api/claim/<claimId>/review/<reviewId>/withdraw
  body: { reason: string }
  capability: 仅 reviewer 自己
  → 200 { withdrawnAt }

GET    /api/claim/<claimId>/lineage
  capability: claim.review:read
  → 200 {
      claim: Claim,
      reviewDag: ClaimReview[],     // 按 submitted_at ASC
      evidenceChain: Evidence[],    // 所有 review evidence_refs 解引用
      orcidSignedCount: number,
      aiVerdictCount: number,
    }
```

**为什么 sign 单独 POST**：ORCID OAuth id_token 需要客户端走 OIDC 流程
拿到，submit-then-sign 比 one-shot 减少 race；也允许 AI verdict
（先 submit 不签）。

### 2.4 Capability 新增（ADR-0002 §2.2 39 → 42 词汇）

- `claim.review:create` — 提交 verdict（reviewer bundle 默认持有）
- `claim.review:read` — 读所有 review（commenter+ 默认持有；claim 本身可读 = review 可读）
- `claim.review:withdraw` — 撤回 review（reviewer 自主权；implementer
  显式校验 review.reviewer_principal_id === caller）

**不加** `claim.review:edit` —— ORCID-signed review 不可改（签名失效）；
要纠错就 withdraw + 重提。

### 2.5 状态机（per claim_review row）

```text
draft ──┬── ai-submitted (is_ai_verdict=true; no ORCID)
        │
        └── human-submitted ──┬── orcid-signed ──┬── withdrawn (terminal)
                              │                  │
                              │                  └── (immutable, published)
                              │
                              └── withdrawn (terminal)
```

`draft` 状态仅 in-flight（API submit 前的 UI 状态，**不入** PG）。
DB 视角：row 创建即 `submitted`；可选过 `orcid-signed`；可经 `withdrawn`
终止。

### 2.6 Maintenance scan 第 7 类 finding：`unverified-claim`

```ts
// 在 packages/schema/src/maintenance.ts maintenance_finding_kind enum 加
'unverified-claim'

// agent-worker scan logic (SQL-pure, 类似 Phase 4 W4 5 SQL-pure scans)：
//   FROM claim c
//   LEFT JOIN claim_review cr
//     ON cr.claim_id = c.id
//       AND cr.verdict = 'endorses'
//       AND cr.is_ai_verdict = false
//       AND cr.withdrawn_at IS NULL
//   WHERE c.created_at < now() - INTERVAL '30 days'
//     AND cr.id IS NULL
//     -- 还要排查 provenance.actor_kind 全是 agent 的情况：
//     AND (SELECT COUNT(*) FROM provenance p
//          WHERE p.id = c.first_provenance_id  -- or claim provenance chain
//          AND p.actor_kind != 'agent') = 0
```

Severity = `medium`（claim 长期无人类 endorsement 不是 hard bug，是
"need human review" 信号）。

### 2.7 Reviewer Inbox dashboard（B5）

新 surface `/(app)/reviewer-inbox`：
- 列出所有 "open for review" claim（无 endorsing review > 7 天 OR 有
  `unverified-claim` finding）
- 一键 verdict button (`endorses` / `challenges` / `refines`) +
  body markdown editor + evidence picker（autocomplete from claim 已知
  evidence pool）
- 提交后自动跳 ORCID-sign 流程（已 link ORCID 用户）
- Filter: by topic / by reviewer-myself / by paper

不 Phase 5 做：reviewer reputation score / topic-based reviewer matching
/ cross-paper aggregate view（推 Phase 6+）。

### 2.8 Wave B6 review DAG public view

`/api/claim/<id>/lineage` 返回时间序的 `ClaimReview[]` + 解引用的
`Evidence[]`，前端渲染为：
- 主 claim 节点 + N reviewer 卫星节点
- 每 reviewer 节点显示 ORCID iD + verdict 颜色（accent triad）+ signed-at
  timestamp
- evidence 节点（reviewer 引用）虚线连回 claim
- 每节点点开看 `signed_payload_jws`（可复制粘贴去任何 ORCID JWKS 验证器）

### 2.9 Wave B dogfood gate criteria（Phase 5 W6 末闸门）

承 ADR-0010/0012/0014/0015 模式：

1. **真 paper**：1 篇双语论文 ≥ 10 个 claim
2. **真 reviewer**：邀请 5 位有 ORCID 学者；每人完成 ≥3 verdict + 1
   challenge with counter-evidence
3. **真签名**：JWS 用公开 ORCID JWKS 独立验证通过（不依赖本平台 verify
   route）
4. **review DAG 公共视图**：未登录用户访问 `/claim/<id>` 公开页能看到
   review lineage，所有 ORCID iD 可点击跳 ORCID profile
5. **withdraw 正确性**：reviewer 撤回 1 条 verdict 后，公开 DAG 仍显示
   withdrawn 标记 + reason，不删数据

不通过则停止 Wave C/D，重新设计 ADR-0016。

---

## 3. Consequences

### Good

- **5 年差异化锚点显形**：claim-level review DAG 是其他平台都没有的能力
- **AI ↔ 人类 verdict 显式区分**：dogfood "AI 提议 + 人类背书" 评审范式
- **claim 跨 doc 复用复用**：claim_id 是全局 uuidv7，A 论文的 claim 在
  B 论文被引用时 review 链条跟着跑
- **`unverified-claim` finding 给 author 引导**：30 天无人类 endorsement
  →主动找 reviewer 而非干等

### Bad / Trade-offs

- **schema 复杂度 +1**：又一张表 + 3 个 enum 值 + 4 个索引（vs ADR-0011
  现有 claim / evidence / claim_link 3 表已经不小）
- **ORCID 依赖**：sign 路径依赖外部 JWKS；网络中断 → degraded "signed-
  but-unverified" 标记（复用 ADR-0015 降级策略）
- **`evidence_refs` 软 FK**：text[] 而非 FK 数组（PG 弱支持）；删 evidence
  不级联清理 claim_review。需要 maintenance scan 第 8 类 finding 兜底
  （推 Wave D 看是否真需要）
- **Reviewer Inbox UI 是新 surface**：增加 9-surface → 10-surface；
  Design.md §6 须补一段（W5 工作）

### Neutral / Need watching

- verdict enum 起步 3 态可能不够细：观察 dogfood 是否有"无法分类"verdict 出现
- AI verdict 占比：若 ≥ 70% verdict 是 AI 生成，则 `unverified-claim`
  finding 阈值需调整（30 天 → ？）
- review DAG 渲染复杂度：100+ reviews 单 claim 时前端性能（推 Phase 5
  W6 实测，必要时分页）

---

## 4. Alternatives considered

### A. 复用 ADR-0011 evidence with relation 扩展

**拒绝**：evidence 表的 actor 模式是"论文作者引用证据"；review 的 actor
模式是"外部 reviewer 评判 claim"。强行复用 → evidence.created_by 会混
入"评审者"语义，污染既有 Evidence Map 渲染逻辑（evidence 应当是 claim
的论证，不该是"评判"）。

**何时回头**：dogfood 发现 reviewer 多半是在补 evidence 而非判断 →
退回到把 challenges verdict 改写为 evidence with relation='challenges'。

### B. 复用 ADR-0015 review 表（document-level）

**拒绝**：document-level review 是 once-per-cycle 大评审；claim-level
是 N×M fine-grained。强行复用 → review 表 visibility / decision /
author_response_thread 字段对 claim-level 都不适用；混合后 schema
语义混乱。

**何时回头**：dogfood 发现 reviewer 几乎从不针对单 claim 评，全在 paper
级 → 撤掉 claim_review，让所有 review 都走 document.review 模式。

### C. 用 annotation_thread{kind:'reviewer-note'} 扩展

**拒绝**：annotation_thread 是 inline 评论，多 comment / threaded reply；
claim-review 是 1-claim-1-reviewer 1-verdict 的 flat 关系。强行复用 →
threaded reply UI 与"判定 endorse vs challenge" UX 冲突；ORCID 签名
载荷不合适附在 thread 上。

### D. 不做 ORCID 签名，仅项目内 verdict

**拒绝**：丢失 5 年差异化锚点。ORCID 签名是这个 ADR 的**核心**而非
附加功能；去掉签名后退化为又一个"评论系统"。

### E. ORCID 强制（无 ORCID 用户不能 verdict）

**拒绝**：too aggressive。Phase 5 dogfood 范围内允许 non-ORCID 人类
verdict + AI verdict 共存；UI 标记区分；`unverified-claim` finding
按 ORCID-signed endorsement 数计算（不算 AI / 无 ORCID 人类）。

---

## 5. Decision log

- **2026-05-11**: improvement-plan §三 Wave B 锁 claim-review 为 5 年差异化锚点；新 ADR moratorium 在 Wave B kickoff 解禁
- **2026-05-11**: verdict enum 选 3 态 endorses / challenges / refines（per improvement-plan §125 B1）
- **2026-05-11**: evidence_refs 选 text[] 而非 FK array（PG 弱支持）；用 maintenance scan 兜底悬空引用
- **2026-05-11**: sign 与 submit 分两步 POST（非 one-shot）—— 允许 AI verdict 不签 + 真实 OIDC 流程需要客户端 OAuth dance
- **2026-05-11**: 不加 `claim.review:edit` —— ORCID-signed review 不可改（签名失效，withdraw+resubmit 是 only path）

---

## 6. References

- ADR-0011 §2.1-§2.3（claim / evidence schema 基线）
- ADR-0015 §2.2-§2.4（ORCID signed payload / JWS 模式 / visibility 矩阵）
- ADR-0008 §2.2（reviewer agent 具名 + 版本号；AI ↔ 人类区分）
- ADR-0002 §2.1（capability vocab 注册流程）
- `plan0/improvement-plan-2026-05.md §三 Wave B`（B1-B6 任务表 + dogfood gate）
- ORCID OAuth 2.0 OIDC: https://info.orcid.org/documentation/integration-guide/
- JWS RFC 7515: https://datatracker.ietf.org/doc/html/rfc7515

---

## 7. Phase 5 implementation review log

### 7.1 Wave B B1-B6 全交付（2026-05-12）

Wave B 6 笔 + kickoff 共 7 commits on `claude/phase5-wave-b-claim-review`
→ fast-forward 到 main：

- `dc0f4bd` B1：claim_review schema + 3 capability vocab + role bundles
- `f14666c` B2：PM mark `claim-review-anchor` + render emitters（MyST + Typst）
- `5697ea3` B3：claim-review API endpoints + service layer（5 endpoints）
- `4fee614` B4：maintenance scan 第 7 类 finding `unverified-claim`
- `4910613` B5：Reviewer Inbox dashboard `/(app)/reviewer-inbox`
- `18ec5eb` B6：public claim lineage view `/(app)/claim/[id]/lineage`

**§2.1-§2.9 全部落地**：claim_review 表 + 3 verdict enum + ORCID-sign 两步
POST + 3 capability vocab + maintenance-scan unverified-claim finding +
Reviewer Inbox + 公共 lineage DAG + dogfood gate spec。

**测试基线**：apps/web 255 → 327 PASS（+27 claim-review-service + 17
reviewer-inbox + 14 测覆盖 lineage page client-side filter）；editor-core
78 → 93 PASS（+15 claim-review-anchor mark）；render-myst 29 → 40 PASS
（+11 anchor accent class rule）；render-typst 17 → 18 PASS（+1 dominant
verdict underline）；agent-worker 26 → 31 PASS（+5 unverified-claim
scanner）；ai-runtime 113 → 129 PASS（Wave A 联动）。

### 7.2 Wave B dogfood gate（待跑）

§2.9 5 criteria 仍未跑完（需真 paper + 5 ORCID reviewer + JWKS 真验证 +
公共匿名 view 切换 + withdraw 正确性）。Phase 5 Wave C C1/C3 dogfood
（jili 亲自用平台写 plan0/ + 邀请学者）跑通后 review log 7.3 段填入：
(a) 5 criteria pass/fail；(b) ORCID JWKS 实测开销；(c) AI vs human verdict
比例；(d) withdraw 操作真实场景反馈。

跑通后 Status: **Proposed → Accepted**（或 Accepted with caveat）。

### 7.3 Phase 5 ADR-0020 Triadic 影响（2026-05-12）

ADR-0020 §1.3 把本 ADR 定位为 **Day 层 only 机制**：

> "Claim-on-Claim Review 仍然是 Day 层机制；Night/Bridge 层有自己的
> review/endorsement 机制（更轻量，per "好问题胜过好答案"原则）。"

**对本 ADR 的影响 — 零改动**：

- claim_review 表 / verdict enum / ORCID-sign 流程 / 3 capability 全部维持
  Day 层 only 语义。Night artifact 的 review 不走本 ADR 路径。
- Night/Bridge artifact 的"endorsement"在 ADR-0020 §2.5 ContributionGraph
  attribution 模型里（14 ContributionKind 含 `review`），是 artifact metadata
  级别的 review，不签 ORCID，无 verdict enum，无 maintenance scan unverified
  finding。
- Phase 6 follow-up ADR 若决定 Night/Bridge 也需要 ORCID-signed peer review
  机制（如 metaphor 的同行验证），届时考虑 generalise 本 ADR 而非另起；
  当前 Wave D-5 dogfood gate 没采集足够证据决定。

**叙事**：本 ADR 是"日科学的同行评审"的具体实现；Wave D-5 后将与"夜科学
的非正式 endorsement"（ContributionGraph）并存为三层等价产出的 governance
两翼。
