# ADR-0014: Yjs subdocument 章节级拆分 + cross-reference sync

- **Status**: Proposed
- **Date**: 2026-05-10
- **Phase**: 4 W5-W6
- **Deciders**: tech-lead
- **Gated on**: Phase 4 W5-W6 dogfood gate（50 客户端 stress + cross-doc reference sync 真跑）

---

## 1. Context

### 1.1 起因

ADR-0001 §6 long debt 列了 "Yjs subdocuments" 作 Phase 3 大文档拆分预留；
Phase 2 stub §四 + Phase 3 stub §2.4 反复延后到 Phase 4。Phase 3 W1-W7
backend 已落 + 5-10 人 Phase 2.5 实测稳定；Phase 4 W5-W6 实施 50+ 协作者
+ 章节级隔离 + Yjs subdocument 拆分。

### 1.2 触发条件 = 真痛点

不再是"理论上 50 人"，而是 dogfood 出现以下任一：

1. 单 Y.Doc body XmlFragment 超过 ~50k 节点 → IDE 加载延迟 > 2s
2. 单文档同时 active 客户端 > 20 → CRDT awareness payload 互发增加 RTT
3. 用户诉求"我只想 share §3 给评审，不想暴露草稿其他章节" → 章节级 ACL
   要求 subdocument 边界

dogfood report 满任一条 → Phase 4 W5 启动；都不满 → 推 Phase 5 review。

### 1.3 与 Phase 3 已落地的关系

- Phase 3 W4 maintenance_finding 表已假设 cross-doc 视野（vault scope）—
  subdocument 不破坏：finding 仍指向 root document.id + 子 doc 边界由
  block_metadata.subdocument_id 字段补
- Phase 3 W5 plugin_install + W7 user_model_pref 全是 root principal 范围；
  不受 subdocument 影响
- Phase 1 D8 capability_grant resourceType='document' / 'block' — Phase 4
  W5 加 'subdocument' enum 第三档（block 太细 / document 太粗）

### 1.4 哲学约束

1. **避免过度抽象** → subdocument 只在真痛时拆；不为"未来 1000 人"预留
   非必要复杂度
2. **新技术敢上** → Yjs subdocument API 是官方一等支持（Phase 1 调研已
   选 Yjs over Loro/Automerge）；不引入第三方 wrapper
3. **平台性头号** → 跨 subdocument cross-reference 必须 first-class（§3
   引用 §1 的 Figure 不能断）
4. **Typst > LaTeX** → render-typst emitter 已跨 block 处理引用；
   subdocument 切割不影响渲染（emitter 跨 root + sub 走同 PM JSON）

---

## 2. Decision

### 2.1 拆分粒度：**heading-1 章节为默认 subdoc 边界**

- **粗粒度**：每个 heading-1 (`# ...`) 起一个 subdocument；root doc 仅
  存 metadata + subdoc 引用 + 跨章 figure/citation 共享 store
- **细粒度兜底**：用户可手动 split / merge subdoc（"把这两个 §合并"）
- **不做 block 级拆**：每 block 一个 subdoc 是 ADR-0001 §三 alt B 已
  rejected 路径（CRDT 元数据 overhead > 内容本身）

理由：与作者"章节"心智模型一致；ACL 自然边界；50 节比 5000 块容易管。

### 2.2 cross-reference sync：**root doc 持有 shared store**

- root Y.Doc 顶层 `Y.Map("crossRefs")` 持有 figureId / citationId / claimId
  → 出现位置 (subdocId + blockId) 的索引
- subdocument 内 figure / claim 在创建时写一条 crossRef 入 root map
- 引用方 subdocument 渲染 `[ref:figure-3]` 时查 root crossRefs map → 找
  到 target subdoc → load on demand
- 删除 figure 时同时清 root crossRefs 行（subdoc 内 transaction 同步触发
  root update via subdoc-on-update event）

理由：避免引用方持有 figure 内容副本（chuncky duplication）；root map 是
单一 source of truth for cross-section dependency。

### 2.3 拆分时机：**自动 + 手动双轨**

- **自动**：root doc heading-1 数 ≥ 5 且总 prose ≥ 30k 字 → snapshot-worker
  在下一次 snapshot 时自动 split（用户后台无感）
- **手动**：用户在编辑器 §header 右键 "拆为独立 subdocument"；逆操作
  "merge into parent"
- **不自动 merge**：减小风险（自动 merge 撞 conflict 体验差）

### 2.4 ACL：subdocument 独立 ACL，root 继承可读

