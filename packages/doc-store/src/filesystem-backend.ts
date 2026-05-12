// Phase 6 W2-W3 — Filesystem-backed DocumentHandle implementation
// (ADR-0017 §1.3 / spec §4 vault-fs component).
//
// Wraps a YjsDocumentHandle internally + initial-load-from-disk + two
// debounced flush channels (sidecar 500ms / markdown 2000ms).
//
// Why DI instead of direct vault-fs import:
//   doc-store ← editor-core ← vault-fs would close the cycle
//   (editor-core depends on doc-store; vault-fs depends on editor-core
//   for paperSchema). To keep doc-store as a pure CRDT abstraction,
//   FileSystemDocumentHandle accepts markdown emit/parse + sidecar IO
//   as INJECTED hooks. Callers (apps/desktop or tests) compose:
//
//     import * as vaultFs from '@collaborationtool/vault-fs';
//     const handle = new FileSystemDocumentHandle({
//       id, vaultRoot, relativePath,
//       hooks: {
//         readSidecar: vaultFs.readSidecar,
//         writeSidecar: vaultFs.writeSidecar,
//         emitMarkdown: vaultFs.emitMarkdown,
//         parseMarkdown: (md) => vaultFs.parseMarkdown(md),
//       },
//     });

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import * as Y from 'yjs';

import type {
  Disposable,
  DocumentHandle,
  UpdateCallback,
} from './types';
import { YjsDocumentHandle } from './yjs-backend';

/**
 * Injected filesystem hooks. Production callers wire real
 * `@collaborationtool/vault-fs` functions; tests stub them.
 *
 * `readSidecar` returns `null` when the sidecar file doesn't exist
 * (cold-start case — caller decides whether to parse markdown or start
 * empty). `writeSidecar` MUST be atomic (write to .tmp then rename).
 *
 * `parseMarkdown` returns a fresh Y.Doc; we lift its state into our
 * internal Y.Doc via Y.applyUpdate to preserve handle identity.
 */
export interface FileSystemHooks {
  readSidecar(absolutePath: string): Promise<Uint8Array | null>;
  writeSidecar(absolutePath: string, bytes: Uint8Array): Promise<void>;
  emitMarkdown(yDoc: Y.Doc): string;
  parseMarkdown(markdown: string): Y.Doc;
}

export interface FileSystemDocumentHandleOptions {
  /** Stable identifier (used in logs + subdoc cache keys). */
  id: string;
  /** Vault root path, e.g. `/Users/jili/MyVault`. */
  vaultRoot: string;
  /**
   * Document path relative to vaultRoot, e.g. `papers/draft-1.md`.
   * The markdown file lives at `<vaultRoot>/<relativePath>`.
   */
  relativePath: string;
  /** Injected filesystem + reconcile hooks. */
  hooks: FileSystemHooks;
  /** Debounce window in ms before flushing sidecar (default 500). */
  sidecarFlushMs?: number;
  /** Debounce window in ms before flushing markdown (default 2000). */
  markdownFlushMs?: number;
  /** Optional pre-existing Y.Doc to adopt instead of creating fresh. */
  yDoc?: Y.Doc;
}

const DEFAULT_SIDECAR_MS = 500;
const DEFAULT_MARKDOWN_MS = 2000;

/** Compute the sidecar binary path for a given vault root + id. */
export function sidecarPath(vaultRoot: string, id: string): string {
  return join(vaultRoot, '.vault', 'yjs', `${id}.bin`);
}

/** Compute the absolute markdown path for a given vault root + relPath. */
export function markdownPath(vaultRoot: string, relativePath: string): string {
  return join(vaultRoot, relativePath);
}

