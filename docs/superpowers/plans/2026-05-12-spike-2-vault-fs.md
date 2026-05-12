# Spike-2: `packages/vault-fs/` markdown ↔ Y.Doc Reconcile PoC

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 6 W1-W2 Spike-2 — 验证 `packages/vault-fs/` 能在 `~/MyVault/*.md` 人可读 markdown + `.vault/yjs/*.bin` CRDT sidecar 之间双向 reconcile，5 fixture 全跑通；为 Phase 6 W3-W4 doc-store FileSystemBackend 落地铺路。**只验证 vault-fs library 层**，不实现 Tauri 集成（Spike-1）/ plugin sandbox（Spike-3）/ open content publish（Phase 6 W6+）。

**Architecture:** 纯 TypeScript library，无 Tauri 依赖。Public API：
- `emitMarkdown(yDoc: Y.Doc): string`（pure，Y.Doc → markdown）
- `parseMarkdown(markdown: string, baseDoc?: Y.Doc): Y.Doc`（reverse；baseDoc 用于增量 parse 保 CRDT 历史）
- `readSidecar(path: string): Promise<Uint8Array | null>` / `writeSidecar(path, bytes)`（atomic 写盘）
- `watchVault(path: string, handler: (event) => void): { close }`（基于 chokidar）
- `detectDrift({ yDoc, markdownFile }): { drifted: boolean, hash: string }`
- `threeWayMerge({ base: Y.Doc, local: Y.Doc, remote: markdown }): { merged: Y.Doc, conflicts: ConflictRegion[] }`

**Tech Stack:** TypeScript 5.7 / Y.Doc (`yjs` 13.x，复用项目既有) / `prosemirror-markdown` (markdown ↔ PM bridge) / `prosemirror-model` / `chokidar` 4.x / `node:test --import tsx` / `node:fs/promises`

---

## Prerequisites（执行前自检）

- [ ] Node 22+：`node --version`
- [ ] pnpm 10+：`pnpm --version`
- [ ] 当前在 `claude/spike-2-vault-fs` 分支（如无，先 `git checkout -b claude/spike-2-vault-fs`）
- [ ] Spike-1 已 PASS 或并行（不强制阻塞 —— vault-fs 不依赖 Tauri）
- [ ] 既有 `packages/editor-core/src/schema/paper-schema.ts` typecheck PASS（spike-2 复用 PM schema）

## Out of Scope（防止 scope creep）

- ❌ Tauri shell 集成（Spike-1）
- ❌ Plugin sandbox（Spike-3）
- ❌ ed25519 keypair / provenance 签名（`packages/identity/`，Phase 6 W1-W2 单独）
- ❌ Open content publish（`packages/open-content/`，Phase 6 W6-W7）
- ❌ Server `BodyBackend` 改造（`apps/sync-gateway/` 退到 pure relay，Phase 6 W3-W4）
- ❌ 一次性迁移工具（`infra/migrate-to-client-first/`，Phase 6 W5）
- ❌ doc-store `FileSystemBackend` 真接入（Phase 6 W3-W4 用 spike-2 artifacts）

---

## File Structure

新增 `packages/vault-fs/`：

```
packages/vault-fs/
├── package.json           # workspace pkg, deps: yjs / prosemirror-markdown / chokidar
├── tsconfig.json
├── src/
│   ├── index.ts           # public API re-exports
│   ├── _shared.ts         # types: VaultPath / SidecarBytes / DriftHash / ConflictRegion
│   ├── ydoc-to-markdown.ts  # emitMarkdown
│   ├── markdown-to-ydoc.ts  # parseMarkdown
│   ├── sidecar-io.ts        # readSidecar / writeSidecar (atomic via .tmp rename)
│   ├── file-watcher.ts      # watchVault chokidar wrapper
│   ├── drift-detector.ts    # detectDrift
│   ├── three-way-merge.ts   # threeWayMerge + conflict region detection
│   └── stress-harness.ts    # 5-client stress entry (used by tests, exported for spike report)
├── tests/
│   ├── ydoc-to-markdown.test.ts       # emit round-trip
│   ├── markdown-to-ydoc.test.ts       # parse round-trip
│   ├── sidecar-io.test.ts             # atomic write / read / 损坏检测
│   ├── file-watcher.test.ts           # chokidar mock + event emit
│   ├── drift-detector.test.ts         # equal hash / unequal hash
│   ├── three-way-merge.test.ts        # conflict region detection
│   ├── fixture-cold-start.test.ts     # 验收 1
│   ├── fixture-external-edit.test.ts  # 验收 2
│   ├── fixture-3way-merge.test.ts     # 验收 3
│   ├── fixture-sidecar-corrupt.test.ts # 验收 4
│   └── fixture-sync-interrupt.test.ts # 验收 5
└── README.md             # spike-2 目的 / 本地起步 / 已知局限
```

修改：

- `package.json`（root）— 加 `vault-fs:test` / `vault-fs:typecheck` scripts
- `pnpm-workspace.yaml`（无需改，`packages/*` glob 已 cover）
- `STATUS.md` — 顶 "最后更新" + §1 + §2
- `plan0/adr/0001-data-model-and-crdt-split.md` — review log §8.6 追加 Spike-2 entry（§5.A 反转的实证）
- `plan0/adr/0005-render-api-boundary.md` — review log 追加 markdown emit 与 PM JSON wire 兼容性测试结果

---

## Tasks

### Task 1: `packages/vault-fs/` workspace 注册 + 空 scaffold

**Files:**
- Create: `packages/vault-fs/package.json`
- Create: `packages/vault-fs/tsconfig.json`
- Create: `packages/vault-fs/src/index.ts`（空 export）
- Create: `packages/vault-fs/src/_shared.ts`
- Modify: `package.json`（root，scripts 段）

- [ ] **Step 1: 创建 `packages/vault-fs/package.json`**

```json
{
  "name": "@collaborationtool/vault-fs",
  "version": "0.0.0-spike",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "node --test --import tsx tests/*.test.ts"
  },
  "dependencies": {
    "@collaborationtool/editor-core": "workspace:*",
    "chokidar": "^4.0.1",
    "prosemirror-markdown": "^1.13.1",
    "prosemirror-model": "^1.24.1",
    "yjs": "^13.6.20",
    "y-prosemirror": "^1.2.13"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: 创建 `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: 创建 `src/_shared.ts`**

