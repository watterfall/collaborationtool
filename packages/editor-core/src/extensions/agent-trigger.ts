// agent-trigger: TipTap extension that turns the editor selection into an
// "AI 协作动作" trigger surface (第一性原理 #3：AI 是协作者不是侧边栏).
//
// Phase 4 W6.1：兑现 `.brainstorm/role-user.md §2` + `.brainstorm/role-ai.md §2`
// 提的 UI 缺口——`AgentPanel` 折叠侧边栏要求用户手动粘贴段落 + 选 kind +
// 点 Run。这里把 trigger 改成 PM mark 风格的 inline floating menu：
//
//   - ⌘K (Mac) / Ctrl-K (Win/Linux) 在当前选区上方弹出 menu
//   - 自动从 `view.state.selection` 抽取 passage / blockId / blockKind
//   - 命令 `openAgentMenu()` / `closeAgentMenu()` / `invokeAgent({kind})`
//   - 不依赖任何 React 组件——仅暴露 plugin / command + DOM CustomEvent；
//     UI 渲染层在 apps/web (`InlineAgentMenu.tsx`) 监听 `agentMenu:open`。
//
// ID 兜底（Paragraph / Heading 等无 `blockId` attr 的节点）：用 PM 文档
// 内的位置编码 `pos:<n>` 作为 ad-hoc blockId。Phase 5 把 Heading +
// Paragraph 升级到带 blockId 之后这条兜底自动失活。

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Selection } from '@tiptap/pm/state';
import type { Node as PmNode, ResolvedPos } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    agentTrigger: {
      /** Open the inline agent floating menu using current selection. */
      openAgentMenu: () => ReturnType;
      /** Close the menu (Esc / outside click). */
      closeAgentMenu: () => ReturnType;
      /** Programmatic agent invocation (used by tests + chip clicks). */
      invokeAgent: (
        payload: AgentInvokeRequest,
      ) => ReturnType;
    };
  }
}

export type AgentKind =
  | 'inline-editor'
  | 'citation'
  | 'researcher'
  | 'reviewer';

export interface AgentSelectionContext {
  /** Plain-text passage extracted from the selection (or enclosing block). */
  passage: string;
  /** Best-effort block id; falls back to `pos:<n>` for blocks without id attr. */
  blockId: string;
  /** ProseMirror node type name for the enclosing block (e.g. `paragraph`, `claim`). */
  blockKind: string;
  /** PM-level from / to so the menu can position itself. */
  from: number;
  to: number;
  /** True if selection has zero width (cursor only). */
  empty: boolean;
}

export interface AgentInvokeRequest {
  kind: AgentKind;
  /** Optional free-text instructions (only inline-editor uses today). */
  instructions?: string;
  /** When omitted, extracted from current selection at invocation time. */
  context?: AgentSelectionContext;
}

export interface AgentMenuOpenDetail {
  /** Selection context at the moment ⌘K fired. */
  context: AgentSelectionContext;
  /** Bounding rect of the selection (or cursor) for menu positioning. */
  selectionRect: { top: number; left: number; bottom: number; right: number };
}

export const AGENT_MENU_OPEN_EVENT = 'agentMenu:open';
export const AGENT_MENU_CLOSE_EVENT = 'agentMenu:close';
export const AGENT_INVOKE_EVENT = 'agentMenu:invoke';

export const agentTriggerPluginKey = new PluginKey('agent-trigger');

/**
 * Find the deepest enclosing block ancestor of a resolved position. Returns
 * `{ node, depth, before }` so callers can read attrs + compute pos-based
 * fallback ids.
 */
export function findEnclosingBlock(
  $pos: ResolvedPos,
): { node: PmNode; depth: number; before: number } | null {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.isBlock && !node.isTextblock) {
      // Container block (claim / evidence / figure). Prefer it.
      return { node, depth: d, before: $pos.before(d) };
    }
  }
  // No outer container — fall back to nearest textblock (paragraph / heading).
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.isTextblock) {
      return { node, depth: d, before: $pos.before(d) };
    }
  }
  return null;
}

/**
 * Pull passage / blockId / blockKind out of a PM EditorState. Pure — used
 * by both the runtime command and unit tests.
 */
export function getActiveSelectionContext(
  state: EditorState,
): AgentSelectionContext {
  const sel: Selection = state.selection;
  const empty = sel.empty;

  let from = sel.from;
  let to = sel.to;

  if (empty) {
    // Cursor-only: expand passage to the entire enclosing block so the
    // agent has something to act on.
    const $from = state.doc.resolve(from);
    const block = findEnclosingBlock($from);
    if (block) {
      const start = block.before + 1;
      const end = block.before + block.node.nodeSize - 1;
      from = start;
      to = end;
    }
  }

  // textBetween with single-space block separator preserves cross-paragraph
  // sanity without leaking newlines into prompts.
  const passage = state.doc.textBetween(from, to, ' ').trim();

  // For blockId / blockKind we anchor at selection.from (first block when
  // selection spans multiple blocks).
  const $anchor = state.doc.resolve(sel.from);
  const block = findEnclosingBlock($anchor);

  let blockId = '';
  let blockKind = 'unknown';
  if (block) {
    blockKind = block.node.type.name;
    const attrId = (block.node.attrs as Record<string, unknown>)['blockId'];
    if (typeof attrId === 'string' && attrId) {
      blockId = attrId;
    } else {
      // Heading / Paragraph — no native blockId attr. Use pos-based
      // synthetic id so PG `revision.block_id` is at least stable per
      // session. Phase 5 promotes Heading / Paragraph to carry blockId.
      blockId = `pos:${block.before}`;
    }
  } else {
    blockId = `pos:${sel.from}`;
  }

  return { passage, blockId, blockKind, from, to, empty };
}

