# @collaborationtool/vault-fs

Phase 6 Spike-2 PoC — markdown ↔ Y.Doc reconcile + sidecar IO + file watch
+ 3-way merge for the client-first pivot.

**Status:** Spike-2 / Proof of concept (2026-05-12). NOT consumed by
`apps/web` yet. `packages/doc-store/` FileSystemBackend in Phase 6 W3-W4
will be the first real consumer.

## 目的

`docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §4 描述的
"`packages/vault-fs/` 组件"，验证以下能力可以纯 TypeScript 实现，无需 Tauri
依赖、无需 sandbox：

1. `emitMarkdown(yDoc: Y.Doc): string` — Y.Doc → markdown
2. `parseMarkdown(md, baseDoc?): Y.Doc` — markdown → Y.Doc
3. `readSidecar / writeSidecar(path, bytes)` — atomic `.vault/yjs/*.bin` IO
   with magic header & corruption detection
4. `watchVault(path, handler)` — chokidar wrap with `.vault/` exclusion
5. `detectDrift({ yDoc, markdownFileContent })` — sha256 hash diff
6. `threeWayMerge({ base, local, remoteMarkdown })` — diff3-style conflict
   region surface
7. `runStress({ clientCount, opsPerClient, offlineRound? })` — 5 client CRDT
   convergence harness

## 本地起步

```bash
# install (run at repo root)
pnpm install

# run all 30 tests (4 sec)
pnpm vault-fs:test

# typecheck (pnpm proxy hits ERR_PNPM_IGNORED_BUILDS on sharp@0.34.5;
# bypass with direct npx tsc):
cd packages/vault-fs && npx tsc --noEmit
```

## 已知局限（Phase 6 W3-W4 收尾）

- **Custom paper-schema nodes**（claim / evidence / figure / etc）emit 为
  `<!-- nodeName {...} -->` HTML comment 兜底；Phase 6 W3-W4 替换为 MyST
  markdown directive (`::claim{...}`) syntax via 自定义 markdown-it plugin
- **defaultMarkdownParser 不支持** bullet_list / ordered_list / list_item /
  blockquote / code_block / horizontal_rule / hard_break / image —
  Spike-2 flatten 为 paragraph；Phase 6 W3-W4 给 paperSchema 加这些
  extension 后切换为 native 表示
- **3-way merge** 用 naive line diff（O(n²) overlap detection）；Phase 6
  W3-W4 swap Myers / Patience diff，加 UI 让 user 决策 conflict 而非默认
  local-wins
- **drift-detector 不 canonicalise**（trailing blank 算 drift）；Phase 6
  W3-W4 加 canonical normalizer
- **stress harness** 仅插入操作（无 delete / mark / nested node 修改）；
  Phase 6 W3-W4 加 op variety
- **无 ed25519 / provenance**（Phase 6 W1-W2 由 `packages/identity/` 单独）

## API deviation 备忘

实现过程中纠了 plan 里的 3 个 API 不一致（已记在 ADR-0001 §8.6）：

1. `yXmlFragmentToProsemirrorJSON` 是单参数 (XmlFragment)，不是 (yDoc, name)
2. stress harness 子 paragraph 必须用 `Y.XmlText`（不是 `Y.Text`）—
   y-prosemirror serializer 否则 throw "Unexpected case"
3. multi-client stress setup 需要 seed 共享：client-0 创建 paragraph + 其
   余 client `applyUpdate(seed)` 克隆，否则每 client 创建独立 paragraph，
   merge 后 5 个并存

## 下一步

- Phase 6 W3-W4：`packages/doc-store/` 实现 `FileSystemBackend`，消费
  vault-fs 提供的 6 个 API，把 doc-store handle 接 markdown + sidecar 双轨
- ADR-0017 (client-first runtime) / ADR-0018 (open content) / ADR-0019
  (plugin runtime) 在三 Spike (1/2/3) 全 PASS 后从 Proposed → drafting

## 参考

- Spec：`docs/superpowers/specs/2026-05-11-client-first-pivot-design.md`
- Plan：`docs/superpowers/plans/2026-05-12-spike-2-vault-fs.md`
- ADR-0001 §8.6（§5.A 反转的实证基础）
- ADR-0005 review log（PM JSON wire 兼容性）