```ts
// Shared types for the vault-fs spike.
// All public types live here so consumers import a single shape source.

export type VaultPath = string; // absolute fs path to vault root (e.g. /Users/x/MyVault)
export type DocumentRelativePath = string; // path inside vault, e.g. "paper-1.md"
export type SidecarBytes = Uint8Array;
export type ContentHash = string; // sha-256 hex

export interface DriftReport {
  drifted: boolean;
  markdownHash: ContentHash;
  emittedHash: ContentHash;
}

export interface ConflictRegion {
  startLineNumber: number;
  endLineNumber: number;
  baseContent: string;
  localContent: string;
  remoteContent: string;
}

export interface ThreeWayMergeResult {
  // The merged Y.Doc encoded as an update binary (callers apply onto fresh
  // Y.Doc to materialise).
  mergedUpdate: Uint8Array;
  conflicts: readonly ConflictRegion[];
}
```

- [ ] **Step 4: 创建 `src/index.ts`（空 re-export 框架）**

```ts
// @collaborationtool/vault-fs — Phase 6 Spike-2 PoC.
// markdown ↔ Y.Doc reconcile + sidecar IO + file watch + 3-way merge.
// See docs/superpowers/specs/2026-05-11-client-first-pivot-design.md §4
// (vault-fs component) for the design.

export * from './_shared';
// Tasks 2-7 fill these:
// export * from './ydoc-to-markdown';
// export * from './markdown-to-ydoc';
// export * from './sidecar-io';
// export * from './file-watcher';
// export * from './drift-detector';
// export * from './three-way-merge';
```

- [ ] **Step 5: 加 root scripts**

修改 `package.json`（root），在 `discovery-graph:typecheck` / `bridge-layer:typecheck` 之后追加：

```json
"vault-fs:test": "pnpm --filter @collaborationtool/vault-fs test",
"vault-fs:typecheck": "pnpm --filter @collaborationtool/vault-fs typecheck",
```

- [ ] **Step 6: `pnpm install` 注册 workspace**

Run: `pnpm install`
Expected: `Done in <X>s`，无报错；`pnpm-lock.yaml` 更新

- [ ] **Step 7: typecheck 验证空 scaffold**

Run: `pnpm vault-fs:typecheck`
Expected: PASS（空文件无错）

- [ ] **Step 8: Commit**

```bash
git add packages/vault-fs/ package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
P6(spike-2 task 1): packages/vault-fs/ workspace 注册 + 空 scaffold

apps + tests 空骨架；deps: yjs / y-prosemirror / prosemirror-{markdown,model} /
chokidar 4 / @collaborationtool/editor-core；root scripts vault-fs:test /
:typecheck；typecheck PASS。
EOF
)"
```

---

### Task 2: `ydoc-to-markdown.ts` — Y.Doc → markdown emit

**Files:**
- Create: `packages/vault-fs/src/ydoc-to-markdown.ts`
- Create: `packages/vault-fs/tests/ydoc-to-markdown.test.ts`
- Modify: `packages/vault-fs/src/index.ts`（re-export）

- [ ] **Step 1: 写测试先（TDD）**

`packages/vault-fs/tests/ydoc-to-markdown.test.ts`:

```ts
// Spike-2 Task 2 — emit Y.Doc → markdown.
// Pin shape contract: 同一 Y.Doc 多次 emit 结果稳定；空 Y.Doc 返回 ''；
// 单段落 / 多段落 / heading / 列表 4 类节点 round-trip 可读。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Y from 'yjs';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';

import { paperSchema } from '@collaborationtool/editor-core';
import { emitMarkdown } from '../src/ydoc-to-markdown';

function makeYDoc(pmJson: Record<string, unknown>): Y.Doc {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment('prosemirror');
  // y-prosemirror helper: PM JSON → Y.Doc XmlFragment
  prosemirrorJSONToYDoc(paperSchema, pmJson, fragment);
  return doc;
}

describe('emitMarkdown (Spike-2 Task 2)', () => {
  it('empty Y.Doc emits empty string', () => {
    const doc = new Y.Doc();
    assert.equal(emitMarkdown(doc), '');
  });

  it('single paragraph round-trips', () => {
    const doc = makeYDoc({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'hello world' }],
      }],
    });
    assert.equal(emitMarkdown(doc).trim(), 'hello world');
  });

  it('heading + paragraph emits 标 + 文', () => {
    const doc = makeYDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Intro' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
      ],
    });
    const md = emitMarkdown(doc);
    assert.match(md, /^# Intro/m);
    assert.match(md, /^body$/m);
  });

  it('idempotent: emit(emit(doc)) === emit(doc)', () => {
    const doc = makeYDoc({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    const m1 = emitMarkdown(doc);
    const m2 = emitMarkdown(doc);
    assert.equal(m1, m2);
  });
});
```

- [ ] **Step 2: 实现 `src/ydoc-to-markdown.ts`**

```ts
// Y.Doc → markdown emit.
// Strategy: Y.Doc XmlFragment → PM tree (via yXmlFragmentToProsemirrorJSON) →
// markdown via prosemirror-markdown's defaultMarkdownSerializer extended
// for paper-schema custom nodes (claim / evidence / claim-review-anchor /
// figure / dataset).
//
// For Spike-2 only base nodes (doc / heading / paragraph / bullet_list /
// ordered_list / list_item / blockquote / code_block / text / em / strong /
// link / image) are wired. Custom paper-schema nodes (claim / evidence /
// figure / dataset / annotation-anchor / claim-review-anchor) emit as
// markdown comments `<!-- claim id="..." text="..." -->` for round-trip
// preservation — Phase 6 W3-W4 will replace with proper markdown directive
// syntax (`::claim{...}` per MyST).

import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
} from 'prosemirror-markdown';
import { Schema } from 'prosemirror-model';

import { paperSchema } from '@collaborationtool/editor-core';

// Build a Serializer that knows about paper-schema custom nodes/marks.
// Custom nodes fall back to HTML-comment preservation; see file header.
const paperSerializer = buildPaperSerializer(paperSchema);

function buildPaperSerializer(schema: Schema): MarkdownSerializer {
  const nodes = { ...defaultMarkdownSerializer.nodes };
  const marks = { ...defaultMarkdownSerializer.marks };

  // Spike-2 stub: custom nodes preserved as comments.
  const customNodeNames = [
    'claim',
    'evidence',
    'figure',
    'dataset',
    'annotationAnchor',
    'claimReviewAnchor',
  ];
  for (const name of customNodeNames) {
    if (!schema.nodes[name]) continue;
    nodes[name] = (state, node) => {
      const attrs = JSON.stringify(node.attrs);
      state.write(`<!-- ${name} ${attrs} -->`);
      state.closeBlock(node);
    };
  }
  return new MarkdownSerializer(nodes, marks);
}

export function emitMarkdown(yDoc: Y.Doc): string {
  const fragment = yDoc.getXmlFragment('prosemirror');
  if (fragment.length === 0) return '';
  const pmJson = yXmlFragmentToProsemirrorJSON(yDoc, 'prosemirror');
  const node = paperSchema.nodeFromJSON(pmJson);
  return paperSerializer.serialize(node);
}
```

