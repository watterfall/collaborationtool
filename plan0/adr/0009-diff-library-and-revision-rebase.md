# ADR-0009: Diff library + revision overlay UI + rebase semantics

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 2
- **Deciders**: tech-lead
- **Gated on**: Phase 2 W2-W3 实施（reviewer agent + diff UI），与 ADR-0008
  并行；本 ADR 实证基础是 `apps/prototypes/proto-d-diff-library/`

---

## 1. Context

`plan0/phase-2-plan-stub.md §3.3` 三件事尚未拍板：

1. 两个 reviewer 各自 propose 修改时，UI 怎么并列展示 diff？token-level？
   block-level？
2. rebase 的语义：reviewer A 的 revision 已 accept，reviewer B 的 revision
   仍 pending —— B 的 PM step 自动 rebase 到新 base 还是要求手动 resolve？
3. 候选库 `prosemirror-changeset` vs `diff-match-patch`，Phase 2 spike 选一。

Phase 1 D14 的 RevisionInbox 当前只承载 single revision 的 `accept /
reject / modify` 三态，没有 multi-revision overlay；Phase 2 引入 reviewer
agent（ADR-0008）后会出现"document 上同时挂 3–5 个 pending revision，每
个来自不同 reviewer / agent"，diff UI 必须能：

- 把每条 revision 的修改**对齐到 PM 文档**（不是 textContent flat string），
  以保留 citation mark / computational-cell figure / theorem block 等
  schema 语义
- 在某条 revision 被 accept 后，对其他 pending revision 做**确定性 rebase**
- 当 rebase 失败（accept 删除了 pending 想动的范围）给 reviewer 一个
  manual resolve UI 而不是悄悄丢弃

本 ADR **决定**：库选哪一个、Change 数据的 UI 渲染契约、auto-rebase 与
manual resolve 的边界条件。

本 ADR **不决定**：RevisionInbox 的具体 React 组件树（Phase 2 W3 实施时落
具体 UI）；reviewer agent 触发的 conflict 是否要回喂给 agent
（"reviewer-B-prime, your edit was stranded by reviewer A-prime"，留 Phase
3 评估）；historic revision 的"时间机器"视图（Phase 3）。

底层性：本决策 Phase 2 锁定，Phase 3 fork/merge UI 与 Phase 4 章节级隔离
都会复用 ChangeSet 数据结构。库换掉成本高 —— review 严格度按"底层"
对待。

---

## 2. Decision

### 2.1 Library：**prosemirror-changeset**

`@sanity/diff-match-patch`（dmp 的 TS 端口）**不**作为 system of record。
仅可在 reviewer commentary 等 textContent-only 视图里作为 fallback，且不
进 revision 数据流。

**原因**（实证见 `apps/prototypes/proto-d-diff-library/findings.md`）：

| 维度 | prosemirror-changeset | diff-match-patch |
|---|---|---|
| 块边界 | 保留（Change 范围用 PM 位置） | 丢失（textContent flat，块间靠 `\n`） |
| Mark 元数据 | 保留（Span.data 里附带 mark 信息） | 丢失（cite_inline 在 textContent 里只是字符） |
| Schema 节点（cell figure / theorem） | 直接表达成 Change 范围 | 看不见 |
| 与 prosemirror-transform 组合 | 同一坐标系，Mapping 直接可用 | 字符坐标，要反向映射回 PM doc |
| 多 reviewer overlay 元数据 | `combine(dataA, dataB)` API 内置 | 自己写 |
| 维护 | 单包，prosemirror 本家，~600 LOC，零运行时依赖（除 prosemirror-state） | 健康但属性是 textContent 工具 |
| 包大小 | ~12KB min+gz | ~30KB min+gz |

spike 上观察：reviewer A 改 `[Smith2020]` 为 `[Smith2023]`，
prosemirror-changeset 给出的 Change 标注 `marks=["cite_inline"]`，
diff-match-patch 看到的是字符级 `0 → 3`。reviewer B 重写第二段并新增第三
段，prosemirror-changeset 输出三个独立 Change（`fromA===toA===114` 明确是
"在 doc 末插入新 block"），diff-match-patch 把"重写"和"新增"合并成一个
带 `\n` 的 insert 段，无法在 UI 上把"+1 block"指示器单独渲染。