- `documentAcl` 加 `subdocumentId` nullable 列；null = root scope（既有行
  为）；非 null = subdocument 专属 grant
- 默认：root doc ACL 适用全 subdocs（向后兼容）
- 显式覆盖：用户为某 subdoc 单独 invite/revoke（"§3 给外部评审"）
- capability_resource_type enum 加 'subdocument' 第三档

### 2.5 PG schema 改动

新表 + 字段：

```
-- 25. subdocument (Phase 4 W5 ADR-0014) — root document 子单元
CREATE TABLE subdocument (
  id text PRIMARY KEY,                      -- subdoc:<uuid>
  root_document_id text NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  parent_subdocument_id text REFERENCES subdocument(id),  -- 嵌套支持
  title text NOT NULL,
  ord integer NOT NULL,                      -- root 内排序
  ysweet_doc_name text NOT NULL UNIQUE,      -- y-sweet 端独立 doc
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- 既有 block_metadata 加 subdocument_id 列
ALTER TABLE block_metadata ADD COLUMN subdocument_id text REFERENCES subdocument(id);

-- 既有 document_acl 加 subdocument_id 列
ALTER TABLE document_acl ADD COLUMN subdocument_id text REFERENCES subdocument(id);

-- 26. crossref_index (Phase 4 W5) — root crossRef map 的 PG 镜像（dump 备份用）
-- Y.Doc 是 source of truth；PG 只做 maintenance scan + search 索引
CREATE TABLE crossref_index (
  id text PRIMARY KEY,
  root_document_id text NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  ref_kind text NOT NULL,                    -- 'figure' | 'citation' | 'claim' | 'evidence'
  ref_target_id text NOT NULL,               -- e.g. figure-id, claim-id
  source_subdocument_id text REFERENCES subdocument(id) ON DELETE CASCADE,
  source_block_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crossref_index_root_idx ON crossref_index (root_document_id, ref_kind);
CREATE INDEX crossref_index_target_idx ON crossref_index (ref_target_id);
```

### 2.6 W5-W6 dogfood gate criteria

参考 ADR-0010/0012 三项 criteria 模式：

1. **真 50 客户端并发**：50 个客户端 join 同 root doc 不同 subdoc 写 +
   awareness 显示在线人数 + 单客户端 RTT < 200ms（实测 LAN）
2. **跨 subdoc reference 真同步**：subdoc-A 加 figure → subdoc-B 引用立即可
   见；subdoc-A 删 figure → subdoc-B 引用 fallback 显示 "broken-ref" 标
3. **subdocument-level ACL 真生效**：仅授权 subdoc-3 的外部评审 join 时
   只看到 subdoc-3 内容；尝试 read subdoc-1 → sync-gateway 拒（4xxx close
   code）

不通过则停止 W7+，重新设计 ADR-0014。

---

## 3. Consequences

### 3.1 正面

- 50+ 协作者 + 大文档解锁
- ACL 颗粒度匹配作者心智（章节）
- snapshot 增量化：只对改过的 subdoc 跑 snapshot-worker（大幅降负载）
- maintenance scan 可按 subdoc 并行

### 3.2 负面

- y-sweet 后端 doc 数量乘 5-10 倍（一个 paper 5-10 章节 = 5-10 doc）；
  storage IOPS 上升
- editor-core sync transport 必须支持多 subdoc connections 同时挂载（既
  有 Phase 1 D11 是单 connection）
- snapshot-worker / agent-worker 需识别 subdoc 边界
- "我搜索整篇文档"操作需跨 subdoc 聚合（编辑器右上 Cmd+F）

### 3.3 长期债

- 无限嵌套 subdocument（subdoc-of-subdoc）推 Phase 5+；本 ADR 只支持
  root → subdoc 单层
- subdocument 内 figure 跨 root 边界（多 paper 共享 figure）推 Phase 5+
- subdocument-level branch / fork（章节级 fork）走 ADR-0009 既有 revision
  路径，不开新 ADR
- Loro / Automerge 3 切换若发生，subdocument API 需重新映射（W10 Phase 4
  review）

---

## 4. Alternatives considered

### 4.1 单大 Y.Doc 不拆（rejected）

**拒绝**：50+ 客户端 awareness/CRDT broadcast 量随客户端数平方增长；100k+
PM nodes 加载时间不可接受；ACL 仅文档级 — 无章节边界。

### 4.2 每 block 一个 Y.Doc（rejected）

**拒绝**：ADR-0001 §三 alt B 已 rejected；CRDT 元数据 overhead >> 内容；
cross-block reference 退化为 cross-doc 协调，复杂度爆。

