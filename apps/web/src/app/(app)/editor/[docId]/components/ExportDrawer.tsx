'use client';

import { useState } from 'react';

const FORMATS = [
  { id: 'html', label: 'HTML', mime: 'text/html', ext: 'html' },
  { id: 'jats', label: 'JATS XML', mime: 'application/xml', ext: 'jats.xml' },
  { id: 'markdown', label: 'Markdown', mime: 'text/markdown', ext: 'md' },
  { id: 'typst-source', label: 'Typst source', mime: 'text/plain', ext: 'typ' },
  { id: 'pdf', label: 'PDF (Typst)', mime: 'application/pdf', ext: 'pdf' },
] as const;

type FormatId = (typeof FORMATS)[number]['id'];

export interface ExportDrawerProps {
  documentId: string;
  /** Optional inline PM JSON override — not yet wired in Phase 1 D12. */
  inlinePmJson?: unknown;
}

export default function ExportDrawer({
  documentId,
  inlinePmJson,
}: ExportDrawerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<FormatId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadFormat(format: FormatId) {
    setPending(format);
    setError(null);
    try {
      let url = `/api/export/${encodeURIComponent(documentId)}/${format}`;
      if (inlinePmJson !== undefined) {
        const b64 = typeof window !== 'undefined'
          ? window.btoa(unescape(encodeURIComponent(JSON.stringify(inlinePmJson))))
          : '';
        url += `?content=${encodeURIComponent(b64)}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        let body: { error?: string; hint?: string } = {};
        try {
          body = (await res.json()) as { error?: string; hint?: string };
        } catch {
          /* not JSON */
        }
        setError(body.hint ?? body.error ?? `HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const filenameMatch = /filename="([^"]+)"/.exec(
        res.headers.get('content-disposition') ?? '',
      );
      const filename = filenameMatch?.[1] ?? `document.${format}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="my-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
      >
        {open ? '关闭导出 / Hide export' : '导出 / Export'}
      </button>
      {open && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-4 text-sm">
          <h3 className="mb-2 text-base font-medium">选择格式 / Pick a format</h3>
          <ul className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => void downloadFormat(f.id)}
                  disabled={pending !== null}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-left hover:border-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <div className="font-medium">{f.label}</div>
                  <div className="text-xs text-zinc-500">.{f.ext}</div>
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            Phase 1 D12 — HTML / JATS / Markdown 走 @collaborationtool/render-myst；
            Typst source / PDF 走 @collaborationtool/render-typst。PDF 需要服务器
            安装 typst CLI（&gt;= 0.14）。
          </p>
        </div>
      )}
    </div>
  );
}
