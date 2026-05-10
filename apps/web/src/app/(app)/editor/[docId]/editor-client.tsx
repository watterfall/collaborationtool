'use client';

import { useEffect, useState } from 'react';

import { Editor } from '@collaborationtool/editor-core';

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
    <Editor
      documentId={documentId}
      gatewayUrl={bundle.gatewayUrl}
      token={bundle.token}
      seedContent={seedContent}
    />
  );
}
