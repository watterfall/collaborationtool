# ADR-0011: Claim / Evidence 一等知识对象层 + Evidence Map dependency graph

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 2 W5
- **Deciders**: tech-lead
- **Gated on**: Phase 2 W7 dogfood gate（单文档 Evidence Map demo + AI context pack export 必须可用）

---

## 1. Context

### 1.1 起因

2026-05-09 用户上传 `0e15c053-AI_Native_Knowledge_OS.md`（"AI Native
Knowledge OS：源证据驱动的知识编译器"，1180 行），整合分析落
`plan0/research/2026-05-09-knowledge-compiler-essay-integration.md`。

essay §3.2 诊断"对象缺口"：现有文档工具是页面中心，但真正被复用的是
更小的知识对象（claim / evidence / question / decision / source /
draft / artifact）。我们当前 PG 只有 Citation / Annotation /
Block-metadata 等"附属物"，**没有 Claim 这个核心知识对象**——一旦
同一论点跨文档复用，`block_metadata` 无法表达"这是同一 claim"。

essay §15 范例展示了目标形态：

```markdown
:::claim id="claim-001" confidence="high" status="reviewed"
Markdown will remain one of the strongest source formats...
:::

:::evidence id="evidence-001" source="source-obsidian-ecosystem"
Markdown is portable, Git-friendly, readable, and easy for LLMs to parse.
:::

:::counterpoint id="counter-001" source="source-html-artifact-essay"
Markdown is weak as a final interface for interactive explanation...
:::

:::synthesis id="synth-001"
The future is not Markdown versus HTML, but Markdown as durable source...
:::
```

### 1.2 与既有 ADR 的关系

- **ADR-0001**：本 ADR 在 8 实体之上**新增 3 实体**（claim / evidence /
  claim_link）；不动既有 8 实体定义
- **ADR-0002**：claim 接受同一 capability 模型（`block.read` / `block.propose`
  覆盖 claim CRUD；不新增 capability vocabulary 词条）
- **ADR-0010**：Plugin API 暴露 claim CRUD 给第三方 plugin 是 Phase 3 决策；
  Phase 2 仅内部使用（per integration doc §4.3 last item）

### 1.3 哲学约束（user 2026-05-09）

1. **避免过度兼容性** → essay 列了 7 对象，本 ADR **只接 2 个新对象**
   （claim + evidence）；counterpoint / synthesis 是 claim 的子类型不是
   独立对象；question / decision 推 Phase 3 评估
2. **平台性** → claim 全局唯一 ID（类比 Citation 的全局对象语义），跨
   文档可复用；plugin API 暴露推 Phase 3
3. **新技术敢上** → PM block 容器节点（含 paragraph 子树）而非 atom，
   编辑器内可富文本编辑 + 嵌入 citation-ref / inline-equation

---

## 2. Decision

### 2.1 PM 节点：**2 个**新 block container（claim + evidence）

**Rejected alternatives**：
- 4 个独立节点（claim / evidence / counterpoint / synthesis） →
  counterpoint = `claim` with `claimType: 'counter'`；synthesis 同理；
  收编辑器表面，避免节点泛滥
- atom node + attrs.text → 失去富文本编辑能力（claim 内常含 citation-ref）
- mark on paragraph → mark 不能跨多 block，claim 跨段落时崩

**最终选**：

```ts
// editor-core/extensions/claim.ts
Node.create({
  name: 'claim',
  group: 'block',
  content: 'paragraph+',     // 富文本子树
  defining: true,
  attrs: {
    blockId: string,         // 同 ADR-0001 atom node 模式（PG block_metadata）
    claimId: string,         // **全局**唯一，跨文档可引用（uuidv7）
    claimType: 'main' | 'counter' | 'synthesis',  // essay §15 三态
    status: 'ai-suggested' | 'human-reviewed' | 'approved' | 'deprecated' | 'superseded',
    confidence: 'low' | 'medium' | 'high',
  },
});

// editor-core/extensions/evidence.ts
Node.create({
  name: 'evidence',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  attrs: {
    blockId: string,
    evidenceId: string,      // 全局唯一
    supportsClaimId: string, // soft FK to claim
    citationId: string | null,  // soft FK to citation (评估资料源)
    relation: 'supports' | 'challenges' | 'qualifies',
  },
});
```