- [ ] **Step 3: 更新 `src/index.ts` re-export**

```ts
export * from './_shared';
export * from './ydoc-to-markdown';
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vault-fs:test`
Expected: 4 测全 PASS

- [ ] **Step 5: typecheck**

Run: `pnpm vault-fs:typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/vault-fs/src/ydoc-to-markdown.ts \
        packages/vault-fs/tests/ydoc-to-markdown.test.ts \
        packages/vault-fs/src/index.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 2): emitMarkdown — Y.Doc → markdown serializer

prosemirror-markdown defaultSerializer + paper-schema custom nodes 兜底
（claim/evidence/figure/dataset/annotation-anchor/claim-review-anchor
emit 为 HTML 注释，round-trip 保形）。4 测全 PASS。
EOF
)"
```

---

### Task 3: `markdown-to-ydoc.ts` — markdown → Y.Doc parse

**Files:**
- Create: `packages/vault-fs/src/markdown-to-ydoc.ts`
- Create: `packages/vault-fs/tests/markdown-to-ydoc.test.ts`
- Modify: `packages/vault-fs/src/index.ts`

- [ ] **Step 1: 写测试**

`tests/markdown-to-ydoc.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMarkdown } from '../src/markdown-to-ydoc';
import { emitMarkdown } from '../src/ydoc-to-markdown';

describe('parseMarkdown (Spike-2 Task 3)', () => {
  it('empty string → empty Y.Doc', () => {
    const doc = parseMarkdown('');
    assert.equal(emitMarkdown(doc), '');
  });

  it('single paragraph round-trips through Y.Doc', () => {
    const md = 'hello world\n';
    const doc = parseMarkdown(md);
    assert.equal(emitMarkdown(doc).trim(), 'hello world');
  });

  it('heading + paragraph round-trips', () => {
    const md = '# Intro\n\nbody\n';
    const doc = parseMarkdown(md);
    const emitted = emitMarkdown(doc);
    assert.match(emitted, /^# Intro/m);
    assert.match(emitted, /^body$/m);
  });

  it('emit(parse(emit(parse(md)))) === emit(parse(md)) — stable under double round-trip', () => {
    const md = '# Title\n\npara 1\n\npara 2\n';
    const a = emitMarkdown(parseMarkdown(md));
    const b = emitMarkdown(parseMarkdown(a));
    assert.equal(a, b);
  });

  it('preserves custom-node HTML comments (claim placeholder)', () => {
    const md = 'before\n\n<!-- claim {"id":"c1","text":"x"} -->\n\nafter\n';
    const doc = parseMarkdown(md);
    // Spike-2: custom nodes go through as raw HTML in parse path;
    // emitMarkdown will preserve them verbatim. Phase 6 W3-W4 swap to
    // markdown directive parsing.
    const emitted = emitMarkdown(doc);
    assert.match(emitted, /<!-- claim/);
  });
});
```

- [ ] **Step 2: 实现 `src/markdown-to-ydoc.ts`**

```ts
// markdown → Y.Doc parse.
// Strategy: markdown → PM JSON via prosemirror-markdown defaultMarkdownParser
// → Y.Doc XmlFragment via prosemirrorJSONToYDoc.
//
// Caveat: defaultMarkdownParser does NOT understand paper-schema custom
// nodes — they round-trip as raw HTML blocks (preserved verbatim).
// Phase 6 W3-W4 will swap to a custom Parser extending markdown-it with
// directive plugin (`:::claim{...}`) for proper paper-schema parse.

import * as Y from 'yjs';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';
import { defaultMarkdownParser } from 'prosemirror-markdown';

import { paperSchema } from '@collaborationtool/editor-core';

export interface ParseMarkdownOptions {
  /** Pre-existing Y.Doc to merge into. If omitted, a fresh Y.Doc is created. */
  baseDoc?: Y.Doc;
}

export function parseMarkdown(
  markdown: string,
  options: ParseMarkdownOptions = {},
): Y.Doc {
  const doc = options.baseDoc ?? new Y.Doc();
  if (markdown.length === 0) return doc;

  const pmNode = defaultMarkdownParser.parse(markdown);
  if (!pmNode) {
    throw new Error('vault-fs: markdown parse returned null');
  }
  const pmJson = pmNode.toJSON() as Record<string, unknown>;
  const fragment = doc.getXmlFragment('prosemirror');
  // Clear existing content if no baseDoc supplied (fresh parse).
  if (!options.baseDoc && fragment.length > 0) {
    fragment.delete(0, fragment.length);
  }
  prosemirrorJSONToYDoc(paperSchema, pmJson, fragment);
  return doc;
}
```

- [ ] **Step 3: 更新 `src/index.ts`**

```ts
export * from './_shared';
export * from './ydoc-to-markdown';
export * from './markdown-to-ydoc';
```

- [ ] **Step 4: 跑测试 + typecheck**

Run: `pnpm vault-fs:test && pnpm vault-fs:typecheck`
Expected: 9 测全 PASS (4 prior + 5 new)

- [ ] **Step 5: Commit**

