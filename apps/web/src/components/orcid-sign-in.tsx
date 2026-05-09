'use client';

// Phase 1.5 #2 — ORCID sign-in button. Renders only when the server
// advertised the provider via NEXT_PUBLIC_ORCID_ENABLED=true. The
// callback target after auth lives at /docs (same as email login).

import { useState, type ReactElement } from 'react';

import { ORCID_ENABLED, authClient } from '@/lib/auth-client';

export default function OrcidSignIn(): ReactElement | null {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!ORCID_ENABLED) return null;

  async function onClick() {
    setPending(true);
    setErr(null);
    try {
      // genericOAuth sign-in: redirects the browser to ORCID's authorize
      // URL; the callback URL is wired by better-auth at
      // /api/auth/oauth2/callback/orcid.
      const result = await authClient.signIn.oauth2({
        providerId: 'orcid',
        callbackURL: '/docs',
      });
      if (result?.error) {
        setErr(result.error.message ?? 'ORCID 登录失败');
        setPending(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="my-2 flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        <span>或 / or</span>
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-md border border-[#a6ce39] bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-[#f7fbe6] disabled:opacity-50"
      >
        <span aria-hidden className="font-bold text-[#a6ce39]">iD</span>
        <span>{pending ? '...' : '用 ORCID 登录 / Sign in with ORCID'}</span>
      </button>
      {err && (
        <p className="text-sm text-red-700" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