注意：counterpoint 不是独立节点，是 `evidence` with `relation:'challenges'` **OR** `claim` with `claimType:'counter'`——前者是反方证据，后者是反方论点。两种都用得到，由 essay §15 现有用法决定。

### 2.2 PG 表：3 个新表（claim / evidence / claim_link）

```ts
// claim — 全局对象，类比 citation
claim: {
  id: text (pk, uuidv7),
  text: text NOT NULL,                  // 主文本（denormalised cache from PM body）
  claimType: claim_type_enum NOT NULL,  // 'main' | 'counter' | 'synthesis'
  status: claim_status_enum NOT NULL DEFAULT 'ai-suggested',
  confidence: claim_confidence_enum NOT NULL DEFAULT 'medium',
  documentOriginId: text REFERENCES document(id),  // 首次出现的 doc
  createdBy: text REFERENCES principal(id) NOT NULL,
  createdAt: timestamptz NOT NULL DEFAULT now(),
  reviewedAt: timestamptz,
  reviewedBy: text REFERENCES principal(id),
  deprecatedAt: timestamptz,
  supersededByClaimId: text REFERENCES claim(id),  // status='superseded' 时填
}

// evidence — 全局对象，类比 citation；relation 决定支持/反驳
evidence: {
  id: text (pk, uuidv7),
  excerpt: text NOT NULL,               // 引文段落
  supportsClaimId: text REFERENCES claim(id) NOT NULL,
  citationId: text REFERENCES citation(id),  // 资料源（可选）
  relation: evidence_relation_enum NOT NULL,  // 'supports' | 'challenges' | 'qualifies'
  status: claim_status_enum NOT NULL DEFAULT 'ai-suggested',  // 复用 claim_status
  documentOriginId: text REFERENCES document(id),
  createdBy: text REFERENCES principal(id) NOT NULL,
  createdAt: timestamptz NOT NULL DEFAULT now(),
}

// claim_link — claim ↔ claim 关系；synthesis、组合论证用得到
claim_link: {
  id: text (pk, uuidv7),
  fromClaimId: text REFERENCES claim(id) NOT NULL,
  toClaimId: text REFERENCES claim(id) NOT NULL,
  linkType: claim_link_type_enum NOT NULL,  // 'derives-from' | 'synthesizes' | 'contradicts' | 'refines'
  createdBy: text REFERENCES principal(id) NOT NULL,
  createdAt: timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fromClaimId, toClaimId, linkType),
}
```

**Rejected**: 复用 `citation` 表加 evidence 字段——不行，evidence 的
"支持/反驳/限定"语义跟 citation 的"被引文献"完全不同；evidence 还要
关联 claim ID，加进 citation 表会污染。新表更干净。

### 2.3 PM ↔ PG 同步：denormalised cache pattern（ADR-0001 §2.3 模式）

- Y.Doc PM tree 持有 `claim` / `evidence` block 的 attrs（含 claimId / evidenceId）
- PG `claim` 表存权威数据（text / status / confidence / 历史）
- 提交边界（commit）写 claim/evidence row，类似 D7 contribution 写 PG
- PM body 里的 claim/evidence text 是**denormalised cache**——PG 的 text 字段是 source of truth
- 不一致时以 PG 为准；编辑器 mount 时 reload claim text from PG

**反模式回避**：claim text 不在 Y.Doc 内做 CRDT 合并（避免"两人同改 claim
正文导致字符级 conflict"）——claim 视为 immutable 内容，要改就出新 claim
`status='superseded'` 指向旧 claim ID。

### 2.4 状态机：5 态 + Provenance audit

```text
ai-suggested ──┬── human-reviewed ──┬── approved
               │                    │
               │                    └── deprecated
               │
               └── superseded（指向新 claim）
```

每次状态变迁写 `contribution` + `provenance` row（ADR-0001 §2.3.6 + §2.3.7）。`provenance.agentContext` 含：
- `claimStateTransition: { from: 'ai-suggested', to: 'human-reviewed' }`
- 复用既有 contribution 表，不新增 audit 路径

### 2.5 Evidence Map dependency graph

**API（W7 实施）**：

```
GET /api/document/<docId>/evidence-map
→ {
    claims: Claim[],
    evidences: Evidence[],
    claimLinks: ClaimLink[],
    sources: Citation[],   // 通过 evidence.citationId 关联
    crossDocReuse: { claimId: string, documentIds: string[] }[],  // 跨文档复用
  }
```

