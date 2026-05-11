# ADR-0001: 数据模型 & CRDT/Postgres 拆分

- **Status**: Accepted
- **Date**: 2026-05-08（Proposed），2026-05-08（Accepted，gate 解锁）
- **Phase**: 0（关键路径 D1）
- **Deciders**: <项目所有者>
- **Gate cleared by**: D3 双 tab 验证 — 由 Playwright headless 自动化覆盖（`apps/prototypes/proto-a-yjs-schema/tests/dual-tab.spec.ts`，3 个 case 全 PASS / 0 y-prosemirror warnings；详见 `apps/prototypes/proto-a-yjs-schema/findings.md`）。原方案为人手开两 tab，被等价的自动化替代以纳入 CI。

---

## 1. Context

这是 Phase 0 **最贵**的决策。`paper-platform-system-prompt.md` 第一性原理 #8 直接说："**文档是异构内容图，不是文字流**……这是选错就要重写的决策——现在不预留，三个月后推倒重来。" 第一性原理 #10 进一步警告："先简单后扩展" 在分布式系统和数据模型上经常是骗局。

本 ADR 的边界：

- **决定**：8 个核心实体的 TypeScript 形状；每个字段在 Y.Doc CRDT 还是 Postgres；Y.Doc 的 ProseMirror schema 怎么承载异构 block；in-flight 状态怎么走 awareness。
- **不决定**：UI、编辑器具体配置（TipTap extension 实现细节是 D3 / 后续 ADR）；同步网关协议细节（ADR-0002 接手）；具体 CRDT 引擎 API（doc-store 抽象层 ADR 后续单独写）。

