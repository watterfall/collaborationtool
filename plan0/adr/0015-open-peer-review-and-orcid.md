# ADR-0015: Open peer review + ORCID-signed reviews

- **Status**: Proposed
- **Date**: 2026-05-10
- **Phase**: 4 W8
- **Deciders**: tech-lead
- **Gated on**: Phase 4 W8 dogfood gate（公开评审 1 个真实 paper + ORCID
  签名核验通过 + reject-review 流程跑通）

---

## 1. Context

### 1.1 起因

essay §17 + §11.5 的核心承诺：开放、可验证、不被锁定的同行评审。Phase 1
ADR-0008 既有 reviewer agent；Phase 2 W5 ADR-0011 既有 annotation_thread
{kind:'reviewer-note'}。但都是**项目内闭环**——评审者身份是 better-auth
账户，不是学界承认的可验证 identity；评审无 signed audit；公开 vs 私有
没有明确语义。

Phase 4 W8 引入：
1. **ORCID 身份验证** — 评审者必须 link ORCID iD（论文学界标准 identity）
2. **Signed review** — 评审 commit 时 author 用 ORCID OAuth signing
   key 签名（不可抵赖、可第三方核验）
3. **公开 vs 私有** — author 可决定 published-paper 是否接受公开评审；
   reviewer 可决定本人 review 是否公开（独立于 author 选择）

不在 Phase 4 范围：reputation score / 评审者积分（推 Phase 5）。

### 1.2 与既有 ADR 的关系

- **ADR-0001 entity 8 表**：annotation_thread / annotation_comment
  原本足够，但缺 (a) 评审身份 ORCID 字段；(b) signed-review payload；
  (c) public vs private 标记。本 ADR 在既有表加字段 + 新表 review。
- **ADR-0002 capability**：加 `review.submit` / `review.publish` /
  `review.sign` 三个新 verb（36 → 39 词汇）；进 reviewer + author bundle
- **ADR-0008 reviewer agent**：AI reviewer 仍合法但**不能**签 ORCID（无
  人类 identity）；UI 区分 "AI suggestion" vs "human-signed review"
- **ADR-0014 subdocument**：subdoc-level review 自动支持（subdoc 是 ACL
  边界，review 写到 subdoc 内 thread）

### 1.3 哲学约束

1. **不锁定** → 评审 export bundle（JSON-LD + ORCID signature）让其他
   系统可 import；不依赖本平台才能查
2. **平台性头号** → 评审是一等对象（专属 review 表 + UI 区域），不是 PR
   review-as-comment 的简化
3. **避免过度抽象** → 不立刻做 reputation / score；等 Phase 5 dogfood 看
   是否真需要

---

## 2. Decision

### 2.1 ORCID 集成：better-auth provider plugin + ORCID OAuth 2.0

- 用户在 settings 页 link ORCID（既有 better-auth account linking 机制）
- 登录会话内可同时持有 better-auth uid + ORCID iD（双 identity）
- ORCID iD 写到 `principal.orcid_id` 列（新加字段，nullable；非 ORCID
  用户走原 better-auth 路径，不影响）

### 2.2 signed review：detached JSON-LD signature

- review 提交时序列化 `{reviewerOrcid, paperId, body, timestamp}` 为
  canonical JSON
- ORCID OAuth 提供的 `id_token`（JWT，RS256）作为 attestation；server 不
  carry signing key（避免 key 管理风险），仅 verify
- review row 持 `signed_payload_jws`（compact JWS） + `verified_at` —
  serialized 出库可被任何 ORCID JWKS-fetch 客户端独立验证

### 2.3 review 一等对象：新表 `review`