**前端（W7 read-only）**：DAG 力布局；claim 圆点 + status badge；evidence 边（颜色区分 supports/challenges）；点击展开摘要。

**不做**：图编辑 / 多选合并 / 时间轴重放（推 Phase 3）。

### 2.6 Plugin API exposure（Phase 3）

第三方 plugin 不能新增 claim sub-type / evidence relation type / claim_link type（Phase 2 关闭）。理由：
- claim_type / evidence_relation 是 schema 不变量；扩展需 schema migration（不能由 plugin 在运行时插）
- Phase 3 评估"plugin 自定义 claim sub-type 是否必要"——可能 90% 用 main/counter/synthesis 就够

Phase 2 仅以 capability `block.read` / `block.propose` 提供给 plugin **读写**现有 claim/evidence；不开放 schema 扩展。

### 2.7 AI context pack 导出（W7 配套）

```
GET /api/document/<docId>/export?format=ai-context-pack
→ JSON or zipped Markdown
{
  "doc": { id, title, slug },
  "claims": [{ id, text, claimType, status, confidence, ... }],
  "evidences": [{ id, excerpt, supportsClaimId, citationId, relation, ... }],
  "claimLinks": [...],
  "sources": [...],   // CSL-JSON
  "provenance": [...]
}
```

下游 AI agent 直接 import 进自己 context；与 ADR-0010 §2.7 review log
"agent-plugin 跨实例知识共享"路径互通——Phase 3 第三方 plugin 调用本
endpoint 启动新研究。

---

## 3. Consequences

### 3.1 正面

- **第 6 差异化轴落地**（Knowledge object DAG / Claim-Evidence first）
- AI agent reviewer/researcher 可以在 claim 粒度操作，而不是 paragraph
- 跨文档 claim 复用 = 知识资产化（essay §11.1 护城河）
- AI context pack 是低成本 add-on，与 axis 5 plugin 平台契合
- Provenance（axis 2）从"每节点有源"升级到"每 claim 有完整证据链"

### 3.2 负面

- 多 3 张 PG 表 + migration（与 Phase 1 D7 节奏一致）
- 编辑器 surface 多 2 个节点（claim + evidence）；PM schema 复杂度上升
- claim 全局 ID + 跨文档语义需要"claim 生命周期管理"（Phase 3 加 UI）
- Y.Doc 内 claim attrs 占用 ID 空间——一个 claim 多次出现要复用同 claimId

### 3.3 长期债

- claim 跨文档"重命名 / 合并 / 分裂"操作的 UX 推 Phase 3
- claim text 修改的版本管理（新 claim + supersededBy 链）需要 UI 走查
- AI 自动 ingestion 流水线（source → claim/evidence 抽取）推 Phase 3
- Source Reader UI 推 Phase 3
- Draft Composer 替换空白页编辑推 Phase 3 评估

---

## 4. Alternatives considered

### 4.1 单一 `knowledge_object` 表 + type 字段（rejected）

把 claim / evidence / question / decision 都塞一张表，用 `type` 字段区分。
**拒绝原因**：(a) evidence 的 `supports_claim_id` 字段对 claim 无意义，
反过来 claim 的 `claim_type` 字段对 evidence 无意义——宽表大量 NULL；
(b) FK 约束要按类型分支，CHECK 约束爆炸。

### 4.2 复用 annotation_thread 表承载 claim（rejected）

annotation_thread 已有 status / kind 字段，看起来能复用。
**拒绝原因**：(a) annotation_thread 是"挂在 anchor 上的讨论线程"，semantics 跟"全局可复用论点"完全不同；(b) annotation 的 anchor 是 PM mark，claim 是 block container，结构不兼容。

### 4.3 把 claim/evidence 内容存 Y.Doc（不存 PG）（rejected）

让 claim/evidence text 作为普通 PM 内容随 Y.Doc CRDT 合并。
**拒绝原因**：(a) claim 全局复用要求 source of truth 在 PG，否则跨文档查询要遍历所有 Y.Doc；(b) 跨文档 reuse 时 Y.Doc 之间 claim text 漂移没法对齐。

### 4.4 4 个独立 PM 节点（claim / evidence / counterpoint / synthesis）（rejected）

essay §15 用 4 directive 写法。
**拒绝原因**：counterpoint = "反方论点" = `claim` with `claimType:'counter'`；synthesis = `claim` with `claimType:'synthesis'`。两 PM 节点 + 子类型 attr 比 4 节点更干净，编辑器扩展点也少。