### 2.2 Change 渲染契约（UI granularity）

**所有 revision 的 diff 都以 `ChangeSet.changes: Change[]` 为最小单位。**
Change 的 `fromA/toA/fromB/toB` 是 PM 文档坐标，`inserted: Span[]` 与
`deleted: Span[]` 包含具体内容 + 关联元数据（`Span.data: {author,
revisionId}`）。UI 派生三档视图：

1. **block-level**：从每个 Change 的 `fromA` 反查所在 block index（spike 里
   `blockIndexFor` 的实现），生成"块 0 / 块 1 改了"摘要。RevisionInbox
   sidebar 用本档：每条 pending revision 用一行"reviewer X 改了 §2 §3"。
2. **token-level**：Change 内部的 inserted/deleted Span 直接拿来渲
   染删除线/下划线。`ChangeSet.create(doc, combine, tokenEncoder)` 第三
   个参数喂 ICU word-boundary encoder（中英混排时 reuse Phase 1
   `packages/typography` 的 segmenter），让 Change 边界落在词边界而非字
   符边界。RevisionDiff 主面板用本档。
3. **mark-aware semantic hint**：Span.data 携带的 mark 信息
   （`cite_inline`、`bold` 等）允许 UI 渲染"引文键 Smith2020 → Smith2023"
   这种语义提示，而非裸字符 diff。RevisionDiff 鼠标 hover 出的 popover
   用本档。

**多 reviewer overlay**：每条 pending revision 各自构 ChangeSet（base 都
是 doc 的当前 commit base），UI 把多个 ChangeSet 在同一 PM doc 上"叠
加"渲染：每条 Change 关联 `revisionId + author`，gutter 用作者颜色编码
（reviewer-A 蓝、reviewer-B 紫、agent reviewer 橙），点击 gutter 标记
→ 高亮该条 Change 的所有 Span。两个 revision 命中同一 Change 范围时显式
"两位 reviewer 都想改这里"——不在 diff 视图里悄悄合并，强制让作者一条
一条 review。

**禁止**：把多个 ChangeSet 通过 `addSteps` 串成单一线性 history。每条
revision 都以 base 为根独立计算，避免"reviewer A 改了 → reviewer B 改了
→ 我现在看到一个混合 diff，不知道哪条来自谁"的退化。

### 2.3 Rebase semantics

**默认 auto-rebase**。`accept(revision A)` 后，对每条仍 pending 的
revision B：

```ts
function rebasePending(accepted: Transform, pending: Transform):
    | { kind: "auto-rebased"; rebased: Transform }
    | { kind: "conflict"; reason: "step-stranded" | "schema-rejected"; droppedSteps: number[] } {
  const working = new Transform(accepted.doc);
  const dropped: number[] = [];
  let schemaRejected = false;
  pending.steps.forEach((step, idx) => {
    const remapped = step.map(accepted.mapping);
    if (!remapped) { dropped.push(idx); return; }
    const r = working.maybeStep(remapped);
    if (r.failed) { dropped.push(idx); schemaRejected = true; }
  });
  if (dropped.length === 0) return { kind: "auto-rebased", rebased: working };
  return {
    kind: "conflict",
    reason: schemaRejected ? "schema-rejected" : "step-stranded",
    droppedSteps: dropped,
  };
}
```

两类 conflict：

- **step-stranded** （`step.map === null`）：accept 删除了 pending 想改的
  范围。UI 必须降级 manual resolve：
   - 三栏视图："原 base 文本（已废）" / "我（reviewer B）原本提的修改" /
     "新 base 文本"
   - reviewer B 三选一：(i) 在新 base 上重新提 revision；(ii) 撤回此条
     revision；(iii) 标记 "我的修改与 A 不冲突，请作者保留"——后端
     直接 superseded
