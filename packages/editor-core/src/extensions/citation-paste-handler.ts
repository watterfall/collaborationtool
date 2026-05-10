// citation-paste-handler — TipTap extension that intercepts pasted text
// containing a DOI, runs CrossRef lookup, and inline-replaces it with a
// `citation-ref` atom node.
//
// Phase 4 W6.3 兑现 `.brainstorm/role-user.md §5 P2`：粘 DOI → 自动核 →
// inline 插入 citation-ref。不让用户绕到 AgentPanel 的 DOI textarea。
//
// 设计要点：
//   - PM `props.handlePaste` 监听粘贴文本（不动 HTML 粘贴；HTML 走默认）
//   - 命中 DOI 正则后阻断默认 paste，先 inline 插入 loading 占位文本，
//     再调 `onLookup({ doi })` Promise；resolve 后用 citation-ref 节点替
//     换 loading；reject 后保留原 DOI 文本 + console.warn 不打扰用户
//   - `onLookup` 在 packages/editor-core 内**没有真实实现** —— 默认走
//     `defaultOnLookupNoop`（直接 reject，UI 退化为保留 DOI 文本）。
//     apps/web 在 mount Editor 时 `CitationPasteHandler.configure({ onLookup })`
//     注入真 fetch 逻辑（POST `/api/agent/invoke` with mode='doi-direct'）。
//   - 命令 `lookupAndInsertCitation({ doi, position })` 暴露给程式化调用
//     ——测试 + InlineAgentMenu 的 DOI chip 提交路径都走这条命令。
//
// DOI 正则参考 CrossRef "DOI handbook" 推荐式：
//   /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i
// 边界：句首大写 `10.X`、嵌入文本中、句末标点 `.`。不识别 ISBN/ISSN/URL
// path（`/foo/bar`）；这些走默认 paste。

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

import { newBlockId, newCitationId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citationPasteHandler: {
      /**
       * Run a CrossRef lookup for the given DOI and insert a `citation-ref`
       * atom at `position`. If the lookup fails, the command leaves the
       * inserted DOI text in place (UI degrades gracefully).
       */
      lookupAndInsertCitation: (args: {
        doi: string;
        /** PM position to insert at; if absent, uses current selection.from. */
        position?: number;
      }) => ReturnType;
    };
  }
}

/**
 * CrossRef DOI pattern — anchors on `10.<registrant>/<suffix>` per the
 * CrossRef handbook (5.2 Sample DOI). Case-insensitive (DOIs are case-
 * insensitive per the handbook).
 *
 * Test fixture cases:
 *   - 句末标点：`See 10.1145/3531146.3533104.` → match excludes the trailing dot
 *   - 句首大写：`10.X/AbC.123` → still matches
 *   - 嵌入文本：`Reference: 10.48550/arXiv.2310.06770 here` → matches middle
 *   - 不识别 ISBN/ISSN：`ISBN 978-0-123` → no match
 */
export const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;

/**
 * Pull the first DOI out of a string. Returns null when none match.
 * Strips a single trailing punctuation char (`.`, `,`, `;`, `)`, `]`)
 * because the regex's `\b` lets these slip in for some suffix shapes.
 */
export function extractDoi(text: string): string | null {
  const m = DOI_PATTERN.exec(text);
  if (!m) return null;
  const raw = m[0];
  const cleaned = raw.replace(/[.,;:)\]]+$/, '');
  return cleaned;
}

/** Result the host returns after a CrossRef lookup. */
export interface CitationLookupResult {
  /** Stable citation id (from PG `citation` table or freshly minted). */
  citationId: string;
  /** Display label — typically `${author} ${year}` or `[N]`. */
  label: string;
  /** Raw CSL-JSON record returned by CrossRef; available for hover preview. */
  cslJson?: Record<string, unknown> | undefined;
}

/** Host-supplied lookup function. Resolves on success, rejects on failure. */
export type CitationLookupFn = (input: {
  doi: string;
}) => Promise<CitationLookupResult>;

export interface CitationPasteHandlerOptions {
  /**
   * Callback invoked when a DOI is pasted. Default = always reject (the
   * extension's UI degrades to "keep original DOI text"). apps/web wires
   * a real fetch implementation in `Editor` mount.
   */
  onLookup: CitationLookupFn;
  /**
   * Optional sink for "lookup failed" notifications. Default = console.warn.
   * Tests can stub to verify failure surfaces.
   */
  onLookupError?: (err: { doi: string; reason: string }) => void;
}

const defaultOnLookupNoop: CitationLookupFn = ({ doi }) => {
  return Promise.reject(
    new Error(
      `[citation-paste-handler] no onLookup configured; DOI ${doi} kept as plain text`,
    ),
  );
};

export const citationPasteHandlerPluginKey = new PluginKey(
  'citation-paste-handler',
);

export const CITATION_LOOKUP_START_EVENT = 'citationPaste:start';
export const CITATION_LOOKUP_DONE_EVENT = 'citationPaste:done';
export const CITATION_LOOKUP_FAIL_EVENT = 'citationPaste:fail';

