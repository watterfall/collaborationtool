'use client';

// Phase 4 W10.7 — Design.md compliance: amber/red filled banners →
// hairline left-rules; zinc-* button styles → editorial token + Button
// variants; chip-grid 3-level visual states preserved via primary/ghost
// /link variants instead of zinc shade gradient. Reject criteria
// #1/#2/#5/#6.

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

import { Button } from '@/components/design';
import { isTauri } from '@/lib/desktop-bridge';
import {
  AGENT_CHIPS,
  MENU_STRINGS,
  buildInvokeRequestBody,
  chipVisualLevel,
  isValidDoiInput,
  toggleLocalAi,
  type ChipDescriptor,
  type InlineAgentMenuLocalAiState,
} from '@/lib/inline-agent-menu';
import { detectOllamaInBrowser } from '@/lib/local-ollama';

const CHIP_BASE_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
  cursor: 'pointer',
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--radius-1)',
  transition: 'background 120ms ease-out, border-color 120ms ease-out',
};

function chipStyle(level: 'primary' | 'secondary' | 'normal'): React.CSSProperties {
  if (level === 'primary') {
    return {
      ...CHIP_BASE_STYLE,
      background: 'var(--color-ink)',
      color: 'var(--color-paper)',
      border: '1px solid var(--color-ink)',
      fontWeight: 500,
    };
  }
  if (level === 'secondary') {
    return {
      ...CHIP_BASE_STYLE,
      border: '1px solid var(--color-pencil)',
    };
  }
  return CHIP_BASE_STYLE;
}

