'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/design';

export interface ReviewLifecycleActionsProps {
  claimId: string;
  reviewId: string;
  canSign: boolean;
  canWithdraw: boolean;
  initiallySigned?: boolean;
}

export function ReviewLifecycleActions({
  claimId,
  reviewId,
  canSign,
  canWithdraw,
  initiallySigned = false,
}: ReviewLifecycleActionsProps) {
  const router = useRouter();
  const [signed, setSigned] = useState(initiallySigned);
  const [withdrawn, setWithdrawn] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sign = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await postReviewAction(
        claimId,
        reviewId,
        'sign',
        {},
      );
      if (!res.ok) {
        setError(reviewActionErrorCopy(res.error));
        return;
      }
      setSigned(true);
      setNotice('ORCID signature saved · ORCID 签名已保存');
      router.refresh();
    });
  };

  const withdraw = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await postReviewAction(
        claimId,
        reviewId,
        'withdraw',
        { reason },
      );
      if (!res.ok) {
        setError(reviewActionErrorCopy(res.error));
        return;
      }
      setWithdrawn(true);
      setNotice('Verdict withdrawn · verdict 已撤回');
      router.refresh();
    });
  };

  if (withdrawn) {
    return (
      <p className="mt-2 font-serif text-[12px] italic">
        Verdict withdrawn · verdict 已撤回
      </p>
    );
  }

  return (
    <div
      className="mt-3 grid gap-2"
      data-testid="review-lifecycle-actions"
      style={{
        borderTop: '1px dashed var(--color-hairline)',
        paddingTop: '10px',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {canSign && !signed ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={sign}
            disabled={pending}
          >
            ORCID sign · ORCID 签名
          </Button>
        ) : null}
        {signed ? (
          <p
            className="font-serif text-[12px] italic"
            style={{ color: 'var(--color-accent-moss)' }}
          >
            ORCID-signed · 已 ORCID 签名
          </p>
        ) : null}
      </div>

      {canWithdraw ? (
        <details>
          <summary
            className="font-sans text-[12px]"
            style={{ color: 'var(--color-ink-2)', cursor: 'pointer' }}
          >
            withdraw verdict · 撤回 verdict
          </summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="grid gap-1">
              <span
                className="font-sans text-[11px]"
                style={{ color: 'var(--color-ink-3)' }}
              >
                reason · 理由
              </span>
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Scope changed after new evidence"
                style={{
                  height: '32px',
                  minWidth: '260px',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '13px',
                  color: 'var(--color-ink)',
                  background: 'var(--color-paper)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-1)',
                  padding: '0 9px',
                }}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={withdraw}
              disabled={pending || reason.trim().length === 0}
            >
              Withdraw · 撤回
            </Button>
          </div>
        </details>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="font-serif text-[12px] italic"
          style={{ color: 'var(--color-accent-moss)' }}
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="font-serif text-[12px] italic"
          style={{ color: 'var(--color-accent-ox)' }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function postReviewAction(
  claimId: string,
  reviewId: string,
  action: 'sign' | 'withdraw',
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `/api/claim/${encodeURIComponent(claimId)}/review/${encodeURIComponent(reviewId)}/${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as {
      error?: unknown;
    };
    return {
      ok: false,
      error: typeof data.error === 'string' ? data.error : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function reviewActionErrorCopy(error: string): string {
  switch (error) {
    case 'no-orcid-linked':
      return '请先用 ORCID 登录，再签名 verdict · Sign in with ORCID first.';
    case 'empty-jws':
      return 'ORCID session 缺少 id_token，请重新用 ORCID 登录 · ORCID id_token missing.';
    case 'already-signed':
      return '这条 verdict 已经签名 · Verdict already signed.';
    case 'withdrawn':
    case 'already-withdrawn':
      return '这条 verdict 已撤回 · Verdict already withdrawn.';
    case 'empty-reason':
      return '撤回需要填写理由 · Withdrawal reason required.';
    case 'unauthorized':
      return '只能操作自己的 verdict · You can only update your own verdict.';
    default:
      return `Review action failed: ${error}`;
  }
}

export default ReviewLifecycleActions;
