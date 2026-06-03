'use client';

import { useState } from 'react';

import type { TipTapEditor } from '@collaborationtool/editor-core';

import { Button, HairlineRule, StatusPill } from '@/components/design';

type PublishMode = 'question' | 'dataset' | 'snapshot';
type PublishState = 'idle' | 'publishing' | 'published' | 'error';

interface PublishResult {
  href: string;
  merkleLogEntryId: string;
  questionId?: string;
  datasetId?: string;
  snapshotId?: string;
  permalinkHash?: string;
}

export default function OpenLedgerPublishPanel({
  documentId,
  editor,
}: {
  documentId: string;
  editor: TipTapEditor | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PublishMode>('question');
  const [state, setState] = useState<PublishState>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<PublishResult | null>(null);

  const [questionMd, setQuestionMd] = useState('');
  const [domainTags, setDomainTags] = useState('');

  const [datasetTitle, setDatasetTitle] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');
  const [datasetRef, setDatasetRef] = useState('');
  const [datasetSizeBytes, setDatasetSizeBytes] = useState('0');
  const [datasetLicense, setDatasetLicense] = useState('CC0-1.0');
  const [datasetDoi, setDatasetDoi] = useState('');

  const [snapshotKind, setSnapshotKind] =
    useState<'section' | 'preprint' | 'dataset'>('preprint');
  const [snapshotMarkdown, setSnapshotMarkdown] = useState('');
  const [snapshotArchiveBase64, setSnapshotArchiveBase64] = useState('');
  const [snapshotDoi, setSnapshotDoi] = useState('');

  if (!open) {
    return (
      <div className="my-4">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          开放账本 · Open ledger
        </Button>
      </div>
    );
  }

  async function submitJson(endpoint: string, body: Record<string, unknown>) {
    setState('publishing');
    setMessage('');
    setResult(null);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | (Partial<PublishResult> & { error?: string; detail?: string })
      | null;
    if (response.ok && payload?.href && payload.merkleLogEntryId) {
      setState('published');
      setResult(payload as PublishResult);
      return true;
    }
    setState('error');
    setMessage(payload?.detail ?? payload?.error ?? `HTTP ${response.status}`);
    return false;
  }

  async function publishQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tags = domainTags
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const ok = await submitJson(`/api/document/${documentId}/open-question`, {
      questionMd,
      domainTags: tags,
    });
    if (ok) {
      setQuestionMd('');
      setDomainTags('');
    }
  }

  async function publishDataset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submitJson(`/api/document/${documentId}/open-dataset`, {
      title: datasetTitle,
      descriptionMd: datasetDescription,
      blobStorageRef: datasetRef,
      sizeBytes: Number(datasetSizeBytes),
      licenseSpdx: datasetLicense,
      datasetDoi,
    });
    if (ok) {
      setDatasetTitle('');
      setDatasetDescription('');
      setDatasetRef('');
      setDatasetSizeBytes('0');
      setDatasetDoi('');
    }
  }

  async function publishSnapshot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const archive = snapshotArchiveBase64 || buildSnapshotArchiveBase64();
    if (!archive) {
      setState('error');
      setMessage('editor-not-ready');
      return;
    }
    const ok = await submitJson(`/api/document/${documentId}/share-snapshot`, {
      markdownContent: snapshotMarkdown,
      kind: snapshotKind,
      pmJsonArchiveBase64: archive,
      doi: snapshotDoi,
    });
    if (ok) {
      setSnapshotMarkdown('');
      setSnapshotArchiveBase64('');
      setSnapshotDoi('');
    }
  }

  function refreshSnapshotFromEditor() {
    const archive = buildSnapshotArchiveBase64();
    if (!archive || !editor) {
      setState('error');
      setMessage('editor-not-ready');
      return;
    }
    setSnapshotArchiveBase64(archive);
    setSnapshotMarkdown(pmDocToMarkdown(editor.getJSON()));
    setState('idle');
    setMessage('');
  }

  function buildSnapshotArchiveBase64(): string {
    if (!editor) return '';
    return toBase64Utf8(
      JSON.stringify({
        format: 'pm-json',
        documentId,
        capturedAt: new Date().toISOString(),
        content: editor.getJSON(),
      }),
    );
  }

  function selectMode(nextMode: PublishMode) {
    setMode(nextMode);
    setState('idle');
    setMessage('');
    setResult(null);
  }

  return (
    <section
      className="my-5"
      style={{
        background: 'var(--color-paper)',
        borderTop: '1px solid var(--color-hairline)',
        borderBottom: '1px solid var(--color-hairline)',
        padding: '16px 0',
        fontSize: '13px',
      }}
      data-testid="open-ledger-publish-panel"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[34rem]">
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '18px',
              fontWeight: 500,
              color: 'var(--color-ink)',
            }}
          >
            开放协作账本 · Open collaboration ledger
          </h2>
          <p
            className="mt-1 font-serif text-[13px] italic leading-[1.55]"
            style={{ color: 'var(--color-ink-2)' }}
          >
            把问题、可复核资产或稿件快照发布成可签名、可审查的公开记录。
          </p>
        </div>
        <Button
          variant="link"
          size="sm"
          onClick={() => setOpen(false)}
          ariaLabel="收起开放账本面板"
          ariaLabelEn="Close open ledger panel"
        >
          收起 ×
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        <ModeButton active={mode === 'question'} onClick={() => selectMode('question')}>
          问题 · Question
        </ModeButton>
        <ModeButton active={mode === 'dataset'} onClick={() => selectMode('dataset')}>
          数据集 · Dataset
        </ModeButton>
        <ModeButton active={mode === 'snapshot'} onClick={() => selectMode('snapshot')}>
          快照 · Snapshot
        </ModeButton>
      </div>
      <HairlineRule />

      {mode === 'question' && (
        <form onSubmit={publishQuestion} className="mt-3 flex flex-col gap-3">
          <LedgerTextarea
            label="QUESTION · 问题"
            value={questionMd}
            onChange={setQuestionMd}
            rows={5}
            required
          />
          <LedgerInput
            label="TAGS · 领域标签"
            value={domainTags}
            onChange={setDomainTags}
            placeholder="reproducibility, methods"
            mono
          />
          <SubmitRow
            state={state}
            result={result}
            message={message}
            idleLabel="发布开放问题 · Publish question"
          />
        </form>
      )}

      {mode === 'dataset' && (
        <form onSubmit={publishDataset} className="mt-3 grid gap-3">
          <LedgerInput
            label="TITLE · 标题"
            value={datasetTitle}
            onChange={setDatasetTitle}
            required
          />
          <LedgerTextarea
            label="DESCRIPTION · 复核说明"
            value={datasetDescription}
            onChange={setDatasetDescription}
            rows={4}
            required
          />
          <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.8fr]">
            <LedgerInput
              label="BLOB / DOI / URL · 资产位置"
              value={datasetRef}
              onChange={setDatasetRef}
              placeholder="s3://vault/cohort.csv or https://..."
              required
              mono
            />
            <LedgerInput
              label="BYTES · 字节数"
              value={datasetSizeBytes}
              onChange={setDatasetSizeBytes}
              type="number"
              min="0"
              required
              mono
            />
            <LedgerInput
              label="LICENSE · 许可证"
              value={datasetLicense}
              onChange={setDatasetLicense}
              required
              mono
            />
          </div>
          <LedgerInput
            label="DOI · 可选"
            value={datasetDoi}
            onChange={setDatasetDoi}
            placeholder="10.5281/zenodo..."
            mono
          />
          <SubmitRow
            state={state}
            result={result}
            message={message}
            idleLabel="发布可复核资产 · Publish dataset"
          />
        </form>
      )}

      {mode === 'snapshot' && (
        <form onSubmit={publishSnapshot} className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[12rem] flex-col gap-1">
              <span className="label-cap" style={{ color: 'var(--color-ink-3)' }}>
                KIND · 快照类型
              </span>
              <select
                value={snapshotKind}
                onChange={(event) =>
                  setSnapshotKind(
                    event.target.value as 'section' | 'preprint' | 'dataset',
                  )
                }
                style={controlStyle(false)}
              >
                <option value="preprint">preprint</option>
                <option value="section">section</option>
                <option value="dataset">dataset</option>
              </select>
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshSnapshotFromEditor}
              disabled={!editor}
            >
              从当前稿件刷新 · Refresh from editor
            </Button>
          </div>
          <LedgerTextarea
            label="PUBLIC MARKDOWN · 公开预览"
            value={snapshotMarkdown}
            onChange={setSnapshotMarkdown}
            rows={7}
            required
          />
          <LedgerInput
            label="DOI · 可选"
            value={snapshotDoi}
            onChange={setSnapshotDoi}
            placeholder="10.1101/..."
            mono
          />
          <SubmitRow
            state={state}
            result={result}
            message={message}
            idleLabel="发布可引用快照 · Publish snapshot"
          />
        </form>
      )}
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        border: '1px solid var(--color-hairline)',
        borderBottomColor: active ? 'var(--color-ink)' : 'var(--color-hairline)',
        background: active ? 'var(--color-paper-2)' : 'var(--color-paper)',
        color: 'var(--color-ink)',
        padding: '7px 10px',
        fontFamily: 'var(--font-serif)',
        fontSize: '13px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function LedgerInput({
  label,
  value,
  onChange,
  mono,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-cap" style={{ color: 'var(--color-ink-3)' }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={controlStyle(Boolean(mono))}
        {...rest}
      />
    </label>
  );
}