```bash
git add packages/vault-fs/src/markdown-to-ydoc.ts \
        packages/vault-fs/tests/markdown-to-ydoc.test.ts \
        packages/vault-fs/src/index.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 3): parseMarkdown — markdown → Y.Doc parser

defaultMarkdownParser → PM JSON → prosemirrorJSONToYDoc。custom nodes
（claim 等）作 HTML block 透传；Phase 6 W3-W4 swap markdown-it directive
plugin。5 测全 PASS（含 double round-trip 稳定性）。
EOF
)"
```

---

### Task 4: `sidecar-io.ts` — atomic sidecar read / write

**Files:**
- Create: `packages/vault-fs/src/sidecar-io.ts`
- Create: `packages/vault-fs/tests/sidecar-io.test.ts`
- Modify: `packages/vault-fs/src/index.ts`

- [ ] **Step 1: 写测试**

```ts
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readSidecar, writeSidecar, SidecarCorruptError } from '../src/sidecar-io';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vault-fs-spike-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('sidecar-io (Spike-2 Task 4)', () => {
  it('writeSidecar creates file with bytes', async () => {
    const target = join(dir, 'paper-1.bin');
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await writeSidecar(target, bytes);
    const onDisk = await readFile(target);
    assert.deepEqual(new Uint8Array(onDisk), bytes);
  });

  it('writeSidecar is atomic (no .tmp leftover on success)', async () => {
    const target = join(dir, 'paper-2.bin');
    await writeSidecar(target, new Uint8Array([1]));
    await assert.rejects(stat(`${target}.tmp`));
  });

  it('readSidecar returns null when file missing', async () => {
    assert.equal(await readSidecar(join(dir, 'missing.bin')), null);
  });

  it('readSidecar returns bytes for existing file', async () => {
    const target = join(dir, 'paper-3.bin');
    const bytes = new Uint8Array([9, 8, 7]);
    await writeFile(target, bytes);
    const read = await readSidecar(target);
    assert.ok(read);
    assert.deepEqual(read, bytes);
  });

  it('readSidecar throws SidecarCorruptError when header marker bad', async () => {
    // We will add a 4-byte magic header in Task 4; corrupt = wrong magic
    const target = join(dir, 'corrupt.bin');
    await writeFile(target, new Uint8Array([0, 0, 0, 0, 1, 2, 3])); // bad magic
    await assert.rejects(readSidecar(target), (err) => err instanceof SidecarCorruptError);
  });
});
```

- [ ] **Step 2: 实现 `src/sidecar-io.ts`**

```ts
// Sidecar IO for .vault/yjs/*.bin files.
// On-disk format (Spike-2):
//   [4 bytes magic: 'VFSB']  ascii 0x56 0x46 0x53 0x42
//   [4 bytes version: 0x00000001 LE]
//   [N bytes: Y.encodeStateAsUpdate output]
//
// Atomic write strategy: write to <path>.tmp, then rename.
// Phase 6 W3-W4 may add CRC32 trailer + per-doc snapshot generation.

import { readFile, rename, writeFile, unlink } from 'node:fs/promises';

const MAGIC = new Uint8Array([0x56, 0x46, 0x53, 0x42]); // 'VFSB'
const VERSION = 1;
const HEADER_LEN = 8;

export class SidecarCorruptError extends Error {
  constructor(public readonly path: string, public readonly reason: string) {
    super(`sidecar corrupt at ${path}: ${reason}`);
    this.name = 'SidecarCorruptError';
  }
}

function encodeHeader(): Uint8Array {
  const buf = new Uint8Array(HEADER_LEN);
  buf.set(MAGIC, 0);
  // version LE
  buf[4] = VERSION & 0xff;
  buf[5] = (VERSION >> 8) & 0xff;
  buf[6] = (VERSION >> 16) & 0xff;
  buf[7] = (VERSION >> 24) & 0xff;
  return buf;
}

function checkHeader(buf: Uint8Array, path: string): void {
  if (buf.length < HEADER_LEN) {
    throw new SidecarCorruptError(path, 'truncated header');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (buf[i] !== MAGIC[i]) {
      throw new SidecarCorruptError(path, 'bad magic');
    }
  }
}

export async function readSidecar(path: string): Promise<Uint8Array | null> {
  let buf: Buffer;
  try {
    buf = await readFile(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const view = new Uint8Array(buf);
  checkHeader(view, path);
  return view.slice(HEADER_LEN);
}

export async function writeSidecar(path: string, bytes: Uint8Array): Promise<void> {
  const header = encodeHeader();
  const out = new Uint8Array(header.length + bytes.length);
  out.set(header, 0);
  out.set(bytes, header.length);
  const tmp = `${path}.tmp`;
  try {
    await writeFile(tmp, out);
    await rename(tmp, path);
  } catch (err) {
    // best-effort cleanup; ignore if .tmp doesn't exist
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
```

- [ ] **Step 3: 跑测试**

Run: `pnpm vault-fs:test`
Expected: 5 sidecar 测全 PASS（14 total）

- [ ] **Step 4: Commit**

```bash
git add packages/vault-fs/src/sidecar-io.ts \
        packages/vault-fs/tests/sidecar-io.test.ts \
        packages/vault-fs/src/index.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 4): sidecar-io — atomic read/write + magic header 损坏检测

VFSB 4-byte magic + version LE + atomic rename pattern；
SidecarCorruptError 暴露 path + reason。5 测全 PASS。
EOF
)"
```

---

### Task 5: `file-watcher.ts` — chokidar wrap for vault watch

**Files:**
- Create: `packages/vault-fs/src/file-watcher.ts`
- Create: `packages/vault-fs/tests/file-watcher.test.ts`

- [ ] **Step 1: 写测试**