/**
 * FileSystemDocumentHandle — DocumentHandle backed by a Y.Doc + on-disk
 * sidecar + markdown twin. The internal Y.Doc is the same shape
 * YjsDocumentHandle exposes; we add load-on-create + debounced flush
 * on update.
 *
 * Lifecycle:
 *   1. `await FileSystemDocumentHandle.create({...})` — async because we
 *      read disk (sidecar or markdown) before returning.
 *   2. The handle observes Y.Doc updates and schedules debounced
 *      flushes to sidecar (.vault/yjs/<id>.bin) + markdown (<relPath>).
 *   3. `await handle.flush()` — force-flush both channels (use before
 *      app quit).
 *   4. `handle.destroy()` — clear timers + dispose internal handle.
 */
export class FileSystemDocumentHandle implements DocumentHandle {
  readonly id: string;
  readonly vaultRoot: string;
  readonly relativePath: string;

  private readonly inner: YjsDocumentHandle;
  private readonly hooks: FileSystemHooks;
  private readonly sidecarFlushMs: number;
  private readonly markdownFlushMs: number;
  private readonly observerDispose: Disposable;
  private sidecarTimer: ReturnType<typeof setTimeout> | null = null;
  private markdownTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  /** Pending flush promises so callers can await on destroy. */
  private pendingFlushes = new Set<Promise<void>>();

  private constructor(opts: FileSystemDocumentHandleOptions) {
    this.id = opts.id;
    this.vaultRoot = opts.vaultRoot;
    this.relativePath = opts.relativePath;
    this.hooks = opts.hooks;
    this.sidecarFlushMs = opts.sidecarFlushMs ?? DEFAULT_SIDECAR_MS;
    this.markdownFlushMs = opts.markdownFlushMs ?? DEFAULT_MARKDOWN_MS;
    this.inner = new YjsDocumentHandle({ id: opts.id, yDoc: opts.yDoc });

    // Hook update observer — schedule debounced flushes on every change.
    this.observerDispose = this.inner.observe(() => {
      this.scheduleSidecarFlush();
      this.scheduleMarkdownFlush();
    });
  }