---

## 5. Open questions（W5-W7 实施时落实）

- **claim 全局 ID 分配时机**：编辑器输入"创建 claim"时立刻分（client-side uuidv7） vs commit 时分（server-side）？倾向 client-side（与 citation 模式一致）
- **claim 跨文档 reuse UX**：编辑器要支持"插入已有 claim by ID / fuzzy search"——W7 dogfood 时实测
- **evidence 的 PM block 是必须包在 claim 内还是可独立块**：倾向**独立块** + soft FK
  `supportsClaimId`，便于一个 evidence 支持多 claim（虽然 PG 模型每个 evidence
  仅指 1 claim，UI 可允许重复插）
- **Evidence Map 跨文档力布局是否聚类**：W7 demo 默认按 source 聚类，可切按 claim_link 类型聚类

---

## 6. 与 ADR-0010 dispatch 的接合

ADR-0010 §2.4 "skill 按需加载" 在 W4-W5 实施 dispatcher 时，**citation
agent 的 trigger_patterns 应包括 claim/evidence 块上下文**——例如用户
在 claim 内输入 "[需要证据]" 自动触发 citation skill 找补 evidence。

具体 prompt 模板设计推 Phase 2 W7 dogfood 实测后再拍。

---

## 7. Review log

### 2026-05-09 · W5+W7 实施 → **Accepted**

实施 commits（claude/review-project-goals-TpFuH）：
- `3d4a6cd` — ADR-0011 起草 + migration 0006 + drizzle schema（claim/
  evidence/claim_link 三表 + 5 enum + 12 索引）
- `90bf104` — Claim + Evidence PM block container（content='paragraph+'
  + 全 attrs；schema.test 加 claim/evidence；7 个 round-trip 测试 PASS）
- `55e38cf` — W7 Evidence Map API + AI context pack export

**W7 dogfood gate criteria**：

1. ✅ Evidence Map endpoint 可调（GET /api/document/<id>/evidence-map
   返回 5 字段：claims / evidences / claimLinks / sources /
   crossDocReuse；capability gate `block.read`）
2. ✅ AI context pack export 可调（GET /api/export/<id>/ai-context-pack
   返回 single JSON 含 schema 标识 + 全 claim/evidence/claim_link/source
   + provenance 元数据）
3. ⏸ Real PG e2e（多 document 多 claim 多 evidence + cross-doc reuse
   验证）推 Phase 2.5

**§5 open questions 答案**：

- **claim 全局 ID 分配时机**：✅ client-side uuidv7（`newClaimId()`
  in editor-core/util/ids.ts）—— 与 citation 模式一致
- **claim 跨文档 reuse UX**：⏸ 推 Phase 3（先 W7 dogfood 实测看是否需要）
- **evidence PM block 是否必须包在 claim 内**：✅ **独立块** + soft FK
  `supportsClaimId`（PG NOT NULL 兜底）
- **Evidence Map 跨文档力布局聚类**：⏸ Phase 3 UI 落地时拍

**§2.3 PM ↔ PG denormalised cache 风险评估**：W5 实施未触发问题（
PM body 内 paragraph 子树 + PG text 字段同步策略未实测；推 Phase 2.5
真用户 dogfood 时观察）。

caveat：claim 跨文档"重命名/合并/分裂" UX + AI 自动 ingestion 流水线
推 Phase 3（per integration doc §3）。

ADR-0011 状态 → **Accepted**。

## Phase 4 W4 Implementation Review Log（maintenance scan 闭环）

W4 把 essay §7.4 列的 6 类 finding generator 全部落 backend，关闭"残 3 kind"
长期债：

- **5 SQL-pure**（无 LLM / 无网络）：
  - `unsupported-claim`（claim 没有任何 evidence 行）
  - `outdated-source`（source.accessed_at >= 540 天）
  - `unverified-ai-block`（claim/evidence status='ai-suggested' >= 14 天）
  - `contradicted-conclusion`（claim 有 `evidence.relation='challenges'`
    且无 `claim_link link_type='synthesizes'` 来自 synthesis-typed claim
    的 resolution）—— 纯 SQL EXISTS / NOT EXISTS push 进 PG
  - `duplicated-claim`（exact-text-match）—— GROUP BY text HAVING
    count > 1，每个 group 展开为 N findings + `details.otherClaimIds[]`；
    语义/embedding 相似度推 Phase 5 vector index
