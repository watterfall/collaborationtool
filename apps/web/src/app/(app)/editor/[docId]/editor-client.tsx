'use client';

import { useEffect, useState } from 'react';

import { Editor, type TipTapEditor } from '@collaborationtool/editor-core';

import InlineAgentMenu from './components/InlineAgentMenu';

interface EditorClientProps {
  documentId: string;
}

interface SyncTokenResponse {
  token: string;
  gatewayUrl: string;
  expectedMode: 'reader' | 'proposer' | 'writer';
}

interface TemplateSeedResponse {
  templateId: string;
  content: unknown;
}

export default function EditorClient({ documentId }: EditorClientProps) {
  const [bundle, setBundle] = useState<SyncTokenResponse | null>(null);
  const [seedContent, setSeedContent] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<TipTapEditor | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [tokenRes, seedRes] = await Promise.all([
          fetch('/api/sync-token', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ documentId }),
          }),
          fetch(`/api/document/${documentId}/template-content`),
        ]);
        if (!tokenRes.ok) {
          const payload = (await tokenRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? `HTTP ${tokenRes.status}`);
        }
        const data = (await tokenRes.json()) as SyncTokenResponse;
        if (!cancelled) setBundle(data);

        // 204 = no template to seed (already claimed or never had one).
        if (seedRes.status === 200) {
          const payload = (await seedRes.json()) as TemplateSeedResponse;
          if (!cancelled && payload.content) {
            setSeedContent(payload.content);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (error) {
    return (
      <div
        role="alert"
        style={{
          borderLeft: '2px solid var(--color-accent-ox)',
          padding: '10px 14px',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: '14px',
          color: 'var(--color-accent-ox)',
        }}
      >
        无法获取同步 token：{error}
      </div>
    );
  }
  if (!bundle) {
    return (
      <div
        style={{
          borderTop: '1px solid var(--color-hairline)',
          borderBottom: '1px solid var(--color-hairline)',
          padding: '14px 0',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: '13px',
          color: 'var(--color-ink-3)',
        }}
      >
        准备中… · Loading
      </div>
    );
  }

  return (
    <>
      <Editor
        documentId={documentId}
        gatewayUrl={bundle.gatewayUrl}
        token={bundle.token}
        seedContent={seedContent}
        onEditorReady={setEditor}
      />
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '11px',
          color: 'var(--color-ink-3)',
          marginTop: '4px',
        }}
      >
        提示：把光标放进段落或选中文字后按{' '}
        <kbd
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            padding: '0 4px',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-1)',
            background: 'var(--color-paper-2)',
          }}
        >
          ⌘K
        </kbd>
        {' / '}
        <kbd
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            padding: '0 4px',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-1)',
            background: 'var(--color-paper-2)',
          }}
        >
          Ctrl K
        </kbd>{' '}
        召出 AI 协作菜单。 / Press ⌘K (Mac) or Ctrl-K to invoke the AI agent
        menu on the current selection.
      </p>
      <InlineAgentMenu editor={editor} documentId={documentId} />
    </>
  );
}
