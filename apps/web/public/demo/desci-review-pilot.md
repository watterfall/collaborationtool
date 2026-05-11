# Claim-on-Claim Review: a 5-year anchor for desci collaboration
# Claim-on-Claim Review：去中心化科学协作的 5 年差异化锚点

*Type · 类型:* Bilingual review pilot · 双语评审 pilot
*Status · 状态:* Demo specimen (synthetic data; ORCID iDs are illustrative) ·
演示样张（合成数据；ORCID iD 为示例，不代表真实学者）
*Word count · 字数:* ~500 (EN) / ~500 (CN)
*Generated · 生成:* 2026-05-12 · Phase 5 Wave C C2

---

## Abstract · 摘要

> Curvenote, MyST, Quarto, and Notion all sit on the same flat axis: a
> document is a tree of paragraphs, optionally annotated. The
> Collaboration Tool's Phase 5 release introduces **Claim-on-Claim
> Review** — every research claim becomes a first-class object that
> carries its own ORCID-signed review lineage. This pilot demonstrates
> the data model through 5 illustrative claims, 2 reviewer verdicts,
> and an ORCID-signed challenge with counter-evidence.

> Curvenote / MyST / Quarto / Notion 都建在同一条扁平轴上：文档是段落树，
> 评审是注释。**Phase 5 引入 Claim-on-Claim Review**：每条研究 claim 都
> 是一等对象，自带 ORCID-签名的评审血统。本 pilot 用 5 条示例 claim、2
> 条 reviewer verdict 与 1 条带反例证据的 ORCID-签名挑战，演示这一数据
> 模型。

---

## 1. Background · 背景

:::claim{id="claim:pilot:c1" type="main" status="approved"}
**EN.** Open peer review platforms increase reviewer accountability
when they bind reviewer identity to a portable cryptographic
attestation (ORCID OAuth id_token, JWS detached signature) rather than
a platform-internal user id.

**CN.** 开放同行评审平台只有在把评审者身份绑定到可移植的密码学证明
（ORCID OAuth id_token、JWS detached signature）时——而不是平台内部账号
——才能真正提升 reviewer 责任感。
:::

> :::evidence{id="ev:pilot:e1" supports="claim:pilot:c1" relation="supports"}
> Tennant et al. ([2017]) review 7 open peer review pilot studies and
> find that signed reviews retain the same critical content as
> anonymous ones — the "fear of retaliation" hypothesis fails to show
> up in the data. ORCID-iD-anchored reviews further inherit the
> reviewer's cross-platform reputation.
>
> Tennant 等（2017）综述 7 项开放评审 pilot 研究，发现署名评审与匿名
> 评审在批评强度上无差异；"惧怕报复"假说在数据中找不到支持。ORCID-
> 锚定评审进一步承接了 reviewer 的跨平台声誉。
> :::

## 2. Phase 5 contribution · Phase 5 的贡献

:::claim{id="claim:pilot:c2" type="main" status="approved"}
**EN.** Attaching reviews to individual claims (rather than to whole
documents) collapses the "review thread vs review object" UX confusion
that Curvenote / MyST users hit with `annotation_thread` reuse. The
Collaboration Tool's `claim_review` table makes 1-claim-1-verdict
explicit at the schema level.

**CN.** 把评审挂到单条 claim（而非整篇 doc）上，能消解 Curvenote /
MyST 用户在 `annotation_thread` 复用时遇到的"评审线程 vs 评审对象"
UX 混淆。Collaboration Tool 的 `claim_review` 表在 schema 层就把
1-claim-1-verdict 显式化。
:::

:::claim{id="claim:pilot:c3" type="main" status="ai-suggested" confidence="high"}
**EN.** The 3-verdict enum (endorses / challenges / refines) captures
≥ 95% of reviewer judgments observed in the literature without
requiring per-domain customization.

**CN.** 3 态 verdict 枚举 (endorses / challenges / refines) 覆盖了文献
中观察到的 ≥ 95% reviewer 判断，无需按学科定制扩展。
:::

> :::evidence{id="ev:pilot:e2" supports="claim:pilot:c3" relation="qualifies"}
> The eLife 2023 sample of 1,200 open reviews (n=12 disciplines)
> classified verdicts into 4 buckets, of which "minor revisions" and
> "scope clarification" collapse cleanly into our `refines` literal.
> The remaining 4–6% are domain-specific ("ethics flag") — these will
> map to `verdict_meta` jsonb in Phase 6 rather than expanding the
> enum.
>
> eLife 2023 对 1200 篇开放评审（12 个学科）的 verdict 做了 4 类划分，
> 其中"minor revisions"与"scope clarification"可整洁地折叠进我们的
> `refines`；剩余 4-6% 是学科特定（如"伦理标识"）——Phase 6 走
> `verdict_meta` jsonb，不扩枚举值。
> :::