```
CREATE TYPE review_visibility AS ENUM ('private', 'authors-only', 'public');
CREATE TYPE review_decision AS ENUM (
  'pending',          -- 评审进行中
  'accept',
  'minor-revisions',
  'major-revisions',
  'reject'
);

CREATE TABLE review (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  reviewer_principal_id text NOT NULL REFERENCES principal(id) ON DELETE RESTRICT,
  reviewer_orcid_id text,                    -- nullable: AI reviewer 没有
  is_ai_review boolean NOT NULL DEFAULT false,
  decision review_decision NOT NULL DEFAULT 'pending',
  visibility review_visibility NOT NULL DEFAULT 'private',
  body_markdown text NOT NULL,
  signed_payload_jws text,                   -- ORCID id_token 作 detached signature
  signature_verified_at timestamptz,
  signature_algorithm text,                   -- e.g. 'RS256'
  submitted_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,                   -- visibility='public' 时戳
  withdrawn_at timestamptz,                   -- reviewer 撤回（不删，标记）
  withdrawn_reason text,
  -- author response side-channel；不放到 review 内避免单审视角
  author_response_thread_id text REFERENCES annotation_thread(id) ON DELETE SET NULL
);

CREATE INDEX review_doc_visibility_idx ON review (document_id, visibility);
CREATE INDEX review_reviewer_idx ON review (reviewer_principal_id, submitted_at DESC);
CREATE INDEX review_orcid_idx ON review (reviewer_orcid_id) WHERE reviewer_orcid_id IS NOT NULL;
```

### 2.4 visibility 策略矩阵

| author 设置 | reviewer 设置 | 实际可见性 |
|---|---|---|
| 论文私有 | 任意 | private（仅 author + reviewer） |
| 论文公开邀评 | private | authors-only（reviewer 不出名） |
| 论文公开邀评 | public | public（doc 公开页列出） |
| 论文撤稿 | 任意 | private（archive 但不公开） |

reviewer 永远可改自己的 review visibility（隐藏自己提的审 ≠ 删 review；
withdrawn_at 仅 mark）。

### 2.5 capability 新增（ADR-0002 §2.2 36 → 39 词汇）

- `review.submit` — 创建 review（reviewer 角色）
- `review.publish` — 把自己的 review 改 public（reviewer 自主权）
- `review.sign` — 走 ORCID 签名流程（reviewer 角色 + 已 link ORCID）

不加 `review.read`（既有 `block.read` + visibility 矩阵足够）。

### 2.6 W8 dogfood gate criteria

参考 ADR-0010/0012/0014 三项 criteria 模式：

1. **真 ORCID 端到端**：1 个测试 ORCID 账户 link 后能 submit signed
   review；JWS 用公开 ORCID JWKS 独立验证通过
2. **author reject-review 路径**：author 可标记一条 review "我不接受"
   （annotation_thread author_response 写 reason）；review 仍保留（不删）；
   read-only 标记显示
3. **withdrawn review 仍可查**：reviewer 撤回 review → public 页不显示但
   archived 视图（author + reviewer）仍可读；不删数据保 audit

不通过则停止 W9+，重新设计 ADR-0015。

---

## 3. Consequences

### 3.1 正面

- 评审可信度跃迁（ORCID-signed > 平台内账户）
- export bundle 让评审跨平台可读（不锁定）
- AI reviewer 与人类 reviewer 显式区分（is_ai_review 列 + UI badge）

### 3.2 负面

- ORCID JWKS 拉取依赖外部网络（缓存策略 24h 必要）
- ORCID outage 时 verify 不能通过 → 降级 "signed-but-unverified" 标
- review 表与 annotation_thread{kind:'reviewer-note'} 既有路径并存——UX
  上需明确"comment vs review"分流

### 3.3 长期债

- reputation score 推 Phase 5
- DOAJ / Crossref Event Data 互通推 Phase 5+
- 跨 paper 评审者历史聚合 view 推 Phase 5
- review 模板化（Nature submission style review template）推 Phase 5

---

## 4. Alternatives considered

### 4.1 复用 annotation_thread{kind:'reviewer-note'}（rejected）

**拒绝**：annotation_thread 是块级 inline；review 是文档级 once-per-cycle
评审。强行复用 → "thread 之 thread" 嵌套混乱；author response 流串到
评审 thread 与 inline comment 视觉不分。

### 4.2 用 X.509 / GPG 签名替代 ORCID（rejected）