  /**
   * Construct a handle with disk preload.
   *
   * Cold-start resolution order:
   *   1. If `.vault/yjs/<id>.bin` exists → read + applyUpdate
   *   2. Else if `<vaultRoot>/<relativePath>` exists → parseMarkdown + lift state
   *   3. Else → empty Y.Doc (fresh document)
   */
  static async create(
    opts: FileSystemDocumentHandleOptions,
  ): Promise<FileSystemDocumentHandle> {
    const handle = new FileSystemDocumentHandle(opts);

    // Cold-start step 1: try sidecar.
    const sidecarBytes = await opts.hooks.readSidecar(
      sidecarPath(opts.vaultRoot, opts.id),
    );
    if (sidecarBytes && sidecarBytes.length > 0) {
      Y.applyUpdate(handle.inner.yDoc, sidecarBytes, 'fs:sidecar-cold-start');
      return handle;
    }

    // Cold-start step 2: try markdown file. Read directly via fs since
    // the hooks' parseMarkdown takes a string.
    const mdPath = markdownPath(opts.vaultRoot, opts.relativePath);
    let mdContent: string | null = null;
    try {
      mdContent = await readFile(mdPath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    if (mdContent !== null && mdContent.length > 0) {
      const tmpDoc = opts.hooks.parseMarkdown(mdContent);
      const update = Y.encodeStateAsUpdate(tmpDoc);
      Y.applyUpdate(handle.inner.yDoc, update, 'fs:markdown-cold-start');
    }
    // Step 3 fallthrough — empty Y.Doc, no preload needed.

    return handle;
  }

  // ---------- Flush logic ----------

  private scheduleSidecarFlush(): void {
    if (this.destroyed) return;
    if (this.sidecarTimer) clearTimeout(this.sidecarTimer);
    this.sidecarTimer = setTimeout(() => {
      this.sidecarTimer = null;
      const p = this.flushSidecar();
      this.pendingFlushes.add(p);
      p.finally(() => this.pendingFlushes.delete(p));
    }, this.sidecarFlushMs);
  }

  private scheduleMarkdownFlush(): void {
    if (this.destroyed) return;
    if (this.markdownTimer) clearTimeout(this.markdownTimer);
    this.markdownTimer = setTimeout(() => {
      this.markdownTimer = null;
      const p = this.flushMarkdown();
      this.pendingFlushes.add(p);
      p.finally(() => this.pendingFlushes.delete(p));
    }, this.markdownFlushMs);
  }

  private async flushSidecar(): Promise<void> {
    if (this.destroyed) return;
    const bytes = Y.encodeStateAsUpdate(this.inner.yDoc);
    await this.hooks.writeSidecar(
      sidecarPath(this.vaultRoot, this.id),
      bytes,
    );
  }

  private async flushMarkdown(): Promise<void> {
    if (this.destroyed) return;
    const md = this.hooks.emitMarkdown(this.inner.yDoc);
    const target = markdownPath(this.vaultRoot, this.relativePath);
    await mkdir(dirname(target), { recursive: true });
    // Atomic write — vault file is user-visible, partial writes would
    // surface in their editor.
    const tmp = `${target}.tmp`;
    await writeFile(tmp, md, 'utf8');
    const { rename } = await import('node:fs/promises');
    await rename(tmp, target);
  }

  /**
   * Force-flush both channels immediately (cancels pending debounce).
   * Use before app quit to ensure disk and memory are aligned.
   */
  async flush(): Promise<void> {
    if (this.sidecarTimer) {
      clearTimeout(this.sidecarTimer);
      this.sidecarTimer = null;
    }
    if (this.markdownTimer) {
      clearTimeout(this.markdownTimer);
      this.markdownTimer = null;
    }
    await Promise.all([this.flushSidecar(), this.flushMarkdown()]);
    // Drain any in-flight flushes scheduled before we cancelled timers.
    await Promise.all([...this.pendingFlushes]);
  }

  /**
   * Stop observing + clear timers + dispose internal handle.
   * After destroy, the handle should not be used.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.sidecarTimer) clearTimeout(this.sidecarTimer);
    if (this.markdownTimer) clearTimeout(this.markdownTimer);
    this.sidecarTimer = null;
    this.markdownTimer = null;
    this.observerDispose.dispose();
    this.inner.destroy();
  }

  // ---------- DocumentHandle delegation ----------

  get yDoc(): Y.Doc {
    return this.inner.yDoc;
  }

  getText(name: string): Y.Text {
    return this.inner.getText(name);
  }

  getMap<T = unknown>(name: string): Y.Map<T> {
    return this.inner.getMap<T>(name);
  }

  getXmlFragment(name: string): Y.XmlFragment {
    return this.inner.getXmlFragment(name);
  }

  observe(callback: UpdateCallback): Disposable {
    return this.inner.observe(callback);
  }

  transact(fn: () => void, origin?: unknown): void {
    this.inner.transact(fn, origin);
  }

  encodeStateAsUpdate(): Uint8Array {
    return this.inner.encodeStateAsUpdate();
  }

  encodeStateVector(): Uint8Array {
    return this.inner.encodeStateVector();
  }

  encodeDelta(baseStateVector: Uint8Array): Uint8Array {
    return this.inner.encodeDelta(baseStateVector);
  }

  applyUpdate(update: Uint8Array, origin?: unknown): void {
    this.inner.applyUpdate(update, origin);
  }

  /**
   * Subdoc lookup currently delegates to the inner YjsDocumentHandle —
   * subdocs do NOT get their own filesystem twin in Phase 6 W2-W3.
   * ADR-0014 subdoc promotion + per-subdoc visibility will add a
   * filesystem-twin variant when subdoc dogfood gate passes.
   */
  getSubdocument(name: string): DocumentHandle {
    return this.inner.getSubdocument(name);
  }
}