export const CitationPasteHandler = Extension.create<CitationPasteHandlerOptions>({
  name: 'citationPasteHandler',

  addOptions() {
    return {
      onLookup: defaultOnLookupNoop,
    };
  },

  addCommands() {
    return {
      lookupAndInsertCitation:
        (args: { doi: string; position?: number }) =>
        ({ editor, dispatch, tr, state }) => {
          // Compute target position: explicit > selection.from
          const targetPos =
            typeof args.position === 'number' ? args.position : state.selection.from;

          // Validate DOI (defensive: command may be invoked from menus).
          const cleaned = extractDoi(args.doi) ?? args.doi.trim();
          if (!cleaned || !DOI_PATTERN.test(cleaned)) {
            return false;
          }

          // Optimistic loading marker = the raw DOI text. PM tr first
          // inserts the text so the user has something to look at; the
          // async lookup then either upgrades it to a citation-ref or
          // leaves it (failure path).
          if (dispatch) {
            tr.insertText(cleaned, targetPos);
            dispatch(tr);
          }

          const onLookup = this.options.onLookup;
          const onLookupError =
            this.options.onLookupError ??
            ((info) => {
              // eslint-disable-next-line no-console
              console.warn(
                `[citation-paste-handler] CrossRef lookup failed for ${info.doi}: ${info.reason}`,
              );
            });

          // Fire start event for UI hover-preview hooks.
          const dom = editor.view.dom as unknown as EventTarget | undefined;
          if (dom && typeof dom.dispatchEvent === 'function') {
            dom.dispatchEvent(
              new CustomEvent(CITATION_LOOKUP_START_EVENT, {
                detail: { doi: cleaned, position: targetPos },
                bubbles: true,
              }),
            );
          }

          void onLookup({ doi: cleaned })
            .then((result) => {
              const { state: latest, dispatch: latestDispatch } = editor.view;
              const replacement = latest.schema.nodes['citationRef']?.create({
                blockId: newBlockId(),
                citationId: result.citationId || newCitationId(),
                label: result.label,
              });
              if (!replacement) {
                onLookupError({
                  doi: cleaned,
                  reason: 'citationRef node missing from schema',
                });
                return;
              }
              const from = targetPos;
              const to = targetPos + cleaned.length;
              const tr2 = latest.tr.replaceWith(from, to, replacement);
              latestDispatch(tr2);

              if (dom && typeof dom.dispatchEvent === 'function') {
                dom.dispatchEvent(
                  new CustomEvent(CITATION_LOOKUP_DONE_EVENT, {
                    detail: { doi: cleaned, result },
                    bubbles: true,
                  }),
                );
              }
            })
            .catch((err: unknown) => {
              const reason = err instanceof Error ? err.message : String(err);
              onLookupError({ doi: cleaned, reason });
              if (dom && typeof dom.dispatchEvent === 'function') {
                dom.dispatchEvent(
                  new CustomEvent(CITATION_LOOKUP_FAIL_EVENT, {
                    detail: { doi: cleaned, reason },
                    bubbles: true,
                  }),
                );
              }
            });

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const onLookup = this.options.onLookup;
    const onLookupError = this.options.onLookupError;
    const editor = this.editor;

    return [
      new Plugin({
        key: citationPasteHandlerPluginKey,
        props: {
          handlePaste(view: EditorView, event: ClipboardEvent): boolean {
            // Only intercept plain-text paste. HTML (rich) paste keeps
            // its default behaviour so users pasting from web pages get
            // the source's marks intact.
            const text = event.clipboardData?.getData('text/plain') ?? '';
            const html = event.clipboardData?.getData('text/html') ?? '';
            if (html.trim().length > 0) return false;
            const doi = extractDoi(text);
            if (!doi) return false;

            // Block default — we'll handle insertion via the command.
            event.preventDefault();
            const targetPos = view.state.selection.from;

            // Insert via the `lookupAndInsertCitation` command so the
            // logic is shared between paste + menu-driven inserts.
            const cmd = (
              editor.commands as unknown as {
                lookupAndInsertCitation: (args: {
                  doi: string;
                  position: number;
                }) => boolean;
              }
            ).lookupAndInsertCitation;
            if (typeof cmd === 'function') {
              cmd({ doi, position: targetPos });
            } else {
              // Fallback: invoke onLookup directly (extension order issue).
              void onLookup({ doi })
                .then((result) => {
                  const node = view.state.schema.nodes['citationRef']?.create({
                    blockId: newBlockId(),
                    citationId: result.citationId || newCitationId(),
                    label: result.label,
                  });
                  if (node) {
                    const tr = view.state.tr.insert(targetPos, node);
                    view.dispatch(tr);
                  }
                })
                .catch((err: unknown) => {
                  const reason = err instanceof Error ? err.message : String(err);
                  if (onLookupError) {
                    onLookupError({ doi, reason });
                  } else {
                    // eslint-disable-next-line no-console
                    console.warn(
                      `[citation-paste-handler] CrossRef lookup failed for ${doi}: ${reason}`,
                    );
                  }
                });
            }
            return true;
          },
        },
      }),
    ];
  },
});