/**
 * Internal helper — resolves the bounding rect for the current selection
 * by combining PM `coordsAtPos` calls. Returns viewport-coordinate rect.
 *
 * Only called inside the runtime command; tests cover the pure
 * `getActiveSelectionContext` instead.
 */
function selectionViewportRect(
  view: { coordsAtPos: (pos: number) => { top: number; bottom: number; left: number; right: number } },
  from: number,
  to: number,
): { top: number; left: number; bottom: number; right: number } {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  return {
    top: Math.min(start.top, end.top),
    bottom: Math.max(start.bottom, end.bottom),
    left: Math.min(start.left, end.left),
    right: Math.max(start.right, end.right),
  };
}

/**
 * Map an AgentKind to whether the current selection context is "highlight
 * worthy" — used by the menu to nudge the most relevant chip.
 */
export function chipRelevance(
  ctx: AgentSelectionContext,
  kind: AgentKind,
): 'primary' | 'secondary' | 'normal' {
  switch (kind) {
    case 'citation':
      // Cursor in citation-ref atom (selection collapses on atom) → primary.
      // Note: PM doesn't surface the mark from textBetween alone — the
      // React layer can detect `state.selection.$from` mark stack and
      // override. This default rules out the cheap blockKind heuristic.
      return ctx.blockKind === 'citationRef' ? 'primary' : 'normal';
    case 'researcher':
      return ctx.blockKind === 'claim' ? 'primary' : 'normal';
    case 'inline-editor':
      // The "default" action for any selection.
      return ctx.passage.length > 0 ? 'secondary' : 'normal';
    case 'reviewer':
      return 'normal';
  }
}

export interface AgentTriggerOptions {
  /**
   * Override the keyboard shortcut. Defaults to `Mod-k`. TipTap's default
   * keymap maps `Mod` to `Cmd` on Mac and `Ctrl` elsewhere.
   */
  shortcut?: string;
}

export const AgentTrigger = Extension.create<AgentTriggerOptions>({
  name: 'agentTrigger',

  addOptions() {
    return { shortcut: 'Mod-k' };
  },

  addKeyboardShortcuts() {
    const key = this.options.shortcut ?? 'Mod-k';
    return {
      [key]: () => this.editor.commands.openAgentMenu(),
      Escape: () => this.editor.commands.closeAgentMenu(),
    };
  },

  addCommands() {
    return {
      openAgentMenu:
        () =>
        ({ editor }) => {
          const ctx = getActiveSelectionContext(editor.state);
          const view = editor.view;
          // In jsdom-free node:test runs there's no DOM; emit through the
          // editor's `emit` if available, otherwise dispatch a CustomEvent
          // on the view.dom. Tests stub view.dom with an EventTarget.
          let rect = { top: 0, left: 0, bottom: 0, right: 0 };
          try {
            rect = selectionViewportRect(
              view as unknown as { coordsAtPos: (p: number) => { top: number; bottom: number; left: number; right: number } },
              ctx.from,
              ctx.to,
            );
          } catch {
            // tests / SSR — coordsAtPos requires a real DOM
          }
          const detail: AgentMenuOpenDetail = { context: ctx, selectionRect: rect };
          const target = view.dom as unknown as EventTarget | undefined;
          if (target && typeof target.dispatchEvent === 'function') {
            target.dispatchEvent(
              new CustomEvent(AGENT_MENU_OPEN_EVENT, {
                detail,
                bubbles: true,
              }),
            );
          }
          return true;
        },

      closeAgentMenu:
        () =>
        ({ editor }) => {
          const target = editor.view.dom as unknown as EventTarget | undefined;
          if (target && typeof target.dispatchEvent === 'function') {
            target.dispatchEvent(
              new CustomEvent(AGENT_MENU_CLOSE_EVENT, { bubbles: true }),
            );
          }
          return true;
        },

      invokeAgent:
        (payload: AgentInvokeRequest) =>
        ({ editor }) => {
          const ctx = payload.context ?? getActiveSelectionContext(editor.state);
          const detail: AgentInvokeRequest = {
            kind: payload.kind,
            ...(payload.instructions !== undefined
              ? { instructions: payload.instructions }
              : {}),
            context: ctx,
          };
          const target = editor.view.dom as unknown as EventTarget | undefined;
          if (target && typeof target.dispatchEvent === 'function') {
            target.dispatchEvent(
              new CustomEvent(AGENT_INVOKE_EVENT, { detail, bubbles: true }),
            );
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    // No-op plugin today — reserved for future selection decorations
    // (e.g. underline trigger surface). Keeps the plugin key stable so
    // outside code can `state.plugins[?].key === agentTriggerPluginKey`.
    return [
      new Plugin({
        key: agentTriggerPluginKey,
      }),
    ];
  },
});
