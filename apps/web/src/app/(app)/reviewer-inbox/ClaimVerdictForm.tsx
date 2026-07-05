'use client';

// Phase 5 Wave B B5 — one-click verdict form for the Reviewer Inbox.
//
// The reviewer picks a verdict, fills the body markdown + optional
// evidence ref list, hits submit. On 201 we trigger the sign step if
// the caller has linked ORCID; on 4xx we surface the structured error
// reason from the service-layer validator.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/design';
import { ReviewLifecycleActions } from '@/components/review/ReviewLifecycleActions';

export interface ClaimVerdictFormProps {
  claimId: string;
  hasExistingCallerVerdict: boolean;
  existingReview?: {
    reviewId: string;
    isSigned: boolean;
  } | null;
}

type Verdict = 'endorses' | 'challenges' | 'refines';

const VERDICT_OPTIONS: Array<{
  value: Verdict;
  zh: string;
  en: string;
}> = [
  { value: 'endorses', zh: '同意', en: 'Endorse' },
  { value: 'refines', zh: '收窄', en: 'Refine' },
  { value: 'challenges', zh: '挑战', en: 'Challenge' },
];

export function ClaimVerdictForm({
  claimId,
  hasExistingCallerVerdict,
  existingReview = null,
}: ClaimVerdictFormProps) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<Verdict>('endorses');
  const [body, setBody] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [submittedReviewId, setSubmittedReviewId] = useState<string | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (hasExistingCallerVerdict) {
    // Already verdicted — UI nudges the reviewer to lineage page rather
    // than offering a second submit (withdraw + resubmit is the only
    // edit path per ADR-0016 §2.4).
    return (
      <div>
        <p>
          <small>
            <em>
              <span lang="zh">你已对该 claim 出过判断；可去 lineage 查看完整血统</span>
              <span aria-hidden="true"> · </span>
              <span lang="en">
                You already verdicted; inspect the full lineage
              </span>
            </em>
          </small>
        </p>
        <br />
        <Link
          href={`/claim/${encodeURIComponent(claimId)}/lineage`}
          className="text-sm underline-offset-4 hover:underline"
        >
          lineage · 评审血统
        </Link>
        {existingReview ? (
          <ReviewLifecycleActions
            claimId={claimId}
            reviewId={existingReview.reviewId}
            canSign={!existingReview.isSigned}
            canWithdraw
            initiallySigned={existingReview.isSigned}
          />
        ) : null}
      </div>
    );
  }

  if (submittedReviewId) {
    return (
      <div>
        <p>
          <small>
            <span lang="zh">已提交，可继续 ORCID 签名或撤回</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">Submitted — ORCID sign or withdraw next</span>
          </small>
        </p>
        <ReviewLifecycleActions
          claimId={claimId}
          reviewId={submittedReviewId}
          canSign
          canWithdraw
        />
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const evidenceRefs = evidenceText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/claim/${encodeURIComponent(claimId)}/review`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verdict,
              bodyMarkdown: body,
              evidenceRefs,
              isAiVerdict: false,
            }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          reviewId?: unknown;
        };
        if (typeof data.reviewId !== 'string') {
          setError('missing-review-id');
          return;
        }
        setSubmittedReviewId(data.reviewId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <form className="reviewer-inbox-form" onSubmit={onSubmit}>
      <fieldset>
        <legend>
          <span lang="zh">verdict</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Verdict</span>
        </legend>
        {VERDICT_OPTIONS.map((opt) => (
          <label key={opt.value}>
            <input
              type="radio"
              name={`verdict-${claimId}`}
              value={opt.value}
              checked={verdict === opt.value}
              onChange={() => setVerdict(opt.value)}
            />
            <span lang="zh">{opt.zh}</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">{opt.en}</span>
          </label>
        ))}
      </fieldset>

      <label>
        <span lang="zh">论述（必填）</span>
        <span aria-hidden="true"> · </span>
        <span lang="en">Reasoning (required)</span>
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          aria-label="reasoning body"
        />
      </label>

      <label>
        <span lang="zh">
          引用 evidence id（空白/逗号分隔，挑战 verdict 必填）
        </span>
        <span aria-hidden="true"> · </span>
        <span lang="en">
          Evidence ids (space/comma separated; required for challenges)
        </span>
        <input
          type="text"
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          aria-label="evidence refs"
        />
      </label>

      {error ? (
        <p role="alert">
          <small>
            <span lang="zh">提交失败：{error}</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">Submit failed: {error}</span>
          </small>
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? (
          <>
            <span lang="zh">提交中…</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">Submitting…</span>
          </>
        ) : (
          <>
            <span lang="zh">提交 verdict</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">Submit verdict</span>
          </>
        )}
      </Button>
    </form>
  );
}
