'use client';

// Phase 4 W10.7 — Design.md compliance refactor.

import { useState } from 'react';

import { Button, HairlineRule } from '@/components/design';

const FORMATS = [
  { id: 'html', label: 'HTML', mime: 'text/html', ext: 'html' },
  { id: 'jats', label: 'JATS XML', mime: 'application/xml', ext: 'jats.xml' },
  { id: 'markdown', label: 'Markdown', mime: 'text/markdown', ext: 'md' },
  { id: 'typst-source', label: 'Typst source', mime: 'text/plain', ext: 'typ' },
  { id: 'pdf', label: 'PDF (Typst)', mime: 'application/pdf', ext: 'pdf' },
  {
    id: 'docx',
    label: 'Word (.docx)',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  },
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '关闭导出 · Hide export' : '导出 · Export'}
      </Button>
      {open && (
        <div
          style={{
            marginTop: '12px',
            background: 'var(--color-paper)',
            border: '1px solid var(--color-hairline)',
            padding: '14px 16px',
            fontSize: '13px',
          }}
        >
          <h3
            className="label-cap"
            style={{ color: 'var(--color-ink-3)' }}
          >
            PICK A FORMAT · 选择格式
          </h3>
          <HairlineRule className="mt-2" />
          <ul
            style={{
              marginTop: '10px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              listStyle: 'none',
              padding: 0,
            }}
          >
            {FORMATS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => void downloadFormat(f.id)}
                  disabled={pending !== null}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--color-paper)',
                    color: 'var(--color-ink)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-1)',
                    padding: '10px 12px',
                    cursor: pending !== null ? 'not-allowed' : 'pointer',
                    opacity: pending !== null ? 0.55 : 1,
                    transition: 'border-color 120ms ease-out',
                  }}
                  className="export-format-button"
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {f.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-ink-3)',
                      marginTop: '2px',
                    }}
                  >
                    .{f.ext}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p
              role="alert"
              style={{
                marginTop: '10px',
                borderLeft: '2px solid var(--color-accent-ox)',
                paddingLeft: '10px',
                fontStyle: 'italic',
                fontSize: '12px',
                color: 'var(--color-accent-ox)',
              }}
            >
              {error}
            </p>
          )}
          <p
            style={{
              marginTop: '10px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              color: 'var(--color-ink-3)',
              fontStyle: 'italic',
              lineHeight: 1.6,
            }}
          >
            HTML / JATS / Markdown / Word 走 @collaborationtool/render-myst；
            Typst source / PDF 走 @collaborationtool/render-typst。PDF 需要服务器
            安装 typst CLI（&gt;= 0.14）。Word 是 Phase 1.5 加入。
          </p>
        </div>
      )}
    </div>
  );
}