- **1 网络类**：
  - `broken-citation` —— 注入式 `DoiResolver` 接口（生产 wire 到
    `httpDoiResolver` 走 `https://doi.org/<doi>` HEAD redirect=manual +
    8000ms timeout + 100/scan batch limit；测试注入 stub）

agent-worker dispatch 接 `httpDoiResolver` 默认实例 + `WorkerConfig.doiResolver`
测试注入 hook。`scanForFindings` 默认 5 SQL-pure（broken-citation opt-in
only，无 resolver 时 throw 防止 silent skip）。

测试：agent-worker 12 → 26 PASS（+7 finding generator + 7 doi-resolver
HTTP / timeout / userAgent / baseUrl 5 维覆盖）；全 workspace typecheck PASS。

**残 closeout**：vault scope 跨文档 cross-doc reuse view 推 Phase 4 W7
fork-merge UI 同时落。

### Dashboard UI（同会话紧接 W4 backend 落）

`/(app)/maintenance` Next.js 15 Server Component + 2 个 API endpoint
+ 共享 transition matrix lib：

- `GET /api/maintenance/findings` —— 按 caller 的 `principal_id` 筛
  `vault_principal_id`；支持 status / severity / kind / documentId 多
  维筛 + 100 上限 + severity 排序（high → info）+ counts aggregate
- `POST /api/maintenance/findings/<id>/transition` —— 单端点处理 3
  状态转移；vault 所有权校验 + 状态机校验（open → 3 / acknowledged →
  2 / 终态锁定）+ dismissed 强制非空 reason
- `apps/web/src/lib/maintenance.ts:validateTransition()` —— 纯校验
  函数；API route 与 Server Action 同源，避免 matrix drift
- 仪表盘页：severity 颜色徽章（high red / medium amber / low zinc /
  info blue）+ 6 finding kind 中文标签 + `details` jsonb 折叠预览 +
  filter chip 4 状态计数 + 3 类 Server Action（知悉 / 已修复 / 忽略）
  + revalidatePath 后立刻刷新
- apps/web layout 加导航 `维护 · Maintenance` 入口

测试：apps/web 23 → 35 PASS（+12 transition matrix：4 状态 × allowed +
6 拒绝路径 + 终态锁 + 未知 status forward-compat）。

**授权模型决策**：findings 是 per-principal 聚合状态，与 document ACL
正交；本期采用 vault 所有权（`vault_principal_id` = caller principal_id）
作授权预设，不引新 capability。Cross-org / 团队共享 vault dashboard
推 dogfood-trigger（Phase 4 末 + ADR-0002 review log）。

### Phase 5 Wave B B4 — finding_kind 加 'unverified-claim'（2026-05-12）

Wave B `4fee614` 落 SQL-pure 第 7 类 finding `unverified-claim`：claim
INNER JOIN principal 取 created_by.kind='agent' 且无人类 endorsing review
+ created_at < cutoff（默认 30 天）。Drizzle enum 6→7 档；migration 0015
`ALTER TYPE finding_kind ADD VALUE IF NOT EXISTS 'unverified-claim'`
（PG 12+ 幂等）。

**与本 ADR §2.5 6 finding kind 的关系**：第 7 类是 ADR-0016 Wave B 的
**反 AI-only-claim 闸**，本质上是"AI 创建但无人类背书"的健康警示，
与 §2.5 不冲突 — 仅扩张 finding_kind enum，不改既有 6 类的语义。

ADR-0016 §2.6 原说"provenance.actor_kind 全是 agent"用
`principal.created_by.kind='agent'` 作 proxy（claim 与 provenance 之间
无直接 FK；准确路径需 walk contribution rows by affected_block_ids，B4
范围内不做，留 Wave D 评估）。Phase 5 W12 dogfood gate retrospective 时
评估准确路径是否仍需补。

agent-worker **26→31 测全 PASS**。

### Phase 5 ADR-0020 Triadic — Day 层 reframe（2026-05-12）

ADR-0020 §1.3 把本 ADR 定位明确化：

> "Claim/Evidence 保留作 **Day 层** atomic units；Night 层有 thought /
> question / metaphor / sketch / contradiction / thought-experiment；Bridge
> 层有 concept-prototype / design-fiction / hypothesis-formalization /
> analogy-mapping。三层不互斥。"

