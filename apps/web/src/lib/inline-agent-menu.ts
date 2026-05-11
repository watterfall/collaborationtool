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
// Phase 4 W6.3 (`.brainstorm/role-user.md §5 P2`)新增第 5 个 chip：
//   - 插入引用 / Cite by DOI → kind=citation, mode='doi-direct'
// 用户点击后 menu 切换为 DOI 输入模式（一个 input + 确认按钮，不开模态框）。
//
// 路由 `/api/agent/invoke` 当前接 `inline-editor` + `citation`（含 doi-
// direct 子模式）；`researcher` / `reviewer` 走相同 contract，路由 400 时
// 由 React 层 toast。

import type { AgentKind, AgentSelectionContext } from '@collaborationtool/editor-core';

/**
 * Mode discriminator for chips that share an `AgentKind` but trigger
 * different sub-flows. Phase 4 W6.3 introduces `'doi-direct'`: same
 * kind=`citation`, but the host bypasses passage analysis and looks up
 * the user-supplied DOI directly via CrossRef MCP `lookup_doi`.
 *
 * `undefined` mode = the existing analyse-passage path. The route +
 * citation plugin treat absent `mode` as the legacy behaviour, so older
 * clients keep working.
 */
export type ChipMode = 'doi-direct';

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
  /**
   * Optional sub-mode discriminator. Phase 4 W6.3: `'doi-direct'` is the
   * citation chip variant that takes a user-typed DOI instead of crawling
   * the selected passage. The InlineAgentMenu renders a DOI input field
   * inline (not a modal) when `mode === 'doi-direct'` is clicked.
   */
  mode?: ChipMode;
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
    kind: 'citation',
    label: '插入引用 / Cite by DOI',
    testId: 'chip-citation-doi',
    routeSupported: true,
    mode: 'doi-direct',
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
 *
 * Phase 4 W6.3: when `mode === 'doi-direct'` and `doi` is supplied, the
 * citation body carries `{ doi, mode: 'doi-direct' }` instead of the
 * passage-crawl flaggedDoiCandidates list. The route forwards both fields
 * to the citation plugin's hints map so the plugin layer narrows on its
 * own (third-party callers that hit the plugin directly get the same
 * narrowing without needing the route to do it for them).
 */
export function buildInvokeRequestBody(args: {
  kind: AgentKind;
  documentId: string;
  context: AgentSelectionContext;
  instructions?: string;
  /** Phase 4 W6.3 — citation `doi-direct` chip submits the user's DOI here. */
  doi?: string;
  /** Phase 4 W6.3 — sub-mode discriminator. */
  mode?: ChipMode;
}): Record<string, unknown> {
  const { kind, documentId, context, instructions, doi, mode } = args;
  const base = {
    kind,
    documentId,
    blockId: context.blockId,
    passage: context.passage,
  };

  if (kind === 'citation') {
    if (mode === 'doi-direct' && typeof doi === 'string' && doi.trim().length > 0) {
      // Direct lookup path — bypass passage analysis. Plugin uses CrossRef
      // MCP `lookup_doi` with the supplied DOI.
      return { ...base, doi: doi.trim(), mode };
    }
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

/**
 * DOI shape validator — local import-safe check (lightweight; the source
 * of truth is `editor-core` `DOI_PATTERN`). We duplicate the pattern here
 * to avoid a cross-package import in the menu helpers (apps/web's tests
 * pin this without pulling in editor-core's PM imports).
 */
const DOI_VALIDATION_PATTERN = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

export function isValidDoiInput(value: string): boolean {
  return DOI_VALIDATION_PATTERN.test(value.trim());
}

export interface MenuStrings {
  title: string;
  emptyHint: string;
  instructionsLabel: string;
  instructionsPlaceholder: string;
  unsupportedHint: string;
  pendingHint: string;
  closeLabel: string;
  /** Phase 4 W6.3 — DOI sub-mode strings (chip-citation-doi). */
  doiInputLabel: string;
  doiInputPlaceholder: string;
  doiSubmitLabel: string;
  doiInvalidError: string;
  doiBackLabel: string;
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
  doiInputLabel: '输入 DOI / Enter DOI',
  doiInputPlaceholder: '10.1145/3531146.3533104',
  doiSubmitLabel: '查找并插入 / Look up & insert',
  doiInvalidError: 'DOI 格式不正确 / Invalid DOI format',
  doiBackLabel: '返回 / Back',
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