```ts
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { watchVault, type VaultEvent } from '../src/file-watcher';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vault-watch-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('watchVault (Spike-2 Task 5)', () => {
  it('emits "add" when new markdown file appears', async () => {
    const events: VaultEvent[] = [];
    const handle = await watchVault(dir, (e) => events.push(e));
    // give chokidar time to start
    await new Promise((r) => setTimeout(r, 200));
    await writeFile(join(dir, 'new.md'), '# hi\n');
    await new Promise((r) => setTimeout(r, 400));
    await handle.close();
    assert.ok(events.some((e) => e.kind === 'add' && e.path.endsWith('new.md')));
  });

  it('emits "change" when existing file is modified externally', async () => {
    await writeFile(join(dir, 'existing.md'), 'a\n');
    const events: VaultEvent[] = [];
    const handle = await watchVault(dir, (e) => events.push(e));
    await new Promise((r) => setTimeout(r, 300));
    await writeFile(join(dir, 'existing.md'), 'b\n');
    await new Promise((r) => setTimeout(r, 400));
    await handle.close();
    assert.ok(events.some((e) => e.kind === 'change' && e.path.endsWith('existing.md')));
  });

  it('ignores .vault/ subtree (sidecar churn must not surface)', async () => {
    const events: VaultEvent[] = [];
    const handle = await watchVault(dir, (e) => events.push(e));
    await new Promise((r) => setTimeout(r, 200));
    await writeFile(join(dir, '.vault', 'yjs', 'p1.bin'), new Uint8Array([1, 2])).catch(async () => {
      // may need to mkdir first; test failure if path setup fails
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(dir, '.vault', 'yjs'), { recursive: true });
      await writeFile(join(dir, '.vault', 'yjs', 'p1.bin'), new Uint8Array([1, 2]));
    });
    await new Promise((r) => setTimeout(r, 400));
    await handle.close();
    assert.equal(
      events.filter((e) => e.path.includes('.vault')).length,
      0,
      '.vault/ events leaked through',
    );
  });
});
```

- [ ] **Step 2: 实现 `src/file-watcher.ts`**

```ts
// Vault file watcher — wraps chokidar with vault-aware path filtering.
// `.vault/` subtree is excluded (sidecar / index / provenance churn must
// NOT surface as user-visible drift).

import chokidar, { type FSWatcher } from 'chokidar';
import { resolve } from 'node:path';

export type VaultEventKind = 'add' | 'change' | 'unlink';

export interface VaultEvent {
  kind: VaultEventKind;
  /** Absolute path. */
  path: string;
}

export interface VaultWatchHandle {
  close(): Promise<void>;
}

export async function watchVault(
  vaultRoot: string,
  handler: (event: VaultEvent) => void,
): Promise<VaultWatchHandle> {
  const root = resolve(vaultRoot);
  const watcher: FSWatcher = chokidar.watch(root, {
    ignored: (p: string) => p.includes(`${root}/.vault`) || p.endsWith('.tmp'),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });
  watcher.on('add', (p) => handler({ kind: 'add', path: p }));
  watcher.on('change', (p) => handler({ kind: 'change', path: p }));
  watcher.on('unlink', (p) => handler({ kind: 'unlink', path: p }));
  // chokidar 4: wait for initial scan
  await new Promise<void>((res) => watcher.once('ready', () => res()));
  return {
    close: async () => {
      await watcher.close();
    },
  };
}
```

- [ ] **Step 3: 跑测试**

Run: `pnpm vault-fs:test --test-name-pattern watchVault`
Expected: 3 测 PASS（chokidar IO 测试可能 flaky；如失败重跑一次确认是否 timing）

- [ ] **Step 4: Commit**

```bash
git add packages/vault-fs/src/file-watcher.ts \
        packages/vault-fs/tests/file-watcher.test.ts \
        packages/vault-fs/src/index.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 5): file-watcher — chokidar wrap，.vault/ 排除

VaultEvent { kind: add|change|unlink, path }；awaitWriteFinish 100ms 防
flush 抖动；.vault/ 子树 + .tmp 显式 ignore。3 测全 PASS。
EOF
)"
```

---

### Task 6: `drift-detector.ts` — markdown file vs Y.Doc emit drift

**Files:**
- Create: `packages/vault-fs/src/drift-detector.ts`
- Create: `packages/vault-fs/tests/drift-detector.test.ts`

- [ ] **Step 1: 写测试**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMarkdown } from '../src/markdown-to-ydoc';
import { detectDrift } from '../src/drift-detector';

describe('detectDrift (Spike-2 Task 6)', () => {
  it('no drift when markdown matches emit', () => {
    const md = '# Hello\n\nbody\n';
    const doc = parseMarkdown(md);
    // Round trip through emit so hashing compares apples to apples.
    const r = detectDrift({ yDoc: doc, markdownFileContent: md });
    // The first parse→emit may normalize whitespace; second round trip is canonical.
    // Use canonical form for both sides.
    assert.equal(r.markdownHash, r.emittedHash);
    assert.equal(r.drifted, false);
  });

  it('drift when external edit changes markdown', () => {
    const md = '# Hello\n\nbody\n';
    const doc = parseMarkdown(md);
    const changed = '# Hello\n\nNEW body\n';
    const r = detectDrift({ yDoc: doc, markdownFileContent: changed });
    assert.notEqual(r.markdownHash, r.emittedHash);
    assert.equal(r.drifted, true);
  });

  it('canonicalises emit before comparing (trailing whitespace etc)', () => {
    const doc = parseMarkdown('# Hello\n');
    const fileWithTrailing = '# Hello\n\n\n'; // extra blank lines
    const r = detectDrift({ yDoc: doc, markdownFileContent: fileWithTrailing });
    // Drift expected here in Spike-2 — Phase 6 will add canonical normalizer
    // that trims trailing blanks. Test pins current behavior so future work
    // (canonicalizer) flips the assertion intentionally.
    assert.equal(r.drifted, true, 'Spike-2: pre-canonicaliser baseline');
  });
});
```

- [ ] **Step 2: 实现 `src/drift-detector.ts`**

```ts
import { createHash } from 'node:crypto';
import * as Y from 'yjs';

import { emitMarkdown } from './ydoc-to-markdown';
import type { DriftReport } from './_shared';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface DetectDriftInput {
  yDoc: Y.Doc;
  markdownFileContent: string;
}

export function detectDrift(input: DetectDriftInput): DriftReport {
  const emitted = emitMarkdown(input.yDoc);
  const markdownHash = sha256Hex(input.markdownFileContent);
  const emittedHash = sha256Hex(emitted);
  return {
    markdownHash,
    emittedHash,
    drifted: markdownHash !== emittedHash,
  };
}
```

- [ ] **Step 3: 跑测试 + Commit**

Run: `pnpm vault-fs:test --test-name-pattern detectDrift`
Expected: 3 测 PASS

```bash
git add packages/vault-fs/src/drift-detector.ts \
        packages/vault-fs/tests/drift-detector.test.ts \
        packages/vault-fs/src/index.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 6): drift-detector — sha256 hash 比较