```{figure} desci-review-pilot-fig1.svg
:name: fig-claim-dag

图 1 / Figure 1: ORCID-signed review DAG for claim:pilot:c3 — two
endorsements (accent-moss), one ORCID-signed challenge with counter-
evidence (accent-ox), zero refines. Aggregate verdicts feed the
inline `claim-review-anchor` mark in the editor.
```

## 3. Provenance · 来源链

:::claim{id="claim:pilot:c4" type="counter" status="human-reviewed"}
**EN.** A 30-day human-endorsement window (the `unverified-claim`
finding threshold) under-flags fast-moving subfields and over-flags
slow archival ones. Phase 6 should tune by claim status or by claim's
parent corpus.

**CN.** 30 天人类背书窗口（`unverified-claim` finding 阈值）对快节奏
子领域漏报，对慢节奏档案领域过报。Phase 6 应按 claim status 或所在
语料的速度做差异化调参。
:::

> :::evidence{id="ev:pilot:e3" supports="claim:pilot:c4" relation="challenges"}
> A 90-day window in archival history of science would over-flag every
> claim in the corpus during typical Acta-Archaeologica review cycles
> (median time to first review ≈ 6 months). The 30-day default needs
> claim-type-aware tuning.
>
> 在科学史档案语料中，按 90 天窗口几乎全部 claim 会被过度标记（Acta
> Archaeologica 类期刊首轮评审中位耗时 ≈ 6 个月）。30 天默认值需要
> 按 claim 类型差异化调参。
> :::

:::claim{id="claim:pilot:c5" type="synthesis" status="approved"}
**EN.** When the `claim_review` table reaches > 100 verdicts per
claim, the public lineage view should paginate by verdict bucket
rather than by submission time — Phase 6 evaluation pending dogfood.

**CN.** 当 `claim_review` 表对单 claim 超过 100 条 verdict 时，公共
lineage 视图应该按 verdict bucket 分页而不是按提交时间——Phase 6
dogfood 后评估。
:::

## 4. Review verdicts · 评审 verdict

### Verdict 1 — endorses (illustrative · 示例)

- **Reviewer ORCID:** `0000-0002-1825-0097` (illustrative · 示例)
- **Verdict:** `endorses` · 同意
- **Signed at · 签名时间:** 2026-05-12T08:00:00Z
- **Body · 论述:**
  > **EN.** The 3-verdict enum maps cleanly to my own reviewer
  > workflow. I particularly like that `refines` is a first-class
  > literal — Curvenote's "request changes" + open-ended comment
  > thread is exactly the failure mode we're avoiding.
  >
  > **CN.** 3 态 verdict 与我的评审习惯吻合。`refines` 作为一等字面量
  > 尤其好——Curvenote 的"请求修改"+ 开放评论线程正是要避免的失败
  > 模式。

### Verdict 2 — challenges with counter-evidence · 带反例证据的挑战

- **Reviewer ORCID:** `0000-0003-1419-2405` (illustrative · 示例)
- **Verdict:** `challenges` · 挑战
- **Evidence refs:** `ev:pilot:e3`
- **Signed at · 签名时间:** 2026-05-12T09:30:00Z
- **Body · 论述:**
  > **EN.** Claim c4 already concedes the 30-day window is too short
  > for archival subfields; my evidence (ev:pilot:e3) makes the case
  > quantitatively. I'd push the default to 60 days as a baseline and
  > expose per-corpus tuning before Phase 6.
  >
  > **CN.** Claim c4 已经承认 30 天对档案子领域过短；我的证据
  > (ev:pilot:e3) 给出量化论据。建议默认 60 天，并在 Phase 6 前暴露
  > 按语料的差异化调参接口。

---

## How to verify the ORCID signatures · 如何独立验证 ORCID 签名

The two verdicts above are **illustrative**. In a real Phase 5 paper,
each verdict carries a `signed_payload_jws` field that any third
party can verify against ORCID's public JWKS:

上面两条 verdict 是**示例**。真实 Phase 5 论文中每条 verdict 都带
`signed_payload_jws` 字段，任何第三方都可用 ORCID 公开 JWKS 独立
验证：

```sh
curl -s https://orcid.org/oauth/jwks |
  jose jws verify --jwks /dev/stdin --input <(printf '%s' "$JWS")
```

This is the 5-year anchor: **the review's trustworthiness is not
contingent on the Collaboration Tool platform staying online.**
The JWS + the public claim text are enough.

这是 5 年差异化锚点：**评审的可信度不依赖 Collaboration Tool 平台
本身在线运行**——JWS + 公开 claim 文本就足够。

---

## Companion files · 配套文件

- `desci-review-pilot.json` — AI context-pack export shape (ADR-0011 §2.7)
- `desci-review-pilot-fig1.svg` — review DAG illustration (placeholder)
- `desci-review-pilot.pdf` — Typst-compiled PDF (generated externally)
