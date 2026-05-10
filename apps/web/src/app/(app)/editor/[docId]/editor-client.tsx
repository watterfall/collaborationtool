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
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        无法获取同步 token：{error}
      </div>
    );
  }
  if (!bundle) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        准备中…
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
      <p className="mt-1 text-[11px] text-zinc-500">
        提示：把光标放进段落或选中文字后按 <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[10px]">⌘K</kbd>
        {' / '}
        <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[10px]">Ctrl K</kbd>{' '}
        召出 AI 协作菜单。 / Press ⌘K (Mac) or Ctrl-K to invoke the AI agent
        menu on the current selection.
      </p>
      <InlineAgentMenu editor={editor} documentId={documentId} />
    </>
  );
}
