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

（W7 dogfood gate 后填；预期内容：(a) 单文档 Evidence Map demo 实测
+ AI context pack export demo 实测；(b) §5 open questions 答案；
(c) §2.3 PM ↔ PG denormalised cache 是否产生预期外问题；(d) Phase 3
follow-up 清单：跨文档 reuse UX / claim 生命周期 / Plugin API 暴露）
