'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AcceptClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitation/${invitationId}/accept`, {
        method: 'POST',
      });
      const data = (await res.json()) as {
        documentId?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(
          data.detail ?? data.error ?? `HTTP ${res.status}`,
        );
        setPending(false);
        return;
      }
      if (data.documentId) {
        router.push(`/editor/${data.documentId}`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <button
        type="button"
        onClick={onAccept}
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? '...' : '接受 / Accept'}
      </button>
      {error && (
        <p className="text-red-700" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        如果当前登录的邮箱与受邀邮箱不一致，请先登出后用受邀邮箱重新登录。
      </p>
    </div>
  );
}
