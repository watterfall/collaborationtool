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

export default function EditorClient({ documentId }: EditorClientProps) {
  const [bundle, setBundle] = useState<SyncTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/sync-token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ documentId }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as SyncTokenResponse;
        if (!cancelled) setBundle(data);
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
    />
  );
}