- **schema-rejected** （`maybeStep().failed`）：rebased step 在新 doc 上
  schema 不允许（极少见，通常说明工具 bug，例如 mark 间互斥规则没考虑
  到）。Sentry 报错 + 自动降级到 step-stranded UI。

**spike 实证**：disjoint-block 场景（A 改 block 0，B 改 block 1+ 加
block 2）auto-rebase 应用全部 step；overlap-delete 场景（A' 删掉 B' 想
改的句子）`step.map` 返回 null，`droppedSteps=[0]`，干净降级到
conflict 路径。`failedApplyAt=null` 验证两类 conflict 在 reason 字段上
分开。

**Reviewer agent 的对接**：reviewer agent（ADR-0008）也走同一路径——它
触发的 revision 同样在 accept 时给其他 pending 做 auto-rebase，conflict
时同样降级 manual resolve。是否把 conflict 通知回喂给 agent（"你提的
revision 因为 X 已经废了，要不要重做"），留 Phase 3。

### 2.4 数据模型与 schema 影响

不需要新表。现有 `revision.proposal_metadata` jsonb 字段（D14 引入）扩
充字段：

```ts
type RevisionProposalMetadata = {
  fragments?: ProposalFragment[];     // D14 已有
  uncertainties?: string[];           // D14 已有
  // 新增：
  baseCommitId: string;               // 这条 revision 是基于哪条 commit 计算 ChangeSet 的
  changeset: SerializedChangeSet;     // ChangeSet.changes 序列化（UI 渲染快路径，避免每次重算）
  rebaseHistory?: Array<{             // 该 revision 经历过几次 auto-rebase
    at: string;
    fromCommitId: string;
    toCommitId: string;
    droppedSteps: number[];           // 历史 conflict 记录（应该都是空，否则 revision 本身已被踢出 pending）
  }>;
};
```

`SerializedChangeSet` 是 prosemirror-changeset 的 `Change[]` 直接 JSON
化（`fromA/toA/fromB/toB/inserted/deleted` 都是 plain），加上每个 Span 的
`data: {author, revisionId, marks?: string[]}`。客户端 lazy 重算
ChangeSet 的能力保留（base + revision steps 即可重新生成），缓存只是为了
列表场景不重启 prosemirror。

revision.status 现有 `'pending' | 'accepted' | 'rejected'` 三态，本 ADR
**不**加新状态。conflict 走 manual resolve UI 的分支不是状态——状态仍是
`pending`，UI 上多一个"⚠ 需要重新 base"的徽章。reviewer 三选一后才转
`rejected` 或新建 revision（`pending`，新 baseCommitId）。

### 2.5 实施时序（Phase 2 W2-W3）

- W2.1：`packages/diff-revision`（新包）封装 ChangeSet.create + 序列化 +
  rebase。提供给 ai-runtime（让 reviewer agent 输出走同一路径） + apps/web
  （RevisionDiff 渲染） + apps/agent-worker（accept 后批量 rebase 触发）。
- W2.2：迁移 RevisionInbox 到多-revision overlay；保留 D14 三态 API
  形状。
- W3.1：manual resolve UI（三栏视图）+ reviewer "三选一" 端点
  `POST /api/revision/<id>/resolve-rebase {action: 'redo'|'withdraw'|'supersede'}`
- W3.2：Playwright e2e 加 multi-reviewer rebase scenario：accept reviewer
  A → reviewer B 的 pending 自动 rebase / accept reviewer A' → reviewer
  B' 进 manual resolve

---

## 3. Consequences

### Good

- **PM-native**：diff、rebase、UI 三层都在 PM 坐标系上，与 Phase 1 D10
  commit serializer + Y.Doc 协同；不引入二阶段坐标系映射
- **零新基础设施**：prosemirror-changeset + prosemirror-transform 已在
  editor-core 间接依赖（`@tiptap/pm`）；新增的 `packages/diff-revision`
  纯 TS、无服务、无表
- **Reviewer agent 与 human reviewer 走同一 rebase 路径**：ai-runtime 不
  需要"agent 专属冲突逻辑"
