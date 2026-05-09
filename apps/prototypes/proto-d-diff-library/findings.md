# proto-d-diff-library findings

> Phase 2 W2 spike. Answers `plan0/phase-2-plan-stub.md §3.3` (UI granularity
> + rebase semantics + library选 prosemirror-changeset vs diff-match-patch)。
> 决策固化在 ADR-0009。本文件记录跑通 `pnpm proto-d:demo` 时观察到的具体行为，
> 给 ADR + Phase 2 W3 实施做证据基础。

跑法：

```bash
pnpm install
pnpm proto-d:demo
```

输出 4 段（base / 单 reviewer 对比 ×2 / rebase 两种情形）。下文逐段贴关键行 +
观察。

---

## 1. base 文档

```
size=114 blocks=2
textContent = "We compare CRDTs and OT in §2. Prior work [Smith2020] claimed
OT scales better.Our findings invert that claim."
```

两段 paragraph，第一段含一个 `cite_inline` mark（citationKey="Smith2020"）。
spike schema 是 `prosemirror-schema-basic` + 一个加上去的 `cite_inline`
mark；够支撑 §3.3 的两个问题，不引论文 schema 全套（citation node、
computational-cell、theorem 等不影响结论）。

## 2. UI granularity（reviewer A 修同一段）

reviewer A 做两件事：把 "CRDTs and OT" 调成 "OT and CRDTs"，把
`[Smith2020]` 改成 `[Smith2023]`。

**prosemirror-changeset**（3 个 Change）：

```
[12..17] → [12..14]  -"CRDTs"  +"OT"             marks=[]
[22..24] → [19..24]  -"OT"     +"CRDTs"          marks=[]
[52..53] → [52..53]  -"0"      +"3"              marks=["cite_inline"]
```

- 三处都标在 block 0；`blocks_touched=[0]`。
- 第三处 Change 的 mark 元数据保留 —— **UI 可以渲染成 "citationKey 由
  Smith2020 改为 Smith2023" 的语义提示**，而不是字符级"0 → 3"。
- 位置是 PM 文档坐标（含 block 边界），所以 RevisionDiff 能把高亮 anchor
  到原 NodeView 上而不是字符流。

**diff-match-patch + cleanupSemantic**（4 个非 equal 段）：

```
delete "CRDTs and OT"
insert "OT and CRDTs"
delete "0"
insert "3"
```

- 看不见 `cite_inline` mark（`citation_lost=true`）。UI 只知道一个孤立的
  字符变化，无法说 "这是引文键的修改"。
- 字符级 segment，没有 PM 位置；要回拉到 PM doc 上需要做 textContent →
  doc 位置的反向映射，该映射本身在 mark / 嵌入节点处不可逆（cite_inline
  span 在 textContent 里只占 11 个字符，但 PM 上跨过 mark 边界）。

→ **block + token-level + mark-aware 三层信息只有 prosemirror-changeset
能给。**

## 3. UI granularity（reviewer B 改另一段 + 增段）

reviewer B 重写第 2 段并新增第 3 段。

**prosemirror-changeset**（3 个 Change）：

```
[82..95]  → [82..99]   -"Our findings "  +"We show that the "
[100..112] → [104..136] -"t that claim"   +"sion holds across three datasets"
[114..114] → [138..173] -""               +"Replication artefact lives in §A."
```

- 第三个 Change `fromA===toA===114`（doc 末），明确是**插入新 block** 而
  非现有 block 的修改。`blocks_touched=[1]`（只命中第二段；新 block 的
  insert 落在 block 1 的尾部位置上——可以在渲染层显式区分）。

**diff-match-patch**（2 个非 equal 段）：

```
delete "Our findings invert that claim"
insert "We show that the inversion holds across three datasets.\n
        Replication artefact lives in §A"
```

- `block_boundary_lost=true`：dmp 把"重写第二段"和"新增第三段"合并成一段
  insert，中间靠 `\n` 分隔。UI 没法把 "新增 §3" 单独渲染成"+1 block"
  指示器；要单独高亮新 block 必须自己识别 `\n` —— 在 schema 含
  computational-cell / theorem-block 等 non-text 节点时这条规则会破。