emitMarkdown(yDoc) vs markdownFileContent，sha256 hex 比较。
Spike-2 baseline 不 canonicalise（trailing blanks 算 drift），Phase 6
W3-W4 加 canonical normalizer。3 测 PASS。
EOF
)"
```

---

### Task 7: `three-way-merge.ts` — Y.Doc + sidecar + filesystem 3-way merge

**Files:**
- Create: `packages/vault-fs/src/three-way-merge.ts`
- Create: `packages/vault-fs/tests/three-way-merge.test.ts`

- [ ] **Step 1: 写测试**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Y from 'yjs';

import { parseMarkdown } from '../src/markdown-to-ydoc';
import { emitMarkdown } from '../src/ydoc-to-markdown';
import { threeWayMerge } from '../src/three-way-merge';

describe('threeWayMerge (Spike-2 Task 7)', () => {
  it('no conflict: identical base / local / remote → 0 conflicts', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nb\n');
    const remoteMd = '# A\n\nb\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 0);
  });

  it('local-only change: local diverges, remote === base → local wins, no conflict', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nlocal-changed\n');
    const remoteMd = '# A\n\nb\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 0);
    // Materialise merged update to check content.
    const merged = new Y.Doc();
    Y.applyUpdate(merged, r.mergedUpdate);
    assert.match(emitMarkdown(merged), /local-changed/);
  });

  it('remote-only change: remote diverges, local === base → remote wins, no conflict', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nb\n');
    const remoteMd = '# A\n\nremote-changed\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 0);
    const merged = new Y.Doc();
    Y.applyUpdate(merged, r.mergedUpdate);
    assert.match(emitMarkdown(merged), /remote-changed/);
  });

  it('conflict: local and remote both diverge in same paragraph → 1 conflict region', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nLOCAL\n');
    const remoteMd = '# A\n\nREMOTE\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 1);
    const c = r.conflicts[0]!;
    assert.match(c.localContent, /LOCAL/);
    assert.match(c.remoteContent, /REMOTE/);
    assert.match(c.baseContent, /b/);
  });
});
```

- [ ] **Step 2: 实现 `src/three-way-merge.ts`**

Spike-2 简化策略：用 line-based diff3 算法（不利用 Yjs operational merge，
那是 Phase 6 W3-W4 的目标）。Spike-2 仅证明能 surface conflicts；merge
output 的 Y.Doc 是 base + 自动 apply 的 non-conflict hunks，conflict 区
留给 UI 处理。

```ts
import * as Y from 'yjs';

import { emitMarkdown } from './ydoc-to-markdown';
import { parseMarkdown } from './markdown-to-ydoc';
import type { ConflictRegion, ThreeWayMergeResult } from './_shared';

export interface ThreeWayMergeInput {
  /** Common ancestor (typically the last-synced sidecar's Y.Doc). */
  base: Y.Doc;
  /** Current in-memory Y.Doc (user's local edits since base). */
  local: Y.Doc;
  /** Remote / external markdown (VS Code edit, git pull, etc). */
  remoteMarkdown: string;
}

interface DiffHunk {
  baseStart: number;
  baseEnd: number;
  baseLines: readonly string[];
  newLines: readonly string[];
}

function splitLines(s: string): string[] {
  if (s.length === 0) return [];
  return s.split('\n');
}

// Naive diff: produce line-by-line equality bitmap + hunks where it
// differs. Spike-2 PoC quality; Phase 6 W3-W4 swaps to Myers diff.
function naiveDiff(base: readonly string[], next: readonly string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const maxLen = Math.max(base.length, next.length);
  let i = 0;
  while (i < maxLen) {
    if (base[i] === next[i]) {
      i++;
      continue;
    }
    // collect divergent block
    let start = i;
    while (i < maxLen && base[i] !== next[i]) i++;
    hunks.push({
      baseStart: start,
      baseEnd: i,
      baseLines: base.slice(start, i),
      newLines: next.slice(start, i),
    });
  }
  return hunks;
}

export function threeWayMerge(input: ThreeWayMergeInput): ThreeWayMergeResult {
  const baseLines = splitLines(emitMarkdown(input.base));
  const localLines = splitLines(emitMarkdown(input.local));
  const remoteLines = splitLines(input.remoteMarkdown);

  const localDiff = naiveDiff(baseLines, localLines);
  const remoteDiff = naiveDiff(baseLines, remoteLines);

  const conflicts: ConflictRegion[] = [];
  for (const lh of localDiff) {
    for (const rh of remoteDiff) {
      // Overlapping divergent ranges = conflict.
      if (!(lh.baseEnd <= rh.baseStart || rh.baseEnd <= lh.baseStart)) {
        conflicts.push({
          startLineNumber: Math.min(lh.baseStart, rh.baseStart) + 1,
          endLineNumber: Math.max(lh.baseEnd, rh.baseEnd),
          baseContent: baseLines.slice(lh.baseStart, lh.baseEnd).join('\n'),
          localContent: lh.newLines.join('\n'),
          remoteContent: rh.newLines.join('\n'),
        });
      }
    }
  }

  // Merge strategy (Spike-2): start from base, apply non-conflicting hunks
  // from both sides. Where both sides diverge in the same range, prefer
  // local (Spike-2 simplification — Phase 6 W3-W4 UI lets user pick).
  const merged = new Y.Doc();
  const conflictBaseStarts = new Set(conflicts.map((c) => c.startLineNumber - 1));

  const out: string[] = [];
  let cursor = 0;
  const allHunks = [...localDiff, ...remoteDiff].sort((a, b) => a.baseStart - b.baseStart);
  for (const h of allHunks) {
    while (cursor < h.baseStart) {
      out.push(baseLines[cursor]!);
      cursor++;
    }
    if (conflictBaseStarts.has(h.baseStart)) {
      // conflict — Spike-2 picks local; UI overrides in Phase 6
      const localHunk = localDiff.find((l) => l.baseStart === h.baseStart);
      if (localHunk) {
        out.push(...localHunk.newLines);
      } else {
        out.push(...h.newLines);
      }
    } else {
      out.push(...h.newLines);
    }
    cursor = h.baseEnd;
  }
  while (cursor < baseLines.length) {
    out.push(baseLines[cursor]!);
    cursor++;
  }

  const mergedMd = out.join('\n');
  const tmp = parseMarkdown(mergedMd, { baseDoc: merged });
  return {
    mergedUpdate: Y.encodeStateAsUpdate(tmp),
    conflicts,
  };
}
```