- **Conflict 不静默丢弃**：step-stranded 强制 reviewer 三选一，满足 paper
  platform 系统提示词 §10 的"作者完全控制"原则（不让 LLM 改的 revision
  在 rebase 里悄悄消失）
- **spike 可重跑**：`pnpm proto-d:demo` 任何人三秒重现，回归看得见

### Bad / Trade-offs

- **prosemirror-changeset 不自带 rebase**：rebase 逻辑住在
  `packages/diff-revision`；如果上游某天加了，要评估迁移
- **token-level 边界依赖外部 segmenter**：纯 ASCII 时 prosemirror-changeset
  自带 DefaultEncoder 够用，但中英混排必须接 ICU word boundary（reuse
  typography 的 segmenter，多一处耦合）
- **ChangeSet 缓存在 jsonb 里**：base 文档变了（不是常态，但 admin 重写
  doc 时可能）会让缓存过期；Phase 2 W2 加 `revision.proposal_metadata
  →baseCommitId` 校验，base 不匹配则前端重算
- **多 revision overlay 在视觉上拥挤**：5+ pending revision 同时渲染时
  gutter 颜色不够；Phase 2 W6 用 e2e 场景验证一次再决定是否折叠

### Neutral / Need watching

- **diff-match-patch fallback 是否真的有用**：Phase 2 W3 实测后决定。
  如果 reviewer commentary 永远走 PM-aware 视图，删除 dmp fallback。
- **`combine` 函数在多 reviewer overlay 的语义**：spike 没用 combine
  （单 author per ChangeSet）。Phase 2 W3 真做 overlay 时，需要决定
  "Span.data" 在两 revision 命中同 Span 时合并成 `{authors: ['A','B']}`
  还是分裂成两个 Span。倾向后者（保留 1:1 author/Span 关系），但要确
  认 prosemirror-changeset 的 `simplify` pass 不会反向合并。
- **rebase 的 audit trail**：每条 revision 在 jsonb 里记 rebaseHistory
  数组，5 次 rebase 后 jsonb 变长但仍 < 1KB 量级；Phase 3 fork/merge UI
  起来后再看是否要单独表

---

## 4. Alternatives considered

### A: diff-match-patch 作为 system of record

把 textContent flat string 当作 diff 的根，所有 reviewer revision 都以
plain text 表达。

**为什么不选**（spike §2、§3 数据）：

1. **Citation mark 完全丢失** —— `[Smith2020]` 改 `[Smith2023]` 在 dmp
   视角是字符级 `0 → 3`，UI 没法说"这是引文键修改"，作者必须自己看出来
2. **块边界丢失** —— 重写第二段 + 新增第三段在 dmp 视角是带 `\n` 的单
   段 insert，无法分别渲染
3. **Schema 节点（computational cell figure / theorem block / table）在
   textContent 里就是空字符或占位字符串**，dmp 看不见
4. **rebase 必须自己写**，且要做 textContent ↔ PM doc 反向位置映射
   （非平凡，特别是 mark 边界）
5. paper platform 的差异化在"语义级 diff"（system prompt §15），降级到
   字符 diff 与定位冲突

**什么情况会回头**：reviewer commentary 等 textContent-only 子视图里
作为 fallback 工具是 OK 的（§2.1 留了口子）；但 system of record 不行。

### B: Yjs 内置 update diff（`Y.diffUpdate` / `Y.encodeStateAsUpdate`）

用 CRDT 层的二进制 update 做 diff。

**为什么不选**：

1. **二进制 unreadable**：Y update 是 lib0 编码字节流，没有 PM 语义
   (block / mark) 概念
2. **CRDT 的 "diff" 是 op-set diff**，跟用户感知的"我改了哪段文字"
   不重合（concurrent insert 在 Y 视角是两条 op，在 PM 视角可能是一段
   连续 insert）
3. Y 层的"哪些 op 来自谁"用 clientID 标记，无法直接对应到具名 reviewer
   或 agent
