// Phase 4 W6.2 — 文档模板首次播种 helpers
//
// apps/web 的"新建文档"流程支持 3 模板（blank / bilingual-paper /
// lit-review）。模板是 PM JSON。我们需要在 Editor 挂载之前，把 PM JSON
// 转成 Y.Doc 状态，写到本地 Y.Doc 上。Y-prosemirror 自带
// prosemirrorJSONToYDoc：传入 schema + JSON + xml fragment 名（TipTap
// extension-collaboration 默认 fragment 名是 'default'）即可拿到一个新的
// Y.Doc。我们再把它的 update 直接 applyUpdate 到当前 Y.Doc 上。
//
// 调用方负责：
//   - 在拿到 sync bundle 之后、Editor 实际挂载之前调用一次；
//   - 只在 Y.Doc fragment 当前为空时才调（避免重播覆盖远端内容）；
//   - 把 PM JSON 取自服务端（确保只有第一次连接的 client 拿到）。
//
// 注意：y-prosemirror 的 prosemirrorJSONToYDoc 用 'prosemirror' 作为默认
// fragment 名；我们的 Editor.tsx 用 TipTap Collaboration 默认值 'default'，
// 因此显式传 'default' 让两边对齐。
//
// Phase 4 W7.1 收口：所有 Yjs primitive 都从 @collaborationtool/doc-store
// 拿（escape hatch 再导出 Y.Doc/encodeStateAsUpdate 等）。直接 import
// 'yjs' 在 editor-core 已经全部清掉。
// y-prosemirror 仍然单独 import：它产出 Y.Doc 当桥（PM JSON → Y bytes）
// 之后我们立即编码成 update bytes 喂给 DocumentHandle，源 Y.Doc 不外泄。

import { prosemirrorJSONToYDoc } from 'y-prosemirror';

import {
  type DocumentHandle,
  yEncodeStateAsUpdate,
} from '@collaborationtool/doc-store';

import { paperSchema } from './schema';

const DEFAULT_FRAGMENT_NAME = 'default';

/**
 * Apply a ProseMirror JSON document to an existing DocumentHandle as
 * the initial seed for the editor's collaboration fragment. The handle
 * is mutated in-place; returns whether anything was written.
 *
 * Throws if the PM JSON does not validate against the paperSchema —
 * better to refuse loudly than ship a corrupt document.
 */
export function seedDocumentFromPmJson(
  handle: DocumentHandle,
  pmJson: unknown,
  options: { fragment?: string } = {},
): boolean {
  const schema = paperSchema();
  // Validate first; throws on shape mismatch.
  schema.nodeFromJSON(pmJson).check();

  const fragmentName = options.fragment ?? DEFAULT_FRAGMENT_NAME;
  const seedDoc = prosemirrorJSONToYDoc(
    schema,
    pmJson as Parameters<typeof prosemirrorJSONToYDoc>[1],
    fragmentName,
  );
  const update = yEncodeStateAsUpdate(seedDoc);
  handle.applyUpdate(update);
  // Snapshot whether the fragment now contains anything.
  const fragment = handle.getXmlFragment(fragmentName);
  return fragment.length > 0;
}

/** Whether a DocumentHandle's collaboration fragment is currently empty. */
export function isDocumentFragmentEmpty(
  handle: DocumentHandle,
  fragmentName: string = DEFAULT_FRAGMENT_NAME,
): boolean {
  const fragment = handle.getXmlFragment(fragmentName);
  return fragment.length === 0;
}