**Prior art**（执行 D3/D5 时仍要查阅）：
- [Stencila Schema](https://github.com/stencila/schema) — `Article` + atom-style `Cite` / `CodeChunk` 节点的 lineage
- [MyST Spec](https://mystmd.org/spec) — 我们的 AST 输入格式
- [Curvenote architecture](https://curvenote.com/blog/architecture-of-a-myst-website) — 树存内容、图关系存 side-car 的范例
- [Yjs subdocuments](https://docs.yjs.dev/api/subdocuments) — Phase 3 大文档拆分预留
- [y-prosemirror README](https://github.com/yjs/y-prosemirror) — schema recovery 静默删内容的注意事项

---

## 2. Decision

### 2.1 总策略：Y.Doc-as-tree + Postgres-as-graph

```
┌────────────────────────────────────────────────────────────────┐
│  Y.Doc（每个 Document 一份）                                    │
│  ├── Y.XmlFragment("body")  ← ProseMirror 主树                 │
│  │     ├─ paragraph                                             │
│  │     ├─ heading                                               │
│  │     ├─ equation       (atom node)                            │
│  │     ├─ citation-ref   (atom node, attrs.citationId → PG)     │
│  │     ├─ dataset-ref    (atom node, attrs.datasetId → PG)      │
│  │     ├─ computational  (atom node, attrs.cellId → PG)         │
│  │     ├─ annotation-anchor (inline mark, attrs.anchorId → PG) │
│  │     ├─ figure         (block node)                           │
│  │     └─ footnote       (atom node, attrs.footnoteId → PG)     │
│  ├── Y.Map("graph:in-flight")  ← 短期协作可见性                  │
│  └── Y.Map("provenance:in-flight") ← agent 进行中的标记          │
└────────────────────────────────────────────────────────────────┘
                       ▼ commit boundary 入库
┌────────────────────────────────────────────────────────────────┐
│  Postgres（事件溯源 + 跨文档查询 + 身份与权限）                  │
│  document, block_metadata, citation, annotation_thread,         │
│  annotation_comment, revision, contribution, provenance,        │
│  agent, principal, capability, document_acl, ...                │
└────────────────────────────────────────────────────────────────┘
```

**拆分规则（4 个 bucket）：**

| Bucket | 含义 | 例子 |
|---|---|---|
| `[Y]` | 并发编辑必须正确合并 | block 文本、树结构、annotation anchor 在文中位置 |
| `[Y.in-flight]` | 短暂广播状态，TTL 清理；reload 即丢可接受 | "Citation Agent 在 block X 上跑 prompt"、cursor、selection |
| `[PG]` | 审计 / 跨文档查询 / 身份与权限 / 不可丢失 | citation 元数据、provenance、capability、annotation thread/comment |
| `[Y+PG]` | 周期性快照 | Postgres BLOB 备份 Y.Doc binary，灾难恢复 / fork base |

### 2.2 ProseMirror schema 关键约定

引用 / 数据集 / 可执行单元 / 脚注 / annotation-anchor 都是 **atom node**（叶子，PM 不会拆其内部）。`attrs` 含一个稳定 ID（`uuidv7`，client-id 前缀避免并发碰撞）；具体内容（CSL-JSON / dataset metadata / cell source / thread）在 Postgres，**Y.Doc 只存 ID 引用**。

> 这是与 Curvenote / Stencila / MyST 的共同 lineage——树存"位置 + 引用"，图关系（"这个 citation 指向哪些其他文档/数据集"）存关系数据库。**不发明新 CRDT 模型**（NextGraph 风格的 graph-CRDT 暂不成熟）。

### 2.3 八个核心实体 TypeScript 形状

> 注释里的 `[Y] / [Y.in-flight] / [PG] / [Y+PG]` 标 bucket。这些 TS 是 `packages/schema/src/*.ts` 的 verbatim 来源。

#### 2.3.1 `Document`

```ts
// packages/schema/src/document.ts

export type DocumentId = string;        // uuidv7
export type LanguageTag = 'zh-Hans' | 'zh-Hant' | 'en' | string; // BCP 47

export interface Document {
  id: DocumentId;                       // [PG]
  ownerPrincipalId: PrincipalId;        // [PG] 见 §2.3.9 Principal
  primaryLanguage: LanguageTag;         // [PG] 排版基准语言
  bilingualMode: 'mono' | 'parallel' | 'mixed'; // [PG]
  templateId?: string;                  // [PG] 期刊模板 / null = 默认
  title: string;                        // [Y]  body 第一个 heading 的镜像，缓存
  slug: string;                         // [PG]
  createdAt: string;                    // [PG] ISO-8601
  updatedAt: string;                    // [PG] 由 commit boundary 更新
  deletedAt?: string;                   // [PG] soft delete

  // 不存 body 字段——body 完整在 Y.Doc 里
  // body root: Y.XmlFragment("body")
}

// Postgres 的 document 表还有：
//   yjs_state_vector_snapshot bytea    -- [Y+PG] 周期快照
//   yjs_doc_binary           bytea     -- [Y+PG] 完整 Y.Doc 备份
//   last_snapshot_at         timestamptz
```

#### 2.3.2 `Block`

```ts
// packages/schema/src/block.ts

export type BlockId = string;           // uuidv7，PM atom node attrs.blockId
export type BlockType =
  | 'paragraph' | 'heading' | 'list' | 'list-item' | 'blockquote'
  | 'equation'              // display 公式（atom）
  | 'inline-equation'       // 行内公式（atom inline）
  | 'citation-ref'          // 指向 Citation（atom inline）
  | 'dataset-ref'           // 指向 Dataset（atom inline）
  | 'computational-cell'    // 指向 ComputationalCell（atom block）
  | 'figure'                // 容器：image + caption
  | 'figure-caption'
  | 'footnote-ref'          // atom inline，指向 footnote 内容
  | 'annotation-anchor'     // inline mark，跟随文本 CRDT 移动
  | 'theorem' | 'proof'     // 学术结构
  | 'code-block';

// Block 在 Y.Doc 中以 ProseMirror node 形式存在。
// 这里的 TS 接口只是"概念上的形状"——实际并不存为单独的 BlockRow。
// 但 Postgres 有 block_metadata 表（见下），用于跨文档查询 / 反查。
export interface BlockShape {
  blockId: BlockId;                     // [Y] PM node attrs.blockId
  type: BlockType;                      // [Y] PM nodeType
  // type 之外的字段视 type 而定，见下面的辨别联合
}

// Postgres block_metadata 表（仅当 block 是"被引用对象"时才入表）：
export interface BlockMetadata {
  blockId: BlockId;                     // [PG] PK
  documentId: DocumentId;               // [PG]
  type: BlockType;                      // [PG]
  // 由 commit boundary 写入；在 body 里位置不存（位置在 Y）
  firstSeenContributionId: ContributionId; // [PG]
  lastSeenAt: string;                   // [PG] 最近一次 commit 中仍出现
  removedAt?: string;                   // [PG] 在某次 commit 后从 body 消失
}
```

#### 2.3.3 `Citation`

```ts
// packages/schema/src/citation.ts

export type CitationId = string;        // uuidv7
export type CitationKind =
  | 'literature'    // 论文 / 书 / 章节，CSL-JSON
  | 'dataset'       // 数据集（DOI/Zenodo/Dryad/HF）
  | 'software'      // 代码（Zenodo software / Software Heritage）
  | 'document'      // 引用本平台另一篇文档
  | 'web';          // 网页（带 archive.org 快照建议）

export interface Citation {
  id: CitationId;                       // [PG]
  kind: CitationKind;                   // [PG]
  cslJson: Record<string, unknown>;     // [PG] 主元数据（CSL-JSON）
  doi?: string;                         // [PG] indexed
  url?: string;                         // [PG]
  archivedAt?: string;                  // [PG] archive.org 快照时间
  language?: LanguageTag;               // [PG]
  externalIds: {                        // [PG] 跨库 ID
    crossref?: string; arxiv?: string; semanticScholar?: string;
    pubmed?: string; openalex?: string; cnki?: string;
    zenodo?: string; orcid?: string[];
  };
  // 反向索引：哪些 document 用了这条 citation —— 用 contribution 派生，不在 PG 里物化
  createdBy: PrincipalId;               // [PG]
  createdAt: string;                    // [PG]
}
```

> Citation 是**全局的**，不挂在某个 document 下。同一篇 paper 可被多个 document 引用。Document 的 body 里 `citation-ref` atom node 只存 `attrs.citationId`。

#### 2.3.4 `Annotation`（结构化讨论：Thread + Comment + Anchor）

```ts
// packages/schema/src/annotation.ts

export type AnchorId = string;          // uuidv7
export type ThreadId = string;
export type CommentId = string;

// Anchor 是"在文中的锚点"——它必须随文本 CRDT 移动，所以位置在 Y。
// 但元数据 + thread 关系在 PG。
export interface AnnotationAnchor {
  anchorId: AnchorId;                   // [Y, PG] PM mark attrs.anchorId / PG PK
  documentId: DocumentId;               // [PG]
  threadId: ThreadId;                   // [PG]
  // 在 Y.Doc 里，anchor 是 inline mark；range 由 PM mark 自动跟随
  // PG 里只存反查
  createdAt: string;                    // [PG]
  resolvedAt?: string;                  // [PG]
}

export type AnnotationKind =
  | 'comment'           // 普通讨论
  | 'suggestion'        // 提议改写（变成 Revision 的来源）
  | 'reviewer-note'     // 评审正式意见
  | 'agent-flag'        // AI agent 标记（如"DOI 可能错误"）
  | 'task';             // 派给某 principal 的待办

export interface AnnotationThread {
  id: ThreadId;                         // [PG]
  documentId: DocumentId;               // [PG]
  anchorId: AnchorId;                   // [PG]
  kind: AnnotationKind;                 // [PG]
  status: 'open' | 'resolved' | 'archived'; // [PG]
  createdBy: PrincipalId;               // [PG]
  createdAt: string;                    // [PG]
  resolvedBy?: PrincipalId;             // [PG]
  resolvedAt?: string;                  // [PG]
}

export interface AnnotationComment {
  id: CommentId;                        // [PG]
  threadId: ThreadId;                   // [PG]
  authorPrincipalId: PrincipalId;       // [PG]
  bodyMarkdown: string;                 // [PG] append-only
  createdAt: string;                    // [PG]
  // append-only：comment 不可编辑、不可删，只能 markDeleted
  markedDeletedAt?: string;             // [PG]
  // 如果 comment 由 agent 生成，记录在 provenance 中（不在这）
  contributionId: ContributionId;       // [PG] 每条 comment 也是一次 contribution
}
```

> **为什么 thread/comment 不放 Y.Doc**：append-only 讨论无并发合并需求；放 PG 更便于跨文档查询、AI 训练数据导出、外部可见 review URL。Anchor 的"在文中位置"放 Y 才是关键——文本变了 anchor 自动跟随。

#### 2.3.5 `Revision`（提议中的修改，可拒）

```ts
// packages/schema/src/revision.ts

export type RevisionId = string;

export type RevisionStatus =
  | 'draft'       // agent / 协作者还在打磨
  | 'proposed'    // 提交评审
  | 'accepted'    // 已并入主线（→ 产生 Contribution）
  | 'rejected'    // 拒绝
  | 'superseded'; // 被另一个 revision 覆盖

export interface Revision {
  id: RevisionId;                       // [PG]
  documentId: DocumentId;               // [PG]
  proposedBy: PrincipalId;              // [PG] 可以是 user 或 agent
  status: RevisionStatus;               // [PG]
  // diff payload：以 PM step 数组 + Y.Doc state vector 表示，序列化为 bytea
  pmStepsBinary: Uint8Array;            // [PG] PM steps（用 prosemirror-transform 序列化）
  yjsUpdateBinary: Uint8Array;          // [PG] 等价 Yjs update（用于纯 Yjs 客户端 apply）
  baseStateVector: Uint8Array;          // [PG] 提议基于的 doc 状态
  rationale?: string;                   // [PG] markdown，可选
  // agent 提议则关联 provenance（agent 跑了什么 prompt）
  provenanceId?: ProvenanceId;          // [PG]
  createdAt: string;                    // [PG]
  decidedAt?: string;                   // [PG]
  decidedBy?: PrincipalId;              // [PG]
  // 如果 accepted，关联到 Contribution
  contributionId?: ContributionId;      // [PG]
}
```

#### 2.3.6 `Contribution`（已 commit 的修改单元）

```ts
// packages/schema/src/contribution.ts

export type ContributionId = string;    // uuidv7

export interface Contribution {
  id: ContributionId;                   // [PG] append-only
  documentId: DocumentId;               // [PG]
  // 上链上下文
  parentContributionId?: ContributionId; // [PG] 形成 history DAG
  fromRevisionId?: RevisionId;          // [PG] 如果来自一次 review-accept；null 表示直接编辑
  // 谁
  contributorPrincipalId: PrincipalId;  // [PG] 可以是 user / agent / shared-link / service
  // 内容
  pmStepsBinary: Uint8Array;            // [PG] PM steps（与 revision 同序列化格式）
  yjsUpdateBinary: Uint8Array;          // [PG] Yjs update binary
  affectedBlockIds: BlockId[];          // [PG] indexed，便于按 block 反查 history
  // 时间
  committedAt: string;                  // [PG]
  // provenance（强制，每次 contribution 必须有）
  provenanceId: ProvenanceId;           // [PG]
}
```

> **append-only**——任何 contribution 一旦写入永不修改。撤销操作以"反向 contribution"形式记录，不是 update。

#### 2.3.7 `Provenance`（贡献的来源链）

```ts
// packages/schema/src/provenance.ts

export type ProvenanceId = string;

export type ActorKind = 'user' | 'agent' | 'service' | 'shared-link';

export interface Provenance {
  id: ProvenanceId;                     // [PG]
  // 谁触发了这次操作
  actorPrincipalId: PrincipalId;        // [PG]
  actorKind: ActorKind;                 // [PG] cached for query

  // 如果 actor 是 agent，agentContext 必填
  agentContext?: AgentExecutionContext; // [PG] JSONB

  // 这次操作的输入语境（用户 select 了哪些 block，给 agent 的 source）
  inputBlockIds?: BlockId[];            // [PG]
  inputDocumentIds?: DocumentId[];      // [PG]

  // 触发时刻
  triggeredAt: string;                  // [PG]

  // 调用了哪些工具（MCP tools）
  toolCalls?: ToolCallRecord[];         // [PG] JSONB array

  // 决策路径
  approvalChain?: ApprovalRecord[];     // [PG] 谁 review 了、何时 approve
}

export interface AgentExecutionContext {
  agentId: AgentId;                     // 见 §2.3.8
  modelId: string;                      // 'claude-opus-4-7' / 'claude-sonnet-4-6' / ...
  modelProvider: 'anthropic' | 'openai' | 'local-ollama' | string;
  promptTemplateId: string;             // skills/.../SKILL.md hash 或 prompt registry id
  promptHash: string;                   // sha256 of fully-rendered prompt
  inputSkillIds: string[];              // 加载了哪些 skill
  temperature?: number;
  maxTokens?: number;
  // 不存完整 prompt 文本（可能含敏感信息）；按需可二次回放
}

export interface ToolCallRecord {
  toolName: string;                     // 'crossref.lookup_doi' / 'zotero.search'
  mcpServerId: string;                  // 用了哪个 MCP server
  argumentsHash: string;                // sha256
  resultSummary?: string;               // 简短描述（不存全 result）
  succeeded: boolean;
  durationMs: number;
}

export interface ApprovalRecord {
  approverPrincipalId: PrincipalId;
  approvedAt: string;
  decision: 'accept' | 'reject' | 'modify';
  notes?: string;
}
```

> **Provenance 写入边界**：commit boundary 时写一次（revision → accepted 转换瞬间，或直接编辑 commit 时）。**不在每次 keystroke 写**，那是 awareness/Yjs update 的事，与 provenance 不同。

#### 2.3.8 `Agent`

```ts
// packages/schema/src/agent.ts

export type AgentId = string;

export type AgentKind =
  | 'editor'           // 改写 / 润色
  | 'reviewer'         // 批判性审阅
  | 'citation'         // 引用核查与发现
  | 'researcher'       // 文献调研 / 数据分析
  | 'coordinator'      // 多 agent 调度
  | 'custom';          // 用户自建

export interface Agent {
  id: AgentId;                          // [PG]
  ownerPrincipalId: PrincipalId;        // [PG] 谁注册的（可能是 platform / user / org）
  name: string;                         // [PG]
  kind: AgentKind;                      // [PG]
  // 执行位置（runtime）
  runtime: 'server' | 'client';         // [PG] Phase 1 默认 server
  // 默认模型
  defaultModelId: string;               // [PG] 'claude-opus-4-7' 等
  // 默认加载的 skill 集合
  defaultSkillIds: string[];            // [PG]
  // 默认能调用哪些 MCP server
  allowedMcpServerIds: string[];        // [PG]
  // 行为预算
  defaultMaxTokens: number;             // [PG]
  defaultTimeoutMs: number;             // [PG]
  // capability 通过 Principal 关联（每个 Agent 关联到一个 PrincipalId）
  principalId: PrincipalId;             // [PG] = `agent:<agentId>`
  createdAt: string;                    // [PG]
  archivedAt?: string;                  // [PG]
}
```

#### 2.3.9 `Principal` + `Capability`（权限基础——详细 ADR-0002）

```ts
// packages/schema/src/principal.ts

export type PrincipalId = string;       // formatted: 'user:<uuid>' / 'agent:<uuid>' / 'link:<uuid>' / 'service:<id>'
export type PrincipalKind = 'user' | 'agent' | 'shared-link' | 'service';

export interface Principal {
  id: PrincipalId;                      // [PG]
  kind: PrincipalKind;                  // [PG]
  displayName: string;                  // [PG]
  // 反向关联
  userId?: string;                      // [PG] kind=user
  agentId?: AgentId;                    // [PG] kind=agent
  sharedLinkId?: string;                // [PG] kind=shared-link
  createdAt: string;                    // [PG]
  revokedAt?: string;                   // [PG]
}

// Capability 定义在 ADR-0002，这里只放最小占位
export type CapabilityVerb = string;    // 'block.propose' / 'block.commit' / 'agent.invoke:citation' / ...
export interface CapabilityGrant {
  id: string;                           // [PG]
  principalId: PrincipalId;             // [PG]
  resourceType: 'document' | 'block' | 'thread' | 'global'; // [PG]
  resourceId?: string;                  // [PG] null = global
  verb: CapabilityVerb;                 // [PG]
  expiresAt?: string;                   // [PG]
  grantedBy: PrincipalId;               // [PG]
  grantedAt: string;                    // [PG]
}
```

### 2.4 Y.Doc 结构（精确）

每个 Document 一个 Y.Doc。Y.Doc 内：

```
Y.Doc
├── XmlFragment "body"                  -- ProseMirror 主树 (y-prosemirror 绑定)
├── Map        "graph:in-flight"        -- key: arbitrary, value: { kind, principalId, blockId, ts }
│                                          examples:
│                                            "agent-citation-running:abc123" → { kind: 'agent-running', principalId, blockId, ts }
│                                            "draft-revision:def456"          → { kind: 'draft-revision', revisionId, ts }
│                                          TTL: 客户端定期清理 ts > 60s 的条目
├── Map        "provenance:in-flight"   -- key: tempProvenanceUuid, value: AgentExecutionContext (subset)
│                                          commit 时 → 写入 PG provenance 表，删除此 key
├── Map        "presence" (awareness)   -- 由 y-protocols/awareness 自动管理
│                                          {clientID → {cursor, selection, principalId, displayName, color}}
└── Map        "meta"                   -- 文档级镜像（title 缓存等）
                                          {title: string, primaryLanguage: string}
```

**注意 `awareness gossip 预算`**：50 协作者场景下，gossip 只广播最近活跃的 12 个 cursor，其他 lazy fetch。Phase 0 不实现，但 awareness reducer 接口要在 doc-store 抽象里就预留。

### 2.5 写入边界（commit boundary）

```
用户编辑（keystroke）
   └─→ Y.Doc 本地 update + y-indexeddb 持久化 + WebSocket 广播
       └─→ 协作者 Y.Doc apply update
       (此时 Postgres 还没动，仅 awareness/in-flight 在更新)

显式 commit 触发：
   - 用户的"提议"或"直接编辑提交"按钮
   - Agent 的 revision 被 accept
   - 周期性 auto-commit（每 N 秒空闲，可选）
   ↓
commit boundary（事务）：
   1. 计算自上次 commit 以来的 Y.Doc state diff → yjsUpdateBinary
   2. 计算 PM steps → pmStepsBinary
   3. INSERT contribution row（含 provenanceId）
   4. UPSERT block_metadata for affected blocks
   5. 如果是 from revision_id：UPDATE revision SET status='accepted'
   6. 如果 in-flight provenance 存在：移到 PG provenance 表，删 Y.Map 项
   7. 周期性（>= N 分钟）：dump Y.Doc binary 到 document.yjs_doc_binary 备份
```

---

## 3. 显式回答 system-prompt §1–7（"为下一阶段预留的架构空间"）

### §1. 数据模型：异构内容图

✅ 8 实体已定义。Block 用 ProseMirror 树承载结构化文本与 atom node，**异构关系**通过 atom node 的 `attrs.<entityId>` 指向 Postgres 实体（Citation / ComputationalCell / Dataset / Footnote / AnnotationThread）。**反模式回避**：body 不是单纯一棵 PM JSON 树——`block_metadata` 表 + Citation/Annotation/Provenance 在 PG 里维护跨文档关系。

**未来扩展（Phase 2+）新 BlockType**：interactive-figure, theorem-with-proof, experiment-record, agent-trace-anchor —— 都按 atom node + `attrs.<entityId>` → PG 模式加，**不动 Y.Doc 顶层结构**。

### §2. 协作主体模型：User 与 Agent 同等公民

✅ `Principal` 抽象统一 User / Agent / Shared-link / Service。所有 capability 绑 PrincipalId，**不是** UserId。这意味着 `contribution.contributorPrincipalId`、`revision.proposedBy`、`annotation_comment.authorPrincipalId` 等所有字段对 user 和 agent **同一形状**。

**Phase 1 即便只用 2-3 种 role**（paper-author, paper-reviewer, citation-agent），底层数据模型已经支持任意多 role。详见 ADR-0002。

### §3. 同步与合并：CRDT 选型

✅ **Phase 1 用 Yjs**（成熟 + ProseMirror 集成最强）。但 `packages/doc-store` 抽象一层接口（`DocStore.getDocument(id) → DocumentHandle`），让 Phase 4 切到 Loro / Automerge 3 是 1-2 周迁移而非重写。

**语义级 merge** 通过 PM steps 派生（不是文本级 diff）。Fork 出去的 document 在 PG 里挂 `forkedFromContributionId`；merge 用 PM steps rebase（可冲突，UI 提示人工解决）——Phase 3 主战场，Phase 0 仅在 schema 里预留 fork 关系字段。

### §4. Provenance 与归因系统

✅ `Provenance` 实体强制每个 Contribution 关联（`contribution.provenanceId NOT NULL`）。`AgentExecutionContext` 含 modelId / promptHash / inputSkillIds / toolCalls。

**写入边界**：commit boundary（不是每次 keystroke）。**in-flight 状态**走 `Y.Map('provenance:in-flight')`，给协作者实时看到"agent X 正在 block Y 上跑"。

### §5. 计算与数据接口的稳定抽象

✅ `BlockType: 'computational-cell'` 从 Phase 0 起在 schema 里。`ComputationalCell` 实体（Phase 0 ADR-0001 不展开，留 Phase 2 ADR）将含：

- `kernel: 'molab' | 'pyodide-inline' | 'remote-jupyter' | 'marimo-server'`
- `sourceCode`、`sourceLanguage`
- `inputDatasetIds: CitationId[]` —— 输入数据是 Citation 的 dataset 子类型
- `outputArtifactRefs[]` —— 输出图/表的 hash + 序列化形式
- `executionEnv: { pythonVersion?, packages?, dockerImageRef? }`

Phase 0 **不实现** kernel 集成，但 atom NodeView 占位 + schema 字段就位，Phase 2 加 Marimo 是"实现已定义契约"而非"重新设计文档结构"。

### §6. 扩展点与插件契约

✅ 三类扩展点 schema 已预留：

- **Template**：`Document.templateId` 字段已在；模板系统的具体注册接口留 Phase 2 ADR
- **MCP server**：`Agent.allowedMcpServerIds[]`；MCP server registry 表 Phase 0 不建（D5 用 hardcoded mock），Phase 1 ADR 单独写
- **Skill**：`AgentExecutionContext.inputSkillIds[]` 字段已在；skill registry 走 repo `skills/_registry.json`（参考 Anthropic Skills 的 progressive disclosure）
- **Agent custom**：`AgentKind: 'custom'` 已在

### §7. 隐私、安全、数据所有权

✅ 三件事在 schema 里就位：

- **默认私有**：`Document.ownerPrincipalId` + `document_acl` 表（见 ADR-0002）实现"谁能看"
- **AI 显式授权范围**：`CapabilityGrant.resourceType + resourceId` 支持"agent X 在 document Y 的 section Z 上 proposed"。Phase 1 网关只校验连接级，Phase 3 升级到节点范围。
- **数据导出**：因为 body 是 PM tree + Citation/Provenance 都在 PG，**任意时刻**可以一次性 dump 出 MyST / LaTeX / Word / Markdown / JATS。Phase 0 不实现导出 UI，但 schema 不挡路。

可执行单元的沙箱隔离 —— Phase 2 ADR；**MCP server 的鉴权**——Phase 1 ADR-0002 衔接（agent 调用 server 时网关校验 capability）。

---

## 4. Consequences

### Good

- **8 实体覆盖第一性原理 #8/#9/#11**——异构图、协作主体多元、provenance 一等公民全在 Phase 0 schema 里
- **Y/PG 拆分清晰**——并发合并问题留给 Yjs（成熟），跨文档查询/审计/身份给 Postgres（成熟），不发明新 CRDT 模型
- **Phase 4 换 CRDT 引擎是 1-2 周**——`doc-store` 抽象 + 实体 schema 与 CRDT 解耦
- **Phase 3 fork/merge 不需要重设计**——contribution DAG + revision/PM steps 已就绪
- **Provenance 不是事后补**——commit boundary 强制写入，Phase 2 起用户/agent 行为已经全程可追溯

### Bad / Trade-offs

- **Y.Doc 与 Postgres 双写**有不一致风险（Yjs update 持久化到 y-sweet S3 + contribution 入 PG 不在同事务）。**对策**：commit 失败 → 不接受 revision；周期性 reconcile job 比较 Y.Doc binary snapshot 与 contribution 累积 → 报警。
- **Citation/Annotation 跨文档查询走 PG**而不是 Yjs——失去"全离线编辑也能看到引用元数据"的最纯 local-first。**对策**：客户端 IndexedDB 缓存 citation/agent metadata（read-through）；离线编辑期间继续工作，引用 lookup 走缓存，重连后增量同步。
- **`AgentExecutionContext` 不存完整 prompt 文本**——只存 hash + template id。**对策**：prompt registry（按 template id + version 存的 immutable 表，Phase 1 ADR）；任意时刻可以"按 hash 重放"。**未存原因**：完整 prompt 可能含被 select 的源文档片段，存全文涉及隐私。
- **Yjs 没有内建权限**——所有方案都要求自建网关层鉴权。**对策**：ADR-0002 的网关 shim 必须 Phase 1 就在，不能延后。

### Neutral / Need watching

- **awareness gossip 预算**——50 人时 cursor 风暴需要 reducer。Phase 0 留接口，Phase 2 实测临界点。
- **uuidv7 vs nanoid**——选 uuidv7 是因为含时间戳便于 commit boundary 排序与 debug；nanoid 更短但无序。
- **PG bytea for Yjs binary**——超过 1MB 的 update binary（罕见，但长 history doc 会有）应外移到对象存储。Phase 1 阈值实测后定。
- **D3 失败的 fallback**：如果 y-prosemirror 处理 atom 并发插入存在不能容忍的 bug（重复节点、schema recovery 静默删内容），fallback 是改用 BlockNote 或 Slate-Yjs ——意味着 ADR-0001 转 Rejected，重新评估编辑器内核。**这是为什么 ADR 接受 gated on D3。**

---

## 5. Alternatives considered

### A. **NextGraph 风格的 graph-CRDT**

**是什么**：把"图"（block / citation / annotation 三方关系）整体作为一个 CRDT，而不是树 + 关系数据库。

**为什么不选**：(1) 没有成熟开源实现适配 ProseMirror；(2) 自研 graph-CRDT 是 6+ 个月 rabbit hole；(3) 即便做出来，性能与生态都不及 Yjs。

**什么情况会回头**：Phase 4 if 50+ 人开放贡献时 Y.Doc + 周期 reconcile 撑不住 —— 但更可能先迁 Loro / Automerge 3。

### B. **每个 Block 一个独立 CRDT 文档（per-block CRDT）**

**是什么**：50+ 协作者大文档时，避免单 Y.Doc awareness 风暴，把每个 block 作为独立 Y.Doc。

**为什么不选**：(1) 跨 block 编辑（删一段、插一段、把表格拆两段）变成跨文档事务，复杂度爆炸；(2) ProseMirror 集成困难（schema 期望树根是 doc 节点）。

**什么情况会回头**：实际是用 **Yjs subdocuments**（不是 per-block）做 section-per-subdoc，Phase 3 ADR 决定。schema 层不变（仍然 `XmlFragment("body")`），只是大文档拆 subdoc。

### C. **完全 Postgres-only**（不用 CRDT，所有协作走"乐观锁 + 冲突 UI"）

**是什么**：Linear 早期、Notion 多年是这种。

**为什么不选**：违反第一性原理 #1（Local-first）和 #6（< 100ms keystroke 同步）；50 协作者时不可行。

**什么情况会回头**：永不（这是项目的根本定位）。

### D. **Loro / Automerge 3 作为 Phase 1 主选**

**是什么**：更现代的 CRDT，更好的 history 语义。

**为什么不选（现在）**：(1) Loro 官方说"非生产就绪"（2026.1）；(2) Automerge 3 ProseMirror 集成不成熟；(3) Yjs 已被 Notion-tier、Linear-tier 产品验证。

**什么情况会回头**：Phase 4，当 50+ 人开放协作压测时，重新评估。`doc-store` 抽象就是为这个 day 准备的。

### E. **把 Provenance 完全放 Yjs awareness**

**是什么**：把 model/prompt/tool_calls 当 awareness 字段广播。

**为什么不选**：(1) awareness 是 ephemeral（reload 即丢），违反"provenance 是 audit ground truth"；(2) 跨文档查询（"agent X 上周改了多少 block？"）必须走 PG，不可能扫所有 Y.Doc。

**正确做法**：in-flight 走 Y.Map（短期可见），committed 走 PG。已采用。

---

## 6. Decision log

- **2026-05-08**: Plan subagent 调研 prior art（Curvenote / Stencila / MyST / NextGraph / Loro / Automerge / Y-Sweet / Liveblocks）后，采纳"树 + 图 side-car"模式。NextGraph graph-CRDT 评估为 6+ 月研究项目，不适合 Phase 0。
- **2026-05-08**: 决定 ADR-0001 接受 gated on D3 通过——schema 在 y-prosemirror 实测能并发合并才转 Accepted。这是为了让 ADR 的"决策"和"原型验证"互锁。
- **2026-05-08**: Provenance 写入边界从 "每次 keystroke" 收紧到 "commit boundary"。原因：keystroke 级 provenance 不可读、PG 写放大、且 50 协作者时存储成本爆炸。In-flight 用 Y.Map 临时态保留协作者实时可见性。
- **2026-05-08**: `Principal` 抽象第一天就含 `kind: 'shared-link'`（虽然 Phase 1 不实现共享只读链接）。原因：Phase 2 加链接共享时不再需要 schema migration——避开 Linear 早期 Permission 重构的坑。

---

## 7. Phase 1 implementation review log

> 加于 D16 close-out。这一节回放 Phase 1 D7–D15 实施过程中触到的实体与
> 决策，记录"哪些预测对了 / 哪些要 Phase 2 修"。

- **D7（schema migration）**：13 张 PG 表全部按 §2.3 的 8 实体 + Capability 系列
  落地。**新增**了 `prompt_template`（Phase 1 ADR 预告而 §2.3 未列）的 immutable
  registry；`block_metadata` 在 Phase 1 没有 trigger 自动维护，只由 contribution
  写入路径手动 upsert（与 ADR-0002 §6 决策"document_acl 是 Phase 1 优化"对齐）。
- **D8/D9（capability gateway + better-auth bridge）**：`Principal` 抽象
  顺利桥到 better-auth user 表（`principal-bridge.ts:createUserPrincipal`），
  注册时自动产 `principal{kind:'user'}` 行。**Service principal 与 platform
  agent principal** 用 fixed UUID 在 seed 阶段写入（CITATION_AGENT_ID a001 /
  INLINE_EDITOR_AGENT_ID b001）。
- **D10（编辑器内核）**：9 个 PM extension 全部 atom node + `attrs.<entityId>`
  → PG 模式（与 §2.2 一致）；y-prosemirror 集成无 schema recovery 静默删
  内容报警（D3 风险已消除）。
- **D11（同步网关 + y-sweet）**：`BodyBackend` 抽象就绪——InMemory（默认）+
  YSweetBackend（YSWEET_URL 设置时）。`yjs_doc_binary` 周期 dump 走
  snapshot-worker（cron 5min）。**与 §2.5 commit boundary 略偏离**：Phase 1
  没有"显式 commit"按钮，所有 keystroke 通过 y-sweet 持久；周期 worker 按时间
  触发 contribution 写入。Phase 2 加 reviewer agent 时实现 explicit commit。
- **D13/D14（AI runtime + provenance writer）**：`Provenance` 表写入路径
  完全按 §2.3.7 的 `AgentExecutionContext` 形状落地，含 promptHash / modelId /
  toolCalls。**踩坑**：`toolCalls` 空数组在 postgres-js 被误序列化为 PG array
  `{}`（应当为 `[]`）；fix 是空数组写 `null`。**与 §2.3.7 一致**：不存全 prompt
  文本，只存 hash + template id（prompt_template 表里有 verbatim 文本）。
- **D15（双人 e2e）**：Contribution / Provenance / approval_chain 链路完整；
  reviewer (paper-reviewer) 与 author (paper-author) 的 capability 区分按
  ADR-0002 §2.2 default role bundles 工作。

**Phase 2 必须修的遗留**：

- block_metadata 自动维护 trigger（Phase 1 是手动 upsert，Phase 2 加表上 trigger
  保证一致性）
- yjsUpdateBinary 的 reconcile job（Phase 1 是 last-write-wins；Phase 2 加
  周期对比 Y.Doc snapshot 与 contribution 累积，发散即报警）
- ComputationalCell 实体的 schema 化（Phase 1 仅 PM atom 占位，Phase 2 ADR
  落地 `kernel/sourceCode/inputDatasetIds/outputArtifactRefs/executionEnv`）

**Phase 2 不需要修的预判**：

- Y/PG 拆分边界（4 bucket）—— Phase 1 实测无类目 reshuffle 需求
- Principal 抽象（user / agent / shared-link / service）—— shared-link
  Phase 2 加链接共享时不需要 migration（已验证）
- ProseMirror schema atom node + `attrs.<entityId>` 模式—— Phase 1 加 footnote-ref
  / dataset-ref 是 0 schema 改动

---

## 8. Phase 4 / Phase 4.5 implementation review log（§5.D doc-store 抽象诚实度修正）

> 加于 2026-05-11（Phase 4.5 W1.1-W1.2）。回应 codex review 2026-05-11
> §2 ADR-0001 行：codex 指出 doc-store 仍暴露 `yDoc` escape hatch
> （`packages/doc-store/src/types.ts:50-55`），并因此判定 ADR-0001 §5.D
> "Phase 4 W10 评估 Loro / Automerge 3 → 1-2 周可切" 为空话。

### 8.1 Phase 4 W7.1 doc-store 落地实情
- `packages/doc-store/` 真落地了 `DocumentHandle` 抽象 + `YjsDocumentHandle`
  默认实现 + `DocStore` 缓存 + subdocument helper（ADR-0014 W5 子文档绑定的副产品）
- 17 个单元测试 PASS，包括 subdocument lifecycle / encodeStateAsUpdate
  round-trip / observe disposable
- **但**：`DocumentHandle.yDoc: Y.Doc` 作为 escape hatch 暴露，给 3 个 3rd-party
  集成边界使用（y-prosemirror / y-websocket / y-sweet / IndexeddbPersistence）。
  W7.1 JSDoc 上写"new call sites should prefer abstract surface"——
  intent 对，但**没有 grep gate / lint rule 阻止业务代码新增 `.yDoc`**。
- 实际审计（Phase 4.5 W1.1 codex review trigger）：业务代码命中
  `commit.ts:38` (`toYDoc` polymorphic 辅助函数) + `seed.test.ts:90`
  (byte-level 断言)。

### 8.2 Phase 4.5 W1.1 修正
- DocumentHandle 接口扩展 `encodeDelta(baseStateVector: Uint8Array)`，
  覆盖 Yjs `Y.encodeStateAsUpdate(doc, baseStateVector)` 两参数形式。
- `commit.ts` 用 `isHandle` 类型 narrow + 抽象 API 分派
  （`encodeStateVectorOf` / `encodeDeltaOf` / `applyUpdateTo`），不再通过
  `.yDoc` 取底层 Y.Doc。
- `seed.test.ts` 改用 `handle.encodeStateAsUpdate()`。
- `packages/doc-store/src/types.ts` `yDoc` 字段 JSDoc 显式列**允许调用点**
  (3 个 sync-transport 边界) + 业务代码 grep gate。

**审计结果（grep gate 通过）**：

```bash
$ grep -rn '[^/\\\'`]\.yDoc[ .(,;)]' apps packages --include='*.ts' --include='*.tsx' \
    | grep -vE '(doc-store/src|sync/setup|sync-gateway/src/backends/y-sweet|tests/yjs-backend|tests/subdocument)'
(no output — clean)
```

### 8.3 §5.D 估时校正

§5.D 原承诺：

> Phase 4 W10：评估 Loro / Automerge 3 替换；packages/doc-store 抽象将这种切换 buffer 到 1-2 周。

**校正**（基于 W1.1 真实工程量）：

| Loro / Automerge 切换需要做的真实工作 | 实测/预估工时 |
|---|---|
| `DocumentHandle` 抽象接口已就位 + 单元测试 17/17 PASS | ✅ 已完成（W7.1） |
| `encodeDelta` / `encodeStateVector` / `applyUpdate` / `getText` / `getMap` / `getXmlFragment` / `observe` / `transact` / `getSubdocument` 9 个方法的 Loro / Automerge 等价实现 | **3-5 天**（每方法的语义差异需要测试） |
| `y-prosemirror` 替换为 `loro-prosemirror` / `automerge-prosemirror` | **1-2 周**（业务模型迁移，PM step 序列化方式不同） |
| `y-websocket` / `y-sweet` 替换为 Loro / Automerge sync 协议 | **1-2 周**（sync-gateway + snapshot worker 重写） |
| `IndexeddbPersistence` 替换 | **2-3 天** |
| 业务代码 grep gate 已经把"哪些代码需要改"列出来了 | ✅ 已完成（§8.2） |
| 跨 subdocument 行为差异（Yjs subdoc 模型 vs Loro / Automerge 等价物） | **3-5 天** |
| 60 + e2e + 78 + 17 单元测试全部跑通新后端 | **3-5 天** |

**实测估时：2-3 周**（不是 1-2 周）。

**这并不意味着 §5.D 错了**——它意味着：
- doc-store 抽象的**用处真实**（W1.1 把业务代码反射 `.yDoc` 清零的成本是几小时）
- 但**整体后端切换的成本被 §5.D 低估了 50%**——主要被 3rd-party 集成边界（PM binding / sync 协议 / 持久化）吃掉

### 8.4 长期方向

- 不主动启动 Loro / Automerge 切换。Phase 5 trigger 决定是否切换（参
  `plan0/phase-5-trigger.md`）。
- 维护 grep gate：CI 后续可加 `scripts/ydoc-grep-gate.sh` 真自动化（推 Phase 5
  Wave A 视 trigger 决定）。
- 若 trigger 走向 plugin marketplace（Trigger E），sandbox 真启动需要重新
  评估 doc-store 在 plugin 进程间的传递语义——这种场景下 Loro / Automerge
  的 portable binary format 可能比 Yjs subdoc map 更合适，触发条件由那时决定。

---

## 9. References

- `plan0/paper-platform-system-prompt.md` §1-7（"为下一阶段预留的架构空间"，第 143-212 行）
- `plan0/paper-platform-landscape.md`（差异化锚点 + 4 个支点的论证）
- `plan0/phase-0-execution-plan.md` D1 章节（本 ADR 的 spec）
- ADR-0002（权限模型，紧接其后）
- ADR-0005（编辑器 ↔ 渲染器 API 边界，引用 §2.2 atom node 模式）
- Stencila Schema: https://github.com/stencila/schema
- MyST Spec: https://mystmd.org/spec
- Curvenote architecture blog: https://curvenote.com/blog/architecture-of-a-myst-website
- y-prosemirror README（schema recovery 注意事项）: https://github.com/yjs/y-prosemirror
- Yjs subdocuments: https://docs.yjs.dev/api/subdocuments