**拒绝**：学界 identity 标准是 ORCID 不是 PGP；用户没有 GPG 学习曲线高；
ORCID OAuth 已是 OIDC 标准 JWT，技术成本低于自建 PKI。

### 4.3 web3 / ENS / decentralized identity（rejected）

**拒绝**：不是学术界既有共识；引入加密钱包 UX 摩擦；ORCID 是中立非营利，
满足 "不锁定" 哲学。

### 4.4 反对 AI review（rejected）

**拒绝**：ADR-0008 reviewer agent 已 Accepted；Phase 4 共存：AI 出
suggestion + human 出 signed review。is_ai_review 列让两者各自有 UI 显示。

---

## 5. Open questions（W8 实施时落实）

- **ORCID JWKS 缓存策略**：24h vs 7d；JWKS rotate 时缓存击穿？倾向 24h
  + cache fallback on rotate（公平 staleness）
- **author 驳回 review 是否需要 reviewer 回应**：单轮 vs 多轮？倾向单轮
  起步（author 写 reason，reviewer 可选回复一次，截止）
- **AI reviewer 是否生成 signed payload**：no — `is_ai_review=true` 时
  signed_payload_jws 为 null；UI 永远 explicit 标 "AI suggestion"
- **review export 格式**：JATS-Reviewer extension vs OpenAire FAIR vs
  COAR Notify？倾向 COAR Notify（W3C-aligned）但 W8 决策时再核
- **reputation 雏形预留**：本 ADR 不做但 review 表加 `quality_signal`
  jsonb 列预留？倾向不加（YAGNI）；Phase 5 加 ADR-0017 时新表

---

## 6. 与其他 ADR 的关系

- **ADR-0001**: review 是第 27/28 表（subdocument 之后）
- **ADR-0002**: 加 3 词汇 review.submit/publish/sign + reviewer bundle
- **ADR-0008**: reviewer agent 输出落到既有 annotation_thread{kind:
  'reviewer-note'}；本 ADR review 表是人类 + 完整 review 实体（更高层）
- **ADR-0011**: review body 可引用 claim/evidence；不互斥
- **ADR-0014**: subdoc-level review 自然支持（review.subdocument_id 字段
  Phase 4 W8 加；本 ADR §2.3 暂未加，留 W8 实施时补）

---

## 7. Review log

### 7.1 Phase 4 W8.2 — ORCID OAuth 真集成（pre-dogfood）

- **2026-05-11**: ORCID provider config + sign-in surface 落地。
- 路径决策：复用既有 `account.accountId WHERE provider_id='orcid'`
  作为 ORCID iri 的 source-of-truth，**不新增 `user.orcid_iri` 列**，
  也不做 0012 migration。理由：(a) better-auth genericOAuth 已自动写
  account 表；(b) `apps/web/src/lib/orcid-lookup.ts` 早就读这一列；
  (c) §2.1 提到 `principal.orcid_id` 留待 W8 真上 review.sign 时再决
  定（届时可能直接挂 `principal` 或经 review row 引用 account）。
- 测试：原 8 个 mapper unit test 升级为 18 测试覆盖 token 端点 shape /
  env-gating / round-trip 模拟（happy / error / malformed-id / sandbox-
  baseUrl）。真 OAuth 端到端待 W8 dogfood gate 配 sandbox.orcid.org
  client 后跑（criteria #1）。
- UI：Design.md §6.5 + §7（"Login·Signup ORCID 优先按钮 + email
  fallback · 不要两个等权 column"）落地为 1fr 1fr grid + 400px form +
  右侧 specimen quote；ORCID env 未配时按钮 ghost-disabled + 双语 hint
  替代 PROVIDER_CONFIG_NOT_FOUND 报错。
- §3.2 风险预警：ORCID JWKS cache 策略仍未实施（review.sign 落地时跑），
  当前阶段仅做 OAuth 登录，不签 review。

### 7.2 Phase 4 W8 dogfood gate（待跑）

（gate 三项跑通后填：(a) gate 三项 pass/fail；(b) ORCID JWKS 实测开销
+ cache 策略验证；(c) §5 5 个 open questions 答案；(d) AI vs human
review UX 反馈）
