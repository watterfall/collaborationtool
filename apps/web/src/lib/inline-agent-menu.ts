// Phase 4 W6.1 — InlineAgentMenu pure helpers.
//
// 把 chip 表格 / 中英双语 label / kind→capability 映射这些"无 React 状态"
// 的逻辑独立出来，方便用 node:test 锁住语义；React 组件层渲染样式 + 浮层
// 定位由 e2e 覆盖。
//
// 这里"chip" = floating menu 上的一个动作按钮。Phase 4 W6.1 共 4 个：
//   - 改写 / Rewrite      → kind=inline-editor
//   - 核引用 / Verify cite → kind=citation
//   - 找证据 / Find evidence → kind=researcher
//   - 评审 / Review        → kind=reviewer
//
// 路由 `/api/agent/invoke` 当前只接 `inline-editor` + `citation`；
// `researcher` / `reviewer` 走相同 contract，路由 400 时由 React 层 toast。
// Phase 4 W7.x 会扩 route，这里 chip 表先把 4 个 kind 都列上，避免 UI 层
// 之后还要回头改。

import type { AgentKind, AgentSelectionContext } from '@collaborationtool/editor-core';

export interface ChipDescriptor {
  kind: AgentKind;
  /** Bilingual label: "中文 / English" matches the project's "复制邀请链接 / Copy link" pattern. */
  label: string;
  /** ASCII shorthand surfaced in tests + analytics. */
  testId: string;
  /**
   * Whether the route currently supports this kind. UI dims the chip when
   * `false` so users see the full vocabulary but get a clear hint that
   * `researcher` / `reviewer` are still wiring up.
   */
  routeSupported: boolean;
}

export const AGENT_CHIPS: readonly ChipDescriptor[] = [
  {
    kind: 'inline-editor',
    label: '改写 / Rewrite',
    testId: 'chip-inline-editor',
    routeSupported: true,
  },
  {
    kind: 'citation',
    label: '核引用 / Verify citation',
    testId: 'chip-citation',
    routeSupported: true,
  },
  {
    kind: 'researcher',
    label: '找证据 / Find evidence',
    testId: 'chip-researcher',
    routeSupported: false,
  },
  {
    kind: 'reviewer',
    label: '评审 / Review',
    testId: 'chip-reviewer',
    routeSupported: false,
  },
] as const;

/**
 * Map a chip kind → POST body for `/api/agent/invoke`. The route accepts
 * different "instruction" field names per kind (citation: flaggedDoiCandidates,
 * inline-editor: userInstruction). Centralised here so the React component
 * stays declarative.
 */
export function buildInvokeRequestBody(args: {
  kind: AgentKind;
  documentId: string;
  context: AgentSelectionContext;
  instructions?: string;
}): Record<string, unknown> {
  const { kind, documentId, context, instructions } = args;
  const base = {
    kind,
    documentId,
    blockId: context.blockId,
    passage: context.passage,
  };

  if (kind === 'citation') {
    // No DOI list at the menu layer — agent extracts from passage. UI can
    // surface a follow-up textarea once we have a real "verify single DOI"
    // mode; today we send no flagged candidates and let the agent crawl.
    return { ...base, flaggedDoiCandidates: [] };
  }

  if (kind === 'inline-editor') {
    return {
      ...base,
      userInstruction: instructions?.trim() || 'rephrase for clarity',
    };
  }

  // researcher / reviewer — route 400s today, we surface that.
  return { ...base };
}

export interface MenuStrings {
  title: string;
  emptyHint: string;
  instructionsLabel: string;
  instructionsPlaceholder: string;
  unsupportedHint: string;
  pendingHint: string;
  closeLabel: string;
}

/** Bilingual strings for every menu surface. Aligns with COPY_BUTTON_LABEL idiom. */
export const MENU_STRINGS: MenuStrings = {
  title: 'AI 协作动作 / AI agent action',
  emptyHint: '把光标放进段落或选中文字 / Place cursor in a block or select text',
  instructionsLabel: '附加指令（可选） / Extra instructions (optional)',
  instructionsPlaceholder: '更正式 / make this more formal',
  unsupportedHint: '该动作仍在接通中（路由暂不支持） / Action wiring up — route not enabled yet',
  pendingHint: '调用中… / Invoking…',
  closeLabel: '关闭 / Close',
};

/** Should the chip be primary (call out) given the current selection? */
export function chipVisualLevel(
  ctx: AgentSelectionContext,
  kind: AgentKind,
): 'primary' | 'secondary' | 'normal' {
  if (kind === 'researcher' && ctx.blockKind === 'claim') return 'primary';
  if (kind === 'citation' && ctx.blockKind === 'citationRef') return 'primary';
  if (kind === 'inline-editor' && ctx.passage.length > 0) return 'secondary';
  return 'normal';
}
