// Vault doc binding — webview-side YDoc lifecycle for vault-host editing.
//
// 桌面端 vault 编辑的 YDoc 绑定层：从 vault-host `doc.open` 返回的全量
// state 水合本地 YDoc，把本地编辑产生的增量 update 通过回调交给调用方
// （调用方经 vault-host-bridge `doc.applyUpdate` 推给 Node host 落盘），
// 外部变更（external edit → doc.state 增量）用 EXTERNAL_ORIGIN 应用，
// 不回声给 host。
//
// ⚠️ Fragment 名契约：vault-fs 的 markdown twin emit 读的是
// `yDoc.getXmlFragment('prosemirror')`（ydoc-to-markdown.ts），而 TipTap
// Collaboration 的默认 field 是 'default'。两边对不上时编辑器看似正常、
// 落盘 markdown 永远为空 —— 所以 VaultEditor 必须显式使用
// VAULT_COLLABORATION_FIELD，测试锁死该常量。

// W7.1 收口：Yjs primitive 一律经 @collaborationtool/doc-store 拿，
// editor-core 不直接 import 'yjs'（同 commit.test.ts 约定）。
import {
  YDoc,
  yApplyUpdate,
  yEncodeStateAsUpdate,
  yEncodeStateVector,
} from '@collaborationtool/doc-store';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';

import { paperSchema } from '../schema';

/**
 * Must match vault-fs `ydoc-to-markdown.ts` / `markdown-to-ydoc.ts`
 * (y-prosemirror default). NOT TipTap Collaboration's 'default'.
 */
export const VAULT_COLLABORATION_FIELD = 'prosemirror';

/** Origin tag for updates that came FROM vault-host (never relayed back). */
export const VAULT_EXTERNAL_ORIGIN = 'vault-host';

export interface VaultDocBinding {
  readonly doc: YDoc;
  /** Apply a full state or delta received from vault-host (no relay echo). */
  applyExternalState(stateOrUpdate: Uint8Array): void;
  /** Local state vector — pass to `doc.state` to receive only the delta. */
  encodeStateVector(): Uint8Array;
  destroy(): void;
}

/**
 * Create the binding. `initialState` is the full YDoc state from
 * `doc.open` (may be empty for a brand-new markdown file). Every update
 * whose origin is not vault-host — i.e. local edits AND the initial seed —
 * is relayed through `onLocalUpdate` so the Node host stays converged.
 */
export function createVaultDocBinding(
  initialState: Uint8Array | null,
  onLocalUpdate: (update: Uint8Array) => void,
): VaultDocBinding {
  const doc = new YDoc();
  if (initialState && initialState.byteLength > 0) {
    yApplyUpdate(doc, initialState, VAULT_EXTERNAL_ORIGIN);
  }

  const relay = (update: Uint8Array, origin: unknown) => {
    if (origin === VAULT_EXTERNAL_ORIGIN) return;
    onLocalUpdate(update);
  };
  doc.on('update', relay);

  let destroyed = false;
  return {
    doc,
    applyExternalState(stateOrUpdate: Uint8Array) {
      yApplyUpdate(doc, stateOrUpdate, VAULT_EXTERNAL_ORIGIN);
    },
    encodeStateVector() {
      return yEncodeStateVector(doc);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      doc.off('update', relay);
      doc.destroy();
    },
  };
}

export function isVaultFragmentEmpty(doc: YDoc): boolean {
  return doc.getXmlFragment(VAULT_COLLABORATION_FIELD).length === 0;
}

/**
 * Seed an empty vault doc with a minimal paragraph (or supplied PM JSON)
 * so TipTap has a block to bind to — an empty XmlFragment renders as a
 * non-interactive blank surface (same bug class Editor.tsx works around).
 *
 * Deliberately applied with a LOCAL origin: the seed must relay to
 * vault-host, otherwise later incremental updates reference items the
 * host never saw and Yjs silently defers them (host doc stays empty,
 * markdown twin never materialises).
 */
export function seedVaultDocIfEmpty(doc: YDoc, pmJson?: unknown): boolean {
  if (!isVaultFragmentEmpty(doc)) return false;
  const json = pmJson ?? { type: 'doc', content: [{ type: 'paragraph' }] };
  const seeded = prosemirrorJSONToYDoc(
    paperSchema(),
    json,
    VAULT_COLLABORATION_FIELD,
  );
  yApplyUpdate(doc, yEncodeStateAsUpdate(seeded));
  return true;
}
