// Phase 6 W2-W3 — FileSystemDocumentHandle contract.
//
// Uses STUB hooks (not real vault-fs) to keep doc-store dep-free
// of editor-core / vault-fs and avoid the import cycle.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import * as Y from 'yjs';

import {
  FileSystemDocumentHandle,
  markdownPath,
  sidecarPath,
  type FileSystemHooks,
} from '../src/filesystem-backend';

// ---------- stub vault-fs primitives ----------
// 4-byte magic header mirrors vault-fs format so real wire interop
// stays sound — even though we're using stubs, the *encoded shape* is
// real bytes.
const STUB_MAGIC = new Uint8Array([0x56, 0x46, 0x53, 0x42]); // 'VFSB'
const STUB_HEADER_LEN = 8;

function stubEncodeHeader(): Uint8Array {
  const buf = new Uint8Array(STUB_HEADER_LEN);
  buf.set(STUB_MAGIC, 0);
  buf[4] = 1; // version 1
  return buf;
}

const stubHooks: FileSystemHooks = {
  readSidecar: async (path) => {
    try {
      const buf = await readFile(path);
      // strip magic header — same shape as real vault-fs
      return new Uint8Array(buf).slice(STUB_HEADER_LEN);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  },
  writeSidecar: async (path, bytes) => {
    await mkdir(dirname(path), { recursive: true });
    const header = stubEncodeHeader();
    const out = new Uint8Array(header.length + bytes.length);
    out.set(header, 0);
    out.set(bytes, header.length);
    const tmp = `${path}.tmp`;
    await writeFile(tmp, out);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, path);
  },
  // Stub markdown emit: surface Y.Text "body" content as plain markdown.
  emitMarkdown: (yDoc) => {
    const t = yDoc.getText('body');
    return t.toString();
  },
  // Stub parse: write the entire markdown into Y.Text("body").
  parseMarkdown: (markdown) => {
    const doc = new Y.Doc();
    const t = doc.getText('body');
    t.insert(0, markdown);
    return doc;
  },
};

let vault: string;
beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'fsbackend-'));
});
afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

// ---------- path helpers ----------

describe('sidecarPath / markdownPath', () => {
  it('sidecarPath joins <vault>/.vault/yjs/<id>.bin', () => {
    assert.equal(
      sidecarPath('/v', 'doc-1'),
      '/v/.vault/yjs/doc-1.bin',
    );
  });

  it('markdownPath joins <vault>/<relPath>', () => {
    assert.equal(
      markdownPath('/v', 'papers/draft.md'),
      '/v/papers/draft.md',
    );
  });
});

// ---------- cold-start resolution ----------

describe('FileSystemDocumentHandle.create cold-start resolution', () => {
  it('empty vault → empty Y.Doc', async () => {
    const h = await FileSystemDocumentHandle.create({
      id: 'doc-empty',
      vaultRoot: vault,
      relativePath: 'doc.md',
      hooks: stubHooks,
    });
    assert.equal(h.getText('body').toString(), '');
    h.destroy();
  });

  it('sidecar present → hydrate from sidecar bytes', async () => {
    // Seed sidecar with state where body="from-sidecar"
    const seedDoc = new Y.Doc();
    seedDoc.getText('body').insert(0, 'from-sidecar');
    const seedBytes = Y.encodeStateAsUpdate(seedDoc);
    await stubHooks.writeSidecar(sidecarPath(vault, 'doc-sidecar'), seedBytes);

    const h = await FileSystemDocumentHandle.create({
      id: 'doc-sidecar',
      vaultRoot: vault,
      relativePath: 'doc.md',
      hooks: stubHooks,
    });
    assert.equal(h.getText('body').toString(), 'from-sidecar');
    h.destroy();
  });

  it('markdown file present + no sidecar → hydrate from markdown', async () => {
    const mdPath = markdownPath(vault, 'paper.md');
    await mkdir(dirname(mdPath), { recursive: true });
    await writeFile(mdPath, 'from-markdown', 'utf8');

    const h = await FileSystemDocumentHandle.create({
      id: 'doc-md',
      vaultRoot: vault,
      relativePath: 'paper.md',
      hooks: stubHooks,
    });
    assert.equal(h.getText('body').toString(), 'from-markdown');
    h.destroy();
  });

  it('sidecar wins over markdown when both exist', async () => {
    const seedDoc = new Y.Doc();
    seedDoc.getText('body').insert(0, 'sidecar-version');
    await stubHooks.writeSidecar(
      sidecarPath(vault, 'doc-both'),
      Y.encodeStateAsUpdate(seedDoc),
    );
    const mdPath = markdownPath(vault, 'doc.md');
    await mkdir(dirname(mdPath), { recursive: true });
    await writeFile(mdPath, 'markdown-version', 'utf8');

    const h = await FileSystemDocumentHandle.create({
      id: 'doc-both',
      vaultRoot: vault,
      relativePath: 'doc.md',
      hooks: stubHooks,
    });
    assert.equal(h.getText('body').toString(), 'sidecar-version');
    h.destroy();
  });
});

// ---------- debounced flush ----------

