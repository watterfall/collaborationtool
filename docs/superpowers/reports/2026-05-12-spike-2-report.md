# Spike-2 完工报告 — packages/vault-fs/ markdown ↔ Y.Doc Reconcile

> Phase 6 Spike-2 / 2026-05-12 / branch: `claude/spike-2-vault-fs`

## 验收对照（design spec §8 Spike-2）

| 验收项 | 结果 | 备注 |
|---|---|---|
| 5 fixture 全 pass（cold-start / external-edit / 3-way merge / sidecar 损坏 / sync 中断） | **PASS** | 5/5 — `tests/fixture-*.test.ts` |
| markdown emit 通过 Design.md §11 reject grep | **PASS** | task 10 — `tests/ydoc-to-markdown.test.ts` 第 5 测；grep banned Tailwind palette / hex 颜色 / shadow tokens |
| Y.Doc → markdown emit 与 PM JSON wire format（ADR-0005）兼容 | **PASS** | task 11 review log — `emitMarkdown` 严格走 PM JSON 中间表示，未引入第 2 wire format |
| 5 客户端 stress 1000 ops + offline/online 切换 → CRDT 最终一致 + markdown 单一 | **PASS** | task 9 — `tests/stress.test.ts`；5 client × 1000 op + 1000-op offline 窗口（op 1000-1999 client-0 不参与同步），最终 mesh sync 后所有 5 client 的 `Y.Text.toString()` 严格相等，emit markdown 严格相等 |

**Test 总计**：31 tests PASS / 0 fail / 12 suites（vault-fs 包内）。

## Failure mode 命中？

- [ ] markdown reconcile 复杂度 > Phase 6 W3-W4 预算 2x → 倒退到 sqlite + markdown export-only
  - **实测**：未命中。Spike-2 6 个核心 API（emitMarkdown / parseMarkdown /
    readSidecar / writeSidecar / watchVault / detectDrift / threeWayMerge）
    在 ~6 小时内全部落地 + 测通 31 测。三个真实 API deviation 都在 plan
    标注的"可能命中"范围内（plan 已警告 paperSchema 函数 / mark 别名 /
    fragment 命名 3 处），impl-time 修复成本 ~30 分钟。custom node markdown
    directive 推 Phase 6 W3-W4 是显式 scoped decision，非 spike 失败信号。

## Time 总计

- Plan estimate: 5-7 天（计入 markdown directive 真实现）
- **Actual (Spike-2 only): ~6 小时** （单 session，TDD 12 task）
- 主要 under-run 原因：
  - paper-schema custom node directive 解析显式推 Phase 6 W3-W4（用 HTML
    comment 兜底足够证明双向 reconcile 可行）
  - 3-way merge 用 naive line diff 而非 Myers diff（PoC 质量足够 surface
    conflict region；UI 决策非 Spike-2 scope）
  - 跨平台 chokidar quirks 无（macOS host，3 测一次 PASS 无 flaky retry）

## API deviation 记录（plan-vs-impl，已修在 impl + 记入 ADR-0001 §8.6）

1. **`yXmlFragmentToProsemirrorJSON` 签名**：plan 写 `(yDoc, 'prosemirror')`
   二参；实际 `y-prosemirror@1.3.7` 是 `(xmlFragment)` 单参。
   修复点：`packages/vault-fs/src/ydoc-to-markdown.ts:103`
2. **Stress harness Y.Text → Y.XmlText**：plan 用 `Y.Text` 作为 paragraph
   子节点；y-prosemirror serializer 期待 `Y.XmlText`（plain `Y.Text` 触发
   "Unexpected case"）。
   修复点：`packages/vault-fs/src/stress-harness.ts:65`
3. **Multi-client setup seed sharing**：plan 让每 client 各自 `setupClient()`
   建独立 paragraph，merge 后 5 paragraph 各自独立。
   修复点：`packages/vault-fs/src/stress-harness.ts:108-114` — client-0 创
   seed → 其他 4 client `applyUpdate(seed)` 克隆，所有 client 共享同一
   paragraph identity。

## Commit 范围

12 commits on `claude/spike-2-vault-fs`，从 `60281ce` 到 `2bae3dc`：

```
60281ce P6(spike-2 task 1): packages/vault-fs/ workspace 注册 + 空 scaffold
32d021c P6(spike-2 task 2): emitMarkdown — Y.Doc → markdown serializer
2f79d4b P6(spike-2 task 3): parseMarkdown — markdown → Y.Doc parser
93144a2 P6(spike-2 task 4): sidecar-io — atomic read/write + magic header
2e0221b P6(spike-2 task 5): file-watcher — chokidar wrap，.vault/ 排除
6ece3bd P6(spike-2 task 6): drift-detector — sha256 hash 比较
321fcbd P6(spike-2 task 7): three-way-merge — diff3 surface conflicts
cf055a5 P6(spike-2 task 8): 5 验收 fixture tests（spec §8）
35ba548 P6(spike-2 task 9): stress harness — 5 client × 1000 ops + offline/online
ae960e7 P6(spike-2 task 10): Design.md reject grep on markdown emit — 1 测
2bae3dc P6(spike-2 task 11): ADR-0001 §8.6 + ADR-0005 review log + README
(task 12 report — 本文件)
```

## 后续

- **Phase 6 W3-W4** — doc-store `FileSystemBackend` 真接入 vault-fs；
  markdown-it directive plugin 真实现 `::claim{...}` 解析；diff3 改 Myers
  算法；canonicalizer 加 trailing-blank 归一化；3-way merge UI 在
  apps/desktop（Spike-1 artifacts 集成）
- **三 Spike 全 PASS 后** — 启 ADR-0017 (client-first runtime) / ADR-0018
  (open content) / ADR-0019 (plugin runtime) 从 Proposed 状态推到 drafting
- **本 PR 不动 STATUS.md**（orchestrator 合并后同步）