**对本 ADR 的影响 — 零 schema 改动**：

- 本 ADR 既有 claim / evidence / counterpoint / synthesis / claim_link /
  6 finding kind / Reviewer Inbox / lineage view（Wave B 全交付）**保持
  不变**。
- Wave D-4 `3aa4f57` `/triadic/manuscript` 页面 **显式声明** Day 层不被
  替换或降级，只是叙事层面 reframe 为"三类等价产出之一"。链接到现有
  `/docs` / `/maintenance` / `/reviewer-inbox`（本 ADR 落地路径）。
- claim/evidence 现仍是 Day 层的 atomic unit。Phase 6+ 若有
  "promote Bridge concept-prototype → Day claim" 的 surface（ADR-0023
  ContractedToBeDeprecated），那时再加 §7 review log 段记录 promotion 协议。

**对 §2.7 export shape 的影响**：

- W7 落地的 AI context-pack export（`/api/document/<id>/context-pack`）
  当前仅含 Day-layer artifact（claim + evidence + reviews + provenance）。
- Wave D-5 dogfood gate 后若 ADR-0020 → Accepted，Phase 6 follow-up ADR
  考虑扩展 export shape 含 Night/Bridge 的 lineage edges（CrossLayerReference
  按 InteractionMode 分组），帮 AI 理解 "this claim 的 metaphor 起源 +
  formalization 历程"。当前不动。

### Phase 5 closeout — ADR-0011 全期回顾（2026-05-12）

Phase 4 W4 6 finding kind + W7 AI context pack export + Phase 5 Wave B
第 7 finding kind + Wave B5 Reviewer Inbox + Wave B6 公共 lineage view
全部交付。本 ADR Status 维持 **Accepted**；Evidence Tier `mixed`（W7
Evidence Map + claim/evidence schema `real`，5/7 finding scan SQL `real`，
reviewer/researcher 路径仍 `mock` 依 ADR-0008）。

**Phase 5 之后剩余项**：

- ADR-0016 dogfood gate 5 criteria 跑通后 Wave B closeout
- Wave D-5 dogfood gate 评估"AI vs human claim creation 比例"是否需要新
  finding kind / promotion 协议
- Phase 6 决定 export shape 是否含 Triadic lineage（视 ADR-0020 → Accepted
  情况）

### Phase 6 W2 ADR-0018 — signed provenance chain + Merkle log 联动（2026-05-12）

ADR-0018 Open Content Mechanisms（`b3df724` Proposed）引入：

1. **`packages/open-content/`** (`7e6c730`)：canonical-payload 序列化器
   (sorted-key recursive JSON + sha-256) + Merkle log helpers
   (buildMerkleEntry / verifyMerkleEntry / verifyMerkleChain 3 invariant
   walker)；31 测全 PASS
2. **migration 0016** (`7e6c730`)：4 entity 表 (open_question /
   open_dataset / open_peer_review / share_snapshot) + provenance_merkle_log
   append-only chain；每 entity 行 non-null signed_payload_jws + 非空
   merkle_log_entry_id FK
3. **`packages/identity/`** (`c7af95f`)：ed25519 keypair + argon2id +
   xchacha20-poly1305 + ORCID link canonical payload（34 测）
4. **apps/web /api/publish + service layer** (`71c8228`)：F4 publish flow
   single endpoint for all 4 kinds + content-shape validators + signature
   verifier DI hook（37 测）

**对本 ADR §2 claim / evidence schema 的影响**：**零修改**。claim_review
（ADR-0016）仍 per-document Day-layer；open_peer_review（ADR-0018）是
public-surface 跨 4 entity 类型；二者不重叠。本 ADR §2.7 export shape
（AI context pack）当前仍 Day-only；Phase 6 W3+ 视 ADR-0020 Triadic →
Accepted 后评估是否含 cross-layer lineage edges。

**对 6 finding kind 的影响**：ADR-0018 §2.6 提议 Phase 6+ 加第 8 类
finding `dangling-merkle-ref`（merkle_log_entry_id FK 失效；本期 PG FK
约束已防御，无需 finding kind 兜底，留作 future）。

**Evidence Tier**：`contract` (canonical-payload + Merkle helpers + 表
schema + F4 publish service layer + 1 API route 全 contract test；W3+
真 ORCID OAuth + ed25519 public key 列加入后升 `mixed`)。
