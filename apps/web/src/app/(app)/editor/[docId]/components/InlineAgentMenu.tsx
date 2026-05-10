'use client';

// Phase 4 W6.1 — InlineAgentMenu.
//
// 兑现第一性原理 #3「AI 是协作者不是侧边栏」：替代旧 AgentPanel 折叠
// 侧边栏，selection 自动取 passage / blockId，⌘K 弹出，4 chip 直接调用。
//
// 监听 editor.view.dom 的 `agentMenu:open` CustomEvent；以此触发浮层。
// 关闭通过 Esc / 点 menu 外 / selection clear 三种方式。
//
// 不引入新 npm dep——浮层用 absolute positioned div + 选区 boundingRect
// 自家实现（约 30 行）；这等于不依赖 @floating-ui/react。

import {
  AGENT_INVOKE_EVENT,
  AGENT_MENU_CLOSE_EVENT,
  AGENT_MENU_OPEN_EVENT,
  type AgentInvokeRequest,
  type AgentKind,
  type AgentMenuOpenDetail,
  type AgentSelectionContext,
  type TipTapEditor,
} from '@collaborationtool/editor-core';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AGENT_CHIPS,
  MENU_STRINGS,
  buildInvokeRequestBody,
  chipVisualLevel,
} from '@/lib/inline-agent-menu';

export interface InlineAgentMenuProps {
  /** Live TipTap editor — see Editor.onEditorReady. */
  editor: TipTapEditor | null;
  /** Document being edited (passed through to /api/agent/invoke). */
  documentId: string;
  /**
   * Override the network call. Default = POST `/api/agent/invoke`. Tests
   * inject a stub.
   */
  onInvoke?: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}

interface OpenState {
  context: AgentSelectionContext;
  rect: { top: number; left: number; bottom: number; right: number };
}

const DEFAULT_INVOKER: NonNullable<InlineAgentMenuProps['onInvoke']> = async (
  body,
) => {
  const res = await fetch('/api/agent/invoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    return { ok: false, error: payload.detail ?? payload.error ?? `HTTP ${res.status}` };
  }
  return { ok: true };
};

export default function InlineAgentMenu({
  editor,
  documentId,
  onInvoke,
}: InlineAgentMenuProps) {
  const [openState, setOpenState] = useState<OpenState | null>(null);
  const [pendingKind, setPendingKind] = useState<AgentKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpenState(null);
    setError(null);
    setInstructions('');
  }, []);

  // Listen on the editor's DOM for open / close events emitted by
  // AgentTrigger.openAgentMenu / closeAgentMenu.
  useEffect(() => {
    if (!editor) return;
    const target = editor.view.dom;
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<AgentMenuOpenDetail>).detail;
      setOpenState({ context: detail.context, rect: detail.selectionRect });
      setError(null);
    };
    const onClose = () => close();
    target.addEventListener(AGENT_MENU_OPEN_EVENT, onOpen as EventListener);
    target.addEventListener(AGENT_MENU_CLOSE_EVENT, onClose);
    return () => {
      target.removeEventListener(AGENT_MENU_OPEN_EVENT, onOpen as EventListener);
      target.removeEventListener(AGENT_MENU_CLOSE_EVENT, onClose);
    };
  }, [editor, close]);

  // Esc / outside click close.
  useEffect(() => {
    if (!openState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [openState, close]);

  if (!openState) return null;

  const { context, rect } = openState;
  const passageEmpty = context.passage.length === 0;

  const invoker = onInvoke ?? DEFAULT_INVOKER;

  const handleClick = async (kind: AgentKind) => {
    setPendingKind(kind);
    setError(null);
    try {
      const body = buildInvokeRequestBody({
        kind,
        documentId,
        context,
        ...(instructions.trim() ? { instructions } : {}),
      });
      const res = await invoker(body);
      if (!res.ok) {
        setError(res.error ?? '未知错误 / Unknown error');
        // RevisionInbox refresh is auto via its own poll button; no
        // explicit dispatch needed here.
        return;
      }
      // Success → emit `agentMenu:invoke` so any analytics layer can
      // count, then close.
      const target = editor?.view.dom;
      if (target) {
        const detail: AgentInvokeRequest = { kind, context };
        target.dispatchEvent(
          new CustomEvent(AGENT_INVOKE_EVENT, { detail, bubbles: true }),
        );
      }
      close();
    } finally {
      setPendingKind(null);
    }
  };

  // Floating positioning: anchor below selection, clamped to viewport.
  const top = Math.min(
    rect.bottom + 8,
    typeof window !== 'undefined' ? window.innerHeight - 200 : rect.bottom + 8,
  );
  const left = Math.max(8, Math.min(rect.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - 360));

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-label={MENU_STRINGS.title}
      data-testid="inline-agent-menu"
      className="fixed z-50 w-[340px] rounded-md border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      style={{ top, left }}
    >
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-zinc-700 dark:text-zinc-200">{MENU_STRINGS.title}</strong>
        <button
          type="button"
          onClick={close}
          aria-label={MENU_STRINGS.closeLabel}
          className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ×
        </button>
      </div>

      {passageEmpty && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          {MENU_STRINGS.emptyHint}
        </p>
      )}

      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {AGENT_CHIPS.map((chip) => {
          const level = chipVisualLevel(context, chip.kind);
          const isPending = pendingKind === chip.kind;
          const disabled = passageEmpty || pendingKind !== null;
          const aria = level === 'primary' ? 'true' : undefined;
          const styleClass =
            level === 'primary'
              ? 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
              : level === 'secondary'
                ? 'border-zinc-700 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100'
                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';
          return (
            <button
              key={chip.kind}
              type="button"
              data-testid={chip.testId}
              data-chip-level={level}
              data-route-supported={String(chip.routeSupported)}
              aria-current={aria}
              disabled={disabled}
              onClick={() => void handleClick(chip.kind)}
              title={chip.routeSupported ? chip.label : MENU_STRINGS.unsupportedHint}
              className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] disabled:opacity-50 ${styleClass} ${
                !chip.routeSupported ? 'opacity-60' : ''
              }`}
            >
              {isPending ? MENU_STRINGS.pendingHint : chip.label}
              {!chip.routeSupported && (
                <span className="ml-1 rounded bg-zinc-200 px-1 text-[9px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                  WIP
                </span>
              )}
            </button>
          );
        })}
      </div>

      <label className="mt-1 flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {MENU_STRINGS.instructionsLabel}
        </span>
        <input
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={MENU_STRINGS.instructionsPlaceholder}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-500">
        提议会写入下方 <strong>待评审修订</strong>。 / Proposals appear in the
        Revision Inbox below.
      </p>
    </div>
  );
}
