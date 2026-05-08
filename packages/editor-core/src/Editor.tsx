'use client';

// React Editor component — TipTap + Collaboration + sync-gateway transport.
// apps/web's /editor/[docId] page mounts this. The component is
// StrictMode-safe (proto-a D3 follow-up P2): setup happens in useEffect
// with a destroy() cleanup, and the EditorContent is conditionally
// rendered only after sync is ready.

import Collaboration from '@tiptap/extension-collaboration';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor as TipTapEditor } from '@tiptap/core';
import { useEffect, useRef, useState } from 'react';

import { PAPER_SCHEMA_EXTENSIONS } from './extensions/all';
import { setupSync, type SyncBundle } from './sync/setup';
import type { ConnectionMode } from './sync/wire';

export interface EditorProps {
  documentId: string;
  /** ws://gateway/ws */
  gatewayUrl: string;
  /** JWT issued by /api/sync-token. */
  token: string;
  /** Optional callback for parent UI (mode badge, agent panel, etc.) */
  onModeChange?: (mode: ConnectionMode) => void;
  onRejected?: (reason: string) => void;
}

export function Editor(props: EditorProps): React.ReactElement {
  const [sync, setSync] = useState<SyncBundle | null>(null);
  const [mode, setMode] = useState<ConnectionMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onModeChangeRef = useRef(props.onModeChange);
  const onRejectedRef = useRef(props.onRejected);
  onModeChangeRef.current = props.onModeChange;
  onRejectedRef.current = props.onRejected;

  useEffect(() => {
    let cancelled = false;
    const bundle = setupSync({
      url: props.gatewayUrl,
      documentId: props.documentId,
      token: props.token,
    });

    const off = bundle.transport.on((e) => {
      if (cancelled) return;
      switch (e.type) {
        case 'open':
        case 'mode-changed':
          setMode(e.mode);
          onModeChangeRef.current?.(e.mode);
          break;
        case 'rejected':
          onRejectedRef.current?.(e.reason);
          break;
        case 'error':
          setError(e.error.message);
          break;
        case 'close':
          if (e.code !== 1000) {
            setError(`gateway closed (code ${e.code}: ${e.reason})`);
          }
          break;
      }
    });

    setSync(bundle);

    return () => {
      cancelled = true;
      off();
      bundle.destroy();
    };
  }, [props.gatewayUrl, props.documentId, props.token]);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        编辑器连接错误：{error}
      </div>
    );
  }

  if (!sync) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        加载中…
      </div>
    );
  }

  return (
    <EditorMounted
      sync={sync}
      mode={mode}
      readOnly={mode === 'reader'}
    />
  );
}

interface EditorMountedProps {
  sync: SyncBundle;
  mode: ConnectionMode | null;
  readOnly: boolean;
}

function EditorMounted({
  sync,
  mode,
  readOnly,
}: EditorMountedProps): React.ReactElement {
  const editor: TipTapEditor | null = useEditor(
    {
      extensions: [
        ...PAPER_SCHEMA_EXTENSIONS,
        Collaboration.configure({ document: sync.ydoc }),
      ],
      editable: !readOnly,
      // ProseMirror checks for `document` at construction time; keep this
      // false to defer to client mount only (Next.js SSR safety).
      immediatelyRender: false,
    },
    [sync.ydoc, readOnly],
  );

  if (!editor) return <div className="h-32" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-zinc-500">
        connection mode:{' '}
        <strong>{mode ?? '…'}</strong>
        {readOnly && ' · 只读 (read-only)'}
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-zinc min-h-[60vh] max-w-none rounded-md border border-zinc-200 bg-white p-6 focus:outline-none"
      />
    </div>
  );
}