## 4. Rebase — disjoint block（auto path）

accepted=reviewer A（块 0），pending=reviewer B（块 1 + 新块）：

```
resolution=auto-rebased  applied=2/2  dropped=[]
rebased doc = "We compare OT and CRDTs in §2. Prior work [Smith2023] claimed
OT scales better.We show that the inversion holds across three datasets.
Replication artefact lives in §A."
```

实现：每个 pending step 喂给 `Step.map(accepted.mapping)` 重映射，再
`Transform.maybeStep` 应用。两步都成功 → auto-rebased。

观察：

- B 的 step.from/step.to 都映射通过；A 的修改没有删除 B 的目标位置
- 末尾 insert step 也通过——`Mapping` 把"doc end"映射到新的 doc end
- 最终文档 textContent 同时反映 A 和 B 两套修改

## 5. Rebase — overlap delete（conflict path）

accepted=reviewer A'（删第一段后半句，包含 cite mark 那段文字），
pending=reviewer B'（修同一句的 cite key）：

```
resolution=conflict  applied=0/1  dropped=[0]  failedApplyAt=null
→ surface to UI as 'reviewer-B-prime: edit stranded — sentence deleted by A-prime'
```

`step.map(accepted.mapping)` 对 B' 的唯一 step 返回 null —— 重映射失败，
不是 apply 失败（所以 `failedApplyAt` 是 null）。这个区分很重要：

- `step.map === null` ⇒ pending 想动的范围**已经不存在**了，无法机械重写
- `Transform.maybeStep === failed` ⇒ 范围还在但 schema 不允许那个
  insertion（mark 冲突 / node 类型不接受）

第一类是"sentence-level conflict"，第二类是"schema-level conflict"。UI 表现
不同：前者要求 reviewer 重新基于新 base 重写意图，后者通常是工具 bug 应
报错。

## 6. 直接结论

- **库选 prosemirror-changeset**（不选 diff-match-patch）。三处证据：
  citation mark 保留、block 边界保留、可与 prosemirror-transform 的
  `Mapping` 直接组合做 rebase。
- **UI granularity**：以 prosemirror-changeset 的 `Change` 为最小单位，
  block-level 由 `blocks_touched` 派生，token-level 由 Change 内的
  inserted/deleted Span 派生（必要时给 ChangeSet.create 喂
  `tokenEncoder` 把字符切到 word 边界）。一档 Change 数据结构同时支撑
  block + token + mark 三层视图。
- **rebase 语义**：默认 auto-rebase（`Step.map(mapping)` 全部非空时静默
  应用）；任一 step `step.map` 返回 null 即降级 manual resolve
  UI（reviewer 看到"原 base 文本 + 我提的修改 + 现 base 文本"三栏，重新
  approve / 重新写）。`step.map` 成功但 `maybeStep` 失败的二级情况记
  Sentry，本是工具 bug 而非用户冲突。
- **diff-match-patch 不一定不要**，但只配作 textContent-only 的 fallback
  view（例如 reviewer commentary 里"看 plain 文本对比"小工具）。系统
  of record 是 prosemirror-changeset。

## 7. 验证清单（未来在 Phase 2 W3 实施时回看）

- [ ] ChangeSet.create 在论文 schema（含 computational_cell figure +
      theorem block）上 ranges 仍然正确
- [ ] tokenEncoder 接 ICU word boundary（中英混排）—— Phase 1
      typography pre-pass 已有 CJK 段落分词工具，可复用
- [ ] auto-rebase 在 collaborative 场景下：reviewer agent 与 human
      reviewer 同时改一段时，两方的 PM step 序列都映射通过
- [ ] manual resolve UI 草图（ADR-0009 §2.3 描述）实际打通；当前 Phase 1
      RevisionInbox 是 accept/reject/modify 三态，需要扩成五态
      （accept/reject/modify/auto-rebase-applied/conflict-needs-resolve）