function LedgerTextarea({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-cap" style={{ color: 'var(--color-ink-3)' }}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="resize-y"
        style={{
          ...controlStyle(false),
          fontFamily: 'var(--font-serif)',
          lineHeight: 1.65,
        }}
        {...rest}
      />
    </label>
  );
}

function SubmitRow({
  state,
  result,
  message,
  idleLabel,
}: {
  state: PublishState;
  result: PublishResult | null;
  message: string;
  idleLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {state === 'published' && result ? (
        <div
          className="flex flex-col gap-2"
          style={{
            borderLeft: '2px solid var(--color-accent-moss)',
            padding: '10px 12px',
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              status="applied"
              label="已进入开放账本"
              labelEn="Published to ledger"
            />
            <a href={result.href} target="_blank" rel="noreferrer" className="btn-link">
              打开公开记录 · Open record
            </a>
          </div>
          <code
            className="break-all font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            merkle {result.merkleLogEntryId}
          </code>
        </div>
      ) : null}

      {state === 'error' && message ? (
        <p
          role="alert"
          style={{
            color: 'var(--color-accent-ox)',
            borderLeft: '2px solid var(--color-accent-ox)',
            paddingLeft: '10px',
            fontStyle: 'italic',
            fontSize: '12px',
          }}
        >
          {message}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="sm"
        type="submit"
        disabled={state === 'publishing'}
        className="self-start"
      >
        {state === 'publishing' ? '发布中...' : idleLabel}
      </Button>
    </div>
  );
}

function controlStyle(mono: boolean): React.CSSProperties {
  return {
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-serif)',
    fontSize: mono ? '12px' : '14px',
    padding: '8px 10px',
    background: 'var(--color-paper)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-hairline)',
    borderRadius: 'var(--radius-1)',
  };
}

function pmDocToMarkdown(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const root = value as { content?: unknown[] };
  return (root.content ?? [])
    .map((node) => renderPmBlock(node))
    .filter((part) => part.trim().length > 0)
    .join('\n\n');
}

function renderPmBlock(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as {
    type?: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
    text?: string;
    marks?: Array<{ type?: string }>;
  };
  switch (node.type) {
    case 'heading': {
      const level =
        typeof node.attrs?.['level'] === 'number'
          ? Math.min(Math.max(node.attrs['level'], 1), 6)
          : 2;
      return `${'#'.repeat(level)} ${renderInlineChildren(node.content)}`.trim();
    }
    case 'paragraph':
      return renderInlineChildren(node.content);
    case 'blockquote':
      return (node.content ?? [])
        .map(renderPmBlock)
        .join('\n\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'bulletList':
      return renderList(node.content, '-');
    case 'orderedList':
      return renderList(node.content, '1.');
    case 'codeBlock':
      return ['```', renderInlineChildren(node.content), '```'].join('\n');
    default:
      return renderInlineChildren(node.content);
  }
}

function renderList(children: unknown[] | undefined, marker: string): string {
  return (children ?? [])
    .map((item) =>
      renderPmBlock(item)
        .split('\n')
        .map((line, index) => `${index === 0 ? marker : '  '} ${line}`)
        .join('\n'),
    )
    .join('\n');
}

function renderInlineChildren(children: unknown[] | undefined): string {
  return (children ?? []).map(renderInlineNode).join('');
}

function renderInlineNode(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as {
    type?: string;
    text?: string;
    content?: unknown[];
    marks?: Array<{ type?: string }>;
  };
  if (node.type === 'text') {
    let text = node.text ?? '';
    if (node.marks?.some((mark) => mark.type === 'code')) text = `\`${text}\``;
    if (node.marks?.some((mark) => mark.type === 'italic')) text = `*${text}*`;
    if (node.marks?.some((mark) => mark.type === 'bold')) text = `**${text}**`;
    return text;
  }
  if (node.type === 'hardBreak') return '\n';
  return renderInlineChildren(node.content);
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}