4. ADR-0001 §2.4 已经把 `revision.proposal_metadata` + commit
   serializer 作为"用户层修改"的 source of truth，diff 也应在该层

**什么情况会回头**：Phase 4 把 collab 模式从"y-prosemirror + commit
boundary"切到"OT-on-server"时（不在路线图，但若发生），diff 可能也跟
着切回 op-level。

### C: 自写 PM JSON 树 diff（jsondiffpatch / 自定义 walker）

把 PM doc 当 JSON 树做结构 diff。

**为什么不选**：

1. **JSON tree diff 不知 PM 语义**：mark 在 JSON 上表达成属性数组，jsondiffpatch
   在两份"内容相同但 mark 顺序不同"的 marks 数组上会误报为 modified
2. **位置不对齐 PM Mapping**：PM-transform 的 Step + Mapping 是 PM 编辑
   操作的代数；JSON-tree diff 给出"路径变化"，要回拉到 Step 是从无到有
3. **rebase 完全做不了**：JSON tree diff 没有"把这条 diff 重映射到新
   tree"的概念

**什么情况会回头**：不会。PM 已经有 changeset 库，没有理由重写一个低
质量等价物。

### D: 双库（prosemirror-changeset + diff-match-patch）作 dual stack

PM-aware 视图用 changeset，textContent 视图用 dmp，并列展示。

**为什么不完全选**：dual stack 是数据流而非 system of record。本 ADR §2.1
明确"dmp 不进 revision 数据流"，但 §2.1 末尾允许 reviewer commentary 视
图 fallback 到 dmp（reviewer 在 thread 里贴一段纯文本时显示 textContent
diff 是合理的）。所以**部分选**——主路径 changeset，fallback 视图允许
dmp。

---

## 5. Decision log

- **2026-05-09**: spike 实证（apps/prototypes/proto-d-diff-library/）。
  reviewer A 的 cite key 修改在 dmp 视角是"0 → 3"裸字符，证明文本-only
  视角丢失语义；reviewer B 的"重写 §2 + 新增 §3"在 dmp 视角合并成单段
  insert，证明块边界丢失
- **2026-05-09**: rebase 走 `Step.map(mapping)`，不引入新算法。
  prosemirror-transform 的 Mapping 已是 OT-style 重映射的标准实现；
  `Step.map === null` 与 `maybeStep().failed` 自然区分两类 conflict
- **2026-05-09**: revision.proposal_metadata 扩 `baseCommitId` +
  `changeset` + `rebaseHistory`，**不**加新表。jsonb 续命到 Phase 3
  fork/merge 时再评估
- **2026-05-09**: 多 revision overlay 显式禁止"线性 history 串接"。
  每条 revision 各自 ChangeSet 根于 base，UI 叠加渲染。原因：
  避免"我看到一个混合 diff，不知道哪条来自谁"的退化
- **2026-05-09**: conflict 不引新 revision.status；status 仍是 pending +
  UI 徽章 "需重新 base"。reviewer 三选一后才转状态。原因：
  (i) revision lifecycle 不爆炸；(ii) "pending 但需要重新 base" 与
  "pending 但等审" 业务上没本质差别，只是 UI 提示的额外维度

---

## 6. References

- `plan0/phase-2-plan-stub.md §3.3`（开放问题，本 ADR 答全部三件）
- `apps/prototypes/proto-d-diff-library/`（spike 代码 + findings.md）
- ADR-0001 §2.4（PM step + commit boundary 是"用户层修改"的 source of truth）
- ADR-0008 §2.3（reviewer agent 输出 → revision，与 human reviewer 同
  数据路径；本 ADR 是该路径的 diff/rebase 层）
- prosemirror-changeset README: https://github.com/prosemirror/prosemirror-changeset
- prosemirror-transform Mapping: https://prosemirror.net/docs/ref/#transform.Mapping
- @sanity/diff-match-patch: https://github.com/sanity-io/diff-match-patch
- Phase 1 D10 commit serializer: `packages/editor-core/src/commit.ts`
- Phase 1 D14 RevisionInbox: `apps/web/src/components/revision-inbox/`