- [ ] **Step 3: 跑测试 + Commit**

Run: `pnpm vault-fs:test --test-name-pattern threeWayMerge`
Expected: 4 测 PASS（Spike-2 strategy "local wins on conflict"，Phase 6 W3-W4 UI overrides）

```bash
git add packages/vault-fs/src/three-way-merge.ts \
        packages/vault-fs/tests/three-way-merge.test.ts \
        packages/vault-fs/src/index.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 7): three-way-merge — diff3 surface conflicts

naive line-based diff（Spike-2 PoC；Phase 6 W3-W4 Myers diff swap）。
Overlapping divergent hunks → ConflictRegion[]；non-overlap auto-apply。
Spike-2 strategy "local wins on conflict"，UI 决策推 Phase 6。4 测 PASS。
EOF
)"
```

---

### Task 8: 5 验收 fixture tests

**Files:**
- Create: `packages/vault-fs/tests/fixture-cold-start.test.ts`
- Create: `packages/vault-fs/tests/fixture-external-edit.test.ts`
- Create: `packages/vault-fs/tests/fixture-3way-merge.test.ts`
- Create: `packages/vault-fs/tests/fixture-sidecar-corrupt.test.ts`
- Create: `packages/vault-fs/tests/fixture-sync-interrupt.test.ts`

每个 fixture 对应 spec §8 Spike-2 验收 5 项之一。Skeleton pattern：

```ts
// fixture-cold-start.test.ts — 验收 1：sidecar 缺失，从 markdown 冷启动
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Y from 'yjs';
import { parseMarkdown, emitMarkdown, readSidecar, writeSidecar } from '../src/index';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'fixture-cs-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('Fixture 1: cold-start (sidecar missing)', () => {
  it('Y.Doc 从 markdown 重建 + 第一次 flush 后 sidecar 存在', async () => {
    const md = '# Cold start\n\nfresh body\n';
    const mdPath = join(dir, 'paper.md');
    const sidecarPath = join(dir, '.vault', 'yjs', 'paper.bin');
    await writeFile(mdPath, md);
    // sidecar 不存在
    assert.equal(await readSidecar(sidecarPath), null);
    // 冷启动 parse
    const doc = parseMarkdown(md);
    // emit 验证 round-trip 不丢内容
    const emitted = emitMarkdown(doc);
    assert.match(emitted, /Cold start/);
    assert.match(emitted, /fresh body/);
    // flush sidecar
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(dir, '.vault', 'yjs'), { recursive: true });
    await writeSidecar(sidecarPath, Y.encodeStateAsUpdate(doc));
    // sidecar 现在存在 + 可读
    const read = await readSidecar(sidecarPath);
    assert.ok(read);
  });
});
```

剩 4 fixture 类似 skeleton（具体内容见 spec §8 验收 + 各 task 已实现的 API 组合），不再展开 plan 行内。

- [ ] **Step 1**: 实现 5 fixture（每个 1-3 assertions，~30 行）
- [ ] **Step 2**: 跑测试 — 5 fixture 全 PASS（accept flaky retry for file-watcher-based ones）
- [ ] **Step 3**: Commit

```bash
git add packages/vault-fs/tests/fixture-*.test.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 8): 5 验收 fixture tests（spec §8）

cold-start / external-edit / 3-way merge / sidecar 损坏 / sync 中断
各 1 fixture。覆盖 spec §8 Spike-2 验收 5 项。
EOF
)"
```

---

### Task 9: Stress harness — 5 client × 1000 ops + offline/online switch

**Files:**
- Create: `packages/vault-fs/src/stress-harness.ts`
- Create: `packages/vault-fs/tests/stress.test.ts`

Spike-2 stress 目标：5 个独立 Y.Doc 各跑 1000 op（insertText / delete / format），periodic merge via `Y.applyUpdate`；中途 simulate offline（停 merge）然后 online（恢复 merge）；最终所有 5 doc emit markdown 一致。

- [ ] **Step 1: 实现 stress harness**

```ts
// packages/vault-fs/src/stress-harness.ts
import * as Y from 'yjs';

export interface StressOpts {
  clientCount: number;
  opsPerClient: number;
  offlineRound?: { startOp: number; endOp: number };
}

export function runStress(opts: StressOpts): { converged: boolean; finalText: string } {
  const docs = Array.from({ length: opts.clientCount }, () => new Y.Doc());
  // ... (PoC implementation; 详细见 task step 2)
  return { converged: true, finalText: '' };
}
```

- [ ] **Step 2: 真实现 + 测试** — Y.XmlText / Y.applyUpdate / encodeStateAsUpdate fan-out 实现 + 1 测试 assert 收敛

- [ ] **Step 3: Commit**

```bash
git add packages/vault-fs/src/stress-harness.ts packages/vault-fs/tests/stress.test.ts
git commit -m "$(cat <<'EOF'
P6(spike-2 task 9): stress harness — 5 client × 1000 ops + offline/online

PoC harness。Y.applyUpdate fan-out + offline 窗口 simulate；assertion =
最终 5 doc emit markdown 严格相等（CRDT 最终一致 + markdown 单一）。
EOF
)"
```

---

### Task 10: Design.md reject grep on emitted markdown

**Files:**
- Modify: `packages/vault-fs/tests/ydoc-to-markdown.test.ts`（加 1 测）

- [ ] **Step 1: 加 reject grep 测试**

```ts
it('emitMarkdown output passes Design.md §11 reject criteria', () => {
  const doc = parseMarkdown('# H\n\nbody **bold** and *italic* and [link](https://x)\n');
  const md = emitMarkdown(doc);
  // markdown 是 plaintext output，但 spike-2 verify 不出现 hex / Tailwind palette
  // 防止 future regression：若有人 hack-in CSS-styled markdown
  assert.doesNotMatch(md, /bg-blue-[567]00/);
  assert.doesNotMatch(md, /rounded-(lg|xl|2xl|full)/);
  assert.doesNotMatch(md, /bg-zinc-[12]00/);
  assert.doesNotMatch(md, /#[0-9A-Fa-f]{6}/, '非语义 hex 颜色禁止入 markdown');
});
```

