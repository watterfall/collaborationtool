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
// 不在这里直接 import yjs/y-prosemirror 类型给 apps/web —— 这两个 dep 已
// 经在 editor-core 的 package.json 里，apps/web 只通过 editor-core 公共
// API 使用即可。

import * as Y from 'yjs';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';

import { paperSchema } from './schema';

const DEFAULT_FRAGMENT_NAME = 'default';

/**
 * Apply a ProseMirror JSON document to an existing Y.Doc as the initial
 * seed for the editor's collaboration fragment. The Y.Doc is mutated
 * in-place; the function returns whether anything was written (i.e. the
 * fragment was non-empty in the JSON).
 *
 * Throws if the PM JSON does not validate against the paperSchema —
 * better to refuse loudly than ship a corrupt document.
 */
export function seedYDocFromPmJson(
  ydoc: Y.Doc,
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
  const update = Y.encodeStateAsUpdate(seedDoc);
  Y.applyUpdate(ydoc, update);
  // Snapshot whether the fragment now contains anything.
  const fragment = ydoc.getXmlFragment(fragmentName);
  return fragment.length > 0;
}

/** Whether a Y.Doc collaboration fragment is currently empty. */
export function isYDocFragmentEmpty(
  ydoc: Y.Doc,
  fragmentName: string = DEFAULT_FRAGMENT_NAME,
): boolean {
  const fragment = ydoc.getXmlFragment(fragmentName);
  return fragment.length === 0;
}