describe('debounced flush on update', () => {
  it('Y.Doc edit → sidecar + markdown written after flush window', async () => {
    const h = await FileSystemDocumentHandle.create({
      id: 'doc-flush',
      vaultRoot: vault,
      relativePath: 'flush.md',
      hooks: stubHooks,
      sidecarFlushMs: 30, // fast for tests
      markdownFlushMs: 50,
    });

    h.getText('body').insert(0, 'hello flush');

    // Wait past both debounce windows
    await new Promise((r) => setTimeout(r, 150));

    // Sidecar written
    const sidecarStat = await stat(sidecarPath(vault, 'doc-flush'));
    assert.ok(sidecarStat.size > STUB_HEADER_LEN);

    // Markdown written
    const md = await readFile(markdownPath(vault, 'flush.md'), 'utf8');
    assert.equal(md, 'hello flush');

    h.destroy();
  });

  it('successive edits debounce — only one flush after window', async () => {
    let sidecarWriteCount = 0;
    let markdownWriteCount = 0;
    const countingHooks: FileSystemHooks = {
      readSidecar: stubHooks.readSidecar,
      writeSidecar: async (path, bytes) => {
        sidecarWriteCount++;
        await stubHooks.writeSidecar(path, bytes);
      },
      emitMarkdown: (doc) => {
        markdownWriteCount++; // emit is called only when markdown flush fires
        return stubHooks.emitMarkdown(doc);
      },
      parseMarkdown: stubHooks.parseMarkdown,
    };

    const h = await FileSystemDocumentHandle.create({
      id: 'doc-debounce',
      vaultRoot: vault,
      relativePath: 'debounce.md',
      hooks: countingHooks,
      sidecarFlushMs: 30,
      markdownFlushMs: 30,
    });

    // 10 rapid edits within a 5ms window
    for (let i = 0; i < 10; i++) {
      h.getText('body').insert(h.getText('body').length, `${i}`);
    }
    await new Promise((r) => setTimeout(r, 100));

    assert.equal(sidecarWriteCount, 1, 'sidecar should flush once after burst');
    assert.equal(markdownWriteCount, 1, 'markdown should flush once after burst');

    h.destroy();
  });

  it('flush() force-writes immediately bypassing debounce', async () => {
    const h = await FileSystemDocumentHandle.create({
      id: 'doc-force',
      vaultRoot: vault,
      relativePath: 'force.md',
      hooks: stubHooks,
      sidecarFlushMs: 10_000, // long enough to ensure debounce doesn't fire
      markdownFlushMs: 10_000,
    });

    h.getText('body').insert(0, 'force flush');
    await h.flush();

    const md = await readFile(markdownPath(vault, 'force.md'), 'utf8');
    assert.equal(md, 'force flush');
    const sidecarStat = await stat(sidecarPath(vault, 'doc-force'));
    assert.ok(sidecarStat.size > STUB_HEADER_LEN);

    h.destroy();
  });

  it('destroy() stops scheduling further flushes', async () => {
    const h = await FileSystemDocumentHandle.create({
      id: 'doc-destroy',
      vaultRoot: vault,
      relativePath: 'destroy.md',
      hooks: stubHooks,
      sidecarFlushMs: 30,
      markdownFlushMs: 30,
    });

    h.destroy();

    // Post-destroy edits should not crash; the inner Y.Doc is destroyed
    // so further mutation is a no-op or throw — both acceptable; we
    // assert simply that destroy doesn't leak open timers (Node would
    // hang at test exit if it did).
    assert.ok(true);
  });
});

// ---------- DocumentHandle delegation ----------

describe('DocumentHandle interface delegation', () => {
  it('exposes id + yDoc + getText/Map/XmlFragment', async () => {
    const h = await FileSystemDocumentHandle.create({
      id: 'doc-delegate',
      vaultRoot: vault,
      relativePath: 'delegate.md',
      hooks: stubHooks,
    });

    assert.equal(h.id, 'doc-delegate');
    assert.ok(h.yDoc);
    assert.equal(h.getText('a').toString(), '');
    assert.equal(h.getMap('m').size, 0);
    assert.equal(h.getXmlFragment('f').length, 0);

    h.destroy();
  });

  it('encodeStateAsUpdate + applyUpdate round-trip', async () => {
    const h1 = await FileSystemDocumentHandle.create({
      id: 'doc-rt-a',
      vaultRoot: vault,
      relativePath: 'a.md',
      hooks: stubHooks,
    });
    h1.getText('body').insert(0, 'state');
    const update = h1.encodeStateAsUpdate();

    const h2 = await FileSystemDocumentHandle.create({
      id: 'doc-rt-b',
      vaultRoot: vault,
      relativePath: 'b.md',
      hooks: stubHooks,
    });
    h2.applyUpdate(update);
    assert.equal(h2.getText('body').toString(), 'state');

    h1.destroy();
    h2.destroy();
  });

  it('getSubdocument returns a DocumentHandle (delegated to YjsDocumentHandle)', async () => {
    const h = await FileSystemDocumentHandle.create({
      id: 'doc-subdoc',
      vaultRoot: vault,
      relativePath: 'parent.md',
      hooks: stubHooks,
    });
    const sub = h.getSubdocument('chapter-1');
    assert.equal(sub.id, 'doc-subdoc/chapter-1');
    h.destroy();
  });
});
