'use client';

import * as React from 'react';

type Verdict = 'endorses' | 'refines' | 'challenges';

const VERDICTS: Array<{ value: Verdict; label: string }> = [
  { value: 'endorses', label: 'Endorse · 支持' },
  { value: 'refines', label: 'Refine · 修正' },
  { value: 'challenges', label: 'Challenge · 质疑' },
];

export function AnswerOpenQuestionForm({ questionId }: { questionId: string }) {
  const [verdict, setVerdict] = React.useState<Verdict>('refines');
  const [bodyMd, setBodyMd] = React.useState('');
  const [evidenceRefs, setEvidenceRefs] = React.useState('');
  const [status, setStatus] = React.useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');
  const [message, setMessage] = React.useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');
    const refs = evidenceRefs
      .split(/[,\n]/)
      .map((ref) => ref.trim())
      .filter(Boolean);

    const response = await fetch(`/api/open-question/${questionId}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        verdict,
        bodyMd,
        evidenceRefs: refs,
      }),
    });
    if (response.ok) {
      setStatus('submitted');
      setBodyMd('');
      setEvidenceRefs('');
      setMessage('Response published · 回应已发布');
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    setStatus('error');
    setMessage(payload?.detail ?? payload?.error ?? 'submit-failed');
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 border-y py-6"
      style={{ borderColor: 'var(--color-hairline)' }}
    >
      <div className="flex flex-col gap-2">
        <p className="label-cap">answer with ORCID</p>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Verdict">
          {VERDICTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setVerdict(option.value)}
              className="border px-3 py-2 font-sans text-sm"
              style={{
                borderColor:
                  verdict === option.value
                    ? 'var(--color-pencil)'
                    : 'var(--color-hairline)',
                background:
                  verdict === option.value
                    ? 'var(--color-paper-2)'
                    : 'transparent',
                color: 'var(--color-ink)',
              }}
              aria-pressed={verdict === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="label-cap">response</span>
        <textarea
          value={bodyMd}
          onChange={(event) => setBodyMd(event.target.value)}
          required
          minLength={2}
          rows={6}
          className="w-full resize-y border bg-transparent p-3 font-serif text-[15px] leading-[1.65] outline-none"
          style={{
            borderColor: 'var(--color-hairline)',
            color: 'var(--color-ink)',
          }}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="label-cap">evidence refs</span>
        <input
          value={evidenceRefs}
          onChange={(event) => setEvidenceRefs(event.target.value)}
          className="w-full border bg-transparent px-3 py-2 font-mono text-xs outline-none"
          style={{
            borderColor: 'var(--color-hairline)',
            color: 'var(--color-ink)',
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn-primary"
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Publishing...' : 'Publish response'}
        </button>
        {message ? (
          <p
            className="font-sans text-sm"
            style={{
              color:
                status === 'error'
                  ? 'var(--color-accent-ox)'
                  : 'var(--color-accent-moss)',
            }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