- [ ] **Step 2: 跑测试 + Commit**

```bash
git commit -am "P6(spike-2 task 10): Design.md reject grep on markdown emit — 1 测"
```

---

### Task 11: ADR-0001 review log + ADR-0005 review log + docs + STATUS

**Files:**
- Modify: `plan0/adr/0001-data-model-and-crdt-split.md`
- Modify: `plan0/adr/0005-render-api-boundary.md`
- Create: `packages/vault-fs/README.md`
- Modify: `STATUS.md`

- [ ] **Step 1: ADR-0001 §8.6 追加 Spike-2 entry**

ADR-0001 §5.A "PG 是 truth" 在 client-first pivot 中**反转**。Spike-2 落地的 `emitMarkdown`/`parseMarkdown`/sidecar IO + 3-way merge 是 §5.A 反转的实证基础。

- [ ] **Step 2: ADR-0005 review log 追加 markdown emit 与 PM JSON wire 兼容性**

- [ ] **Step 3: `packages/vault-fs/README.md`** — 同 spike-1 README 风格：目的 / 本地起步 / 已知局限 / Phase 6 W3-W4 后续

- [ ] **Step 4: STATUS 更新** — 顶 "最后更新" + §2 ADR-0001 row 加 Spike-2 caveat

- [ ] **Step 5: Commit**

```bash
git commit -am "P6(spike-2 task 11): docs + ADR review log + STATUS"
```

---

### Task 12: Spike-2 验收 + 决断报告

**Files:**
- Create: `docs/superpowers/reports/2026-05-12-spike-2-report.md`

```markdown
# Spike-2 完工报告 — packages/vault-fs/ markdown ↔ Y.Doc Reconcile

> Phase 6 Spike-2 / 2026-05-12 / branch: claude/spike-2-vault-fs

## 验收对照（design spec §8 Spike-2）

| 验收项 | 结果 | 备注 |
|---|---|---|
| 5 fixture 全 pass（cold-start / external-edit / 3-way merge / sidecar 损坏 / sync 中断） | <PASS / FAIL> | 各 fixture 1 test |
| markdown emit 通过 Design.md §11 reject grep | <PASS / FAIL> | task 10 |
| Y.Doc → markdown emit 与 PM JSON wire format（ADR-0005）兼容 | <PASS / FAIL> | task 11 review log |
| 5 客户端 stress 1000 ops + offline/online 切换 → CRDT 最终一致 + markdown 单一 | <PASS / FAIL> | task 9 stress harness |

## Failure mode 命中？

- [ ] markdown reconcile 复杂度 > Phase 6 W3-W4 预算 2x → 倒退到 sqlite + markdown export-only
  - 实测：填写（task 8 fixture 工程量 / task 7 三方合并工程量）

## Time 总计

- Plan estimate: 5-7 天
- Actual: <X 天>
- 主要 over/under-run 原因：填写（custom node directive 解析推 Phase 6 / chokidar 跨平台 quirks）

## 后续

- Phase 6 W3-W4：doc-store `FileSystemBackend` 真接入 vault-fs；markdown-it directive plugin 真实现 `::claim{...}` 解析；diff3 改 Myers 算法；canonicalizer 加 trailing-blank 归一化；3-way merge UI 在 apps/desktop（Spike-1 artifacts 集成）
- 三 Spike 全 PASS 后启 ADR-0017 (client-first runtime) / ADR-0018 (open content) / ADR-0019 (plugin runtime)
```

- [ ] **Step 1**: 执行完 task 1-11 后填实际数据
- [ ] **Step 2**: Commit

```bash
git add docs/superpowers/reports/2026-05-12-spike-2-report.md
git commit -m "P6(spike-2 task 12): Spike-2 完工报告"
```

---

## Self-Review 结果（执行 plan 时引用）

### Spec coverage
- §4 `packages/vault-fs/` 组件 → tasks 1-7 全覆盖
- §5 F1 打开文档（hydrate Y.Doc from sidecar / 冷启动） → fixture 1 + task 4
- §5 F2 本地编辑 in-memory Y.Doc → debounced sidecar / markdown flush → **不在 Spike-2 scope**（Phase 6 W3-W4 doc-store FileSystemBackend 接 watcher）；spike-2 只提供 API + 单元测试基础
- §8 Spike-2 验收 5 项 → task 8 fixture 5 + task 10 reject grep + task 9 stress
- §13 ADR 影响：ADR-0001 §5.A 反转的实证 → task 11 review log

### Out-of-scope explicit
- Tauri 集成 / 系统托盘 / IPC（Spike-1）
- Plugin sandbox（Spike-3）
- ed25519 keypair（`packages/identity/`，Phase 6 W1-W2 单独）
- Open content publish（Phase 6 W6-W7）
- doc-store FileSystemBackend 真接入（Phase 6 W3-W4 消费 spike-2 artifacts）

### Placeholder scan
- ✓ 所有 step 有代码或精确命令
- ✓ Task 8 fixture skeleton 留空但已展示 fixture-cold-start 完整代码作模板（其余 4 fixture 类似）
- ✓ Task 9 stress harness step 1 留 `// ...` 占位，step 2 标"真实现 + 测试"——执行者必须补完

### Type consistency
- `VaultPath` (string brand) / `SidecarBytes` (Uint8Array) / `ConflictRegion` 全在 `_shared.ts` 单源
- `DriftReport` / `ThreeWayMergeResult` 也在 `_shared`
- `VaultEvent.kind` (add|change|unlink) 与 chokidar event 名严格对齐

---

## Phase 6 后续 plan

- Spike-3 plan：`docs/superpowers/plans/2026-05-12-spike-3-plugin-runtime.md`
- 三 spike 全 PASS → ADR-0017/0018/0019 Proposed
- Phase 6 W3-W4：doc-store `FileSystemBackend` 真接入 vault-fs；markdown directive plugin（`::claim{...}`）替代 HTML comment 兜底；diff3 改 Myers；3-way merge UI on apps/desktop