### 4.3 把 root document.id 拆成多 root（rejected）

**拒绝**：Phase 1 D7 + ADR-0001 已锁定 document.id 是论文级唯一标识 —
拆 root 破坏 citation / agent_job / claim 的 document_id FK 语义；UX 上
"一篇 paper" 概念散裂。

### 4.4 完全 Postgres-only 写协作（rejected）

**拒绝**：Phase 0 ADR-0001 已锁定 Y.Doc 模型；切 PG-only 是 phase reset
不是优化；用户哲学反对兼容性切换。

---

## 5. Open questions（W5 实施时落实）

- **subdoc autoload 策略**：用户打开 root 时 lazy load subdocs（按需）
  还是 eager（首屏）？倾向 lazy + scroll-near 触发 prefetch
- **crossRefs Y.Map vs PG 主存**：Y.Map 实时性好但 multi-reader scan 不便；
  倾向 Y.Map 主 + crossref_index PG 表后台增量同步（dual write 但 Y.Map
  authoritative）
- **subdocument 排序变更触发**：用户拖动 §3 → §1，所有 subdoc.ord 重排是
  否触发 root snapshot 重建？倾向"是"，但 batch 30s 节流
- **subdoc 内 PM schema 是否同 root**：默认是；但 special subdoc（appendix
  / glossary）是否允许定制 schema？推 Phase 5
- **rebase across subdoc**：reviewer 在 subdoc-A 修改触发 cross-ref
  redirect 至 subdoc-B 时的合并语义？复用 ADR-0009 prosemirror-changeset
  per subdoc，跨 subdoc 引用 lazy resolve

---

## 6. 与其他 ADR 的关系

- **ADR-0001**: 长期债"Yjs subdocuments"在本 ADR 落地；§6 加 review log
  指向本 ADR
- **ADR-0002**: capability_resource_type enum 加 'subdocument'；不破坏
  既有 36 词汇
- **ADR-0009**: section fork/merge 走既有 revision/rebase 路径，subdoc
  内独立（Phase 4 W7 实施）
- **ADR-0011**: claim/evidence 仍以 root document.id 为主键 owner，
  source_block_id 可指 subdoc 内 block；Evidence Map cross-doc query 走
  crossref_index
- **ADR-0004**: y-sweet 后端 doc 数量增加 10×；SELF_HOST.md 加 storage
  size 估算更新

---

## 7. Review log

### Phase 4 W5 启动 backend (2026-05-10)

W5 启动 commit 落 schema + 纯 PM 边界检测器，让后续 sync-gateway 重路由
+ snapshot-worker 增量改造能拼起来：

- **Migration 0011**：`subdocument` 表 + `crossref_index` 表 +
  `block_metadata.subdocument_id` 软外键 + `document_acl` PK 重构（surrogate
  `id` + `(document_id, principal_id, subdocument_id)` 唯一索引 NULLS
  NOT DISTINCT）+ `capability_resource_type` enum 加 'subdocument' 第五档
- **Drizzle schema**：`subdocument` / `crossrefIndex` / 既有表 alter 同步；
  既有 `materialiseRoleBundle` 加可选 `subdocumentId` 参数（root 兼容
  默认 null）
- **editor-core 纯 walker**（`packages/editor-core/src/subdocument/`）：
  - `detectSubdocBoundariesByH1(pmJson)` —— 按 heading-1 切；Preamble 兜
    底（pre-h1 内容自成 ord=0）；空 heading 走 "Section N" fallback；
    h2/h3 不切
  - `extractCrossRefs(pmJson)` —— 4 类 ref 抽取（citation / dataset → kind=
    citation / figure / claim / evidence）+ (kind, target, sourceBlockId)
    去重 + 跳过无 enclosing block 的 ref
  - 14 单元测试覆盖 split + extract 主路径与边界
- **typecheck**：全 workspace PASS（既有 e2e fixtures + permissions
  acl-loader test 跟着 PK 重构同步更新）

dogfood gate 仍未跑（等 sync-gateway 多 subdoc 路由 + snapshot-worker
增量 + 真 50 客户端 stress + cross-doc ref 真同步 + subdoc-level ACL
真生效）。

### dogfood gate 待补（W5-W6 末填）

预期内容：(a) gate 三项 pass/fail；(b) y-sweet 多 doc 实测开销（IOPS /
storage）；(c) §5 open questions 答案；(d) crossref_index dual-write
是否成立 vs Y.Map 单主。