const FIELD_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  padding: '6px 10px',
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--radius-1)',
};

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
  // Phase 4 W6.3 — DOI sub-mode (chip-citation-doi). When non-null, the
  // menu renders an inline DOI input form instead of the chip grid.
  const [doiInputMode, setDoiInputMode] = useState<ChipDescriptor | null>(null);
  const [doiInput, setDoiInput] = useState('');
  // Phase 5 Wave B Spike-1 — local-AI (Ollama) toggle, only shown when
  // Tauri + ollama are both reachable. State is local; routing to local
  // model happens once ai-runtime client adapter lands (Spike-2/3).
  const [localAiState, setLocalAiState] = useState<InlineAgentMenuLocalAiState>({
    localAi: false,
  });
  const [ollamaReady, setOllamaReady] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpenState(null);
    setError(null);
    setInstructions('');
    setDoiInputMode(null);
    setDoiInput('');
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

  // Phase 5 Wave B Spike-1 — probe local Ollama once when running inside
  // Tauri. Browser sessions skip the probe entirely (Tauri-only feature).
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    void detectOllamaInBrowser().then((ready) => {
      if (!cancelled) setOllamaReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!openState) return null;

  const { context, rect } = openState;
  const passageEmpty = context.passage.length === 0;

  const invoker = onInvoke ?? DEFAULT_INVOKER;

  const handleChipClick = (chip: ChipDescriptor) => {
    // Phase 4 W6.3 — DOI sub-mode chip → swap UI to the DOI input form,
    // do NOT invoke yet (user types DOI, hits Enter / Submit, then we
    // POST with mode='doi-direct').
    if (chip.mode === 'doi-direct') {
      setDoiInputMode(chip);
      setError(null);
      return;
    }
    void handleInvoke(chip.kind);
  };

  const handleInvoke = async (
    kind: AgentKind,
    extras: { doi?: string; mode?: 'doi-direct' } = {},
  ) => {
    setPendingKind(kind);
    setError(null);
    try {
      const body = buildInvokeRequestBody({
        kind,
        documentId,
        context,
        ...(instructions.trim() ? { instructions } : {}),
        ...(extras.doi !== undefined ? { doi: extras.doi } : {}),
        ...(extras.mode !== undefined ? { mode: extras.mode } : {}),
      });
      const res = await invoker(body);
      if (!res.ok) {
        setError(res.error ?? '未知错误 / Unknown error');
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

  const handleDoiSubmit = () => {
    const trimmed = doiInput.trim();
    if (!isValidDoiInput(trimmed)) {
      setError(MENU_STRINGS.doiInvalidError);
      return;
    }
    void handleInvoke('citation', { doi: trimmed, mode: 'doi-direct' });
  };

  const handleDoiBack = () => {
    setDoiInputMode(null);
    setDoiInput('');
    setError(null);
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
      style={{
        position: 'fixed',
        zIndex: 50,
        width: '340px',
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-2)',
        padding: '12px 14px',
        fontSize: '12px',
        top,
        left,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <strong
          className="label-cap"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {MENU_STRINGS.title}
        </strong>
        <Button
          variant="link"
          size="sm"
          onClick={close}
          ariaLabel={MENU_STRINGS.closeLabel}
        >
          ×
        </Button>
      </div>

      {passageEmpty && !doiInputMode && (
        <p
          style={{
            marginBottom: '8px',
            borderLeft: '2px solid var(--color-accent-ox)',
            padding: '6px 10px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '11px',
            color: 'var(--color-accent-ox)',
          }}
        >
          {MENU_STRINGS.emptyHint}
        </p>
      )}

      {!doiInputMode && (
        <div
          data-testid="inline-agent-menu-chip-grid"
          style={{
            marginBottom: '8px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}
        >
          {AGENT_CHIPS.map((chip) => {
            const level = chipVisualLevel(context, chip.kind);
            const isPending = pendingKind === chip.kind && !chip.mode;
            const disabled =
              (chip.mode === 'doi-direct' ? false : passageEmpty) ||
              pendingKind !== null;
            const aria = level === 'primary' ? 'true' : undefined;
            const baseStyle = chipStyle(level);
            const finalStyle: React.CSSProperties = {
              ...baseStyle,
              opacity: !chip.routeSupported ? 0.6 : disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            };
            return (
              <button
                key={chip.testId}
                type="button"
                data-testid={chip.testId}
                data-chip-level={level}
                data-route-supported={String(chip.routeSupported)}
                data-chip-mode={chip.mode ?? ''}
                aria-current={aria}
                disabled={disabled}
                onClick={() => handleChipClick(chip)}
                title={chip.routeSupported ? chip.label : MENU_STRINGS.unsupportedHint}
                style={finalStyle}
              >
                {isPending ? MENU_STRINGS.pendingHint : chip.label}
                {!chip.routeSupported && (
                  <span
                    style={{
                      marginLeft: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--color-ink-3)',
                      borderLeft: '1px solid var(--color-hairline)',
                      paddingLeft: '4px',
                    }}
                  >
                    WIP
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!doiInputMode && (
        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          <span
            className="label-cap"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {MENU_STRINGS.instructionsLabel}
          </span>
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={MENU_STRINGS.instructionsPlaceholder}
            style={FIELD_STYLE}
          />
        </label>
      )}

      {doiInputMode && (
        <div
          data-testid="inline-agent-menu-doi-form"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <label
            style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            <span
              className="label-cap"
              style={{ color: 'var(--color-ink-3)' }}
            >
              {MENU_STRINGS.doiInputLabel}
            </span>
            <input
              type="text"
              data-testid="doi-input"
              value={doiInput}
              autoFocus
              onChange={(e) => {
                setDoiInput(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleDoiSubmit();
                }
              }}
              placeholder={MENU_STRINGS.doiInputPlaceholder}
              style={FIELD_STYLE}
            />
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              data-testid="doi-back"
              onClick={handleDoiBack}
            >
              {MENU_STRINGS.doiBackLabel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              data-testid="doi-submit"
              disabled={pendingKind !== null || doiInput.trim().length === 0}
              onClick={handleDoiSubmit}
            >
              {pendingKind === 'citation'
                ? MENU_STRINGS.pendingHint
                : MENU_STRINGS.doiSubmitLabel}
            </Button>
          </div>
        </div>
      )}

      {ollamaReady && !doiInputMode && (
        <label
          data-testid="inline-agent-menu-local-ai-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--color-ink-3)',
          }}
        >
          <input
            type="checkbox"
            checked={localAiState.localAi ?? false}
            onChange={() => setLocalAiState((prev) => toggleLocalAi(prev))}
            style={{ accentColor: 'var(--color-ink)' }}
          />
          <span>使用本地 AI · Use local AI (Ollama)</span>
        </label>
      )}

      {error && (
        <p
          role="alert"
          style={{
            marginTop: '8px',
            borderLeft: '2px solid var(--color-accent-ox)',
            padding: '6px 10px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '11px',
            color: 'var(--color-accent-ox)',
          }}
        >
          {error}
        </p>
      )}

      <p
        style={{
          marginTop: '8px',
          fontFamily: 'var(--font-sans)',
          fontSize: '10px',
          color: 'var(--color-ink-3)',
          fontStyle: 'italic',
        }}
      >
        提议会写入下方 <strong style={{ fontStyle: 'normal' }}>待评审修订</strong>。 / Proposals appear in the
        Revision Inbox below.
      </p>
    </div>
  );
}
