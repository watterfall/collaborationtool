'use client';

// Phase 4 W8.2 — ORCID sign-in button. Design.md §6.5 + §7 conformant:
// primary CTA when ORCID is configured, ghost-disabled when env is
// missing (so users see the option exists rather than getting a
// PROVIDER_CONFIG_NOT_FOUND blank). The 16px ORCID-green dot is the
// only place the brand green appears — Design.md §11 reject #1
// otherwise rules out high-saturation colours.

import { useState } from 'react';

import { ORCID_ENABLED, authClient } from '@/lib/auth-client';

export interface OrcidSignInProps {
  /** Where to land after a successful round-trip. Defaults to /docs. */
  callbackURL?: string;
  /** Force the disabled state in tests / storybook. */
  forceDisabled?: boolean;
}

const ORCID_GREEN = '#a6ce39';

/** Inline ORCID iD glyph — 16px disc + bold "iD" wordmark. The ORCID
 *  brand kit allows the green disc as a recognisability mark; this is
 *  the only place Design.md §11 reject #1 is intentionally relaxed. */
function OrcidGlyph({ disabled }: { disabled: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{
        width: 16,
        height: 16,
        borderRadius: '999px',
        background: disabled ? 'var(--color-paper-2)' : ORCID_GREEN,
        color: disabled ? 'var(--color-ink-3)' : '#fff',
        fontFamily: 'var(--font-sans)',
        fontWeight: 700,
        fontSize: 9,
        lineHeight: 1,
        flex: '0 0 auto',
      }}
    >
      iD
    </span>
  );
}

export default function OrcidSignIn(props: OrcidSignInProps = {}) {
  const { callbackURL = '/docs', forceDisabled = false } = props;
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const enabled = ORCID_ENABLED && !forceDisabled;

  async function onClick() {
    if (!enabled) return;
    setPending(true);
    setErr(null);
    try {
      // genericOAuth sign-in: redirects the browser to ORCID's authorize
      // URL; better-auth wires the callback to /api/auth/oauth2/callback/orcid.
      const result = await authClient.signIn.oauth2({
        providerId: 'orcid',
        callbackURL,
      });
      if (result?.error) {
        setErr(result.error.message ?? 'ORCID sign-in failed');
        setPending(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  }

  // Disabled state — env not configured. Show the affordance with a
  // helper line rather than hide; users with the option in mind get a
  // clear "ask the admin" path instead of a 500.
  if (!enabled) {
    return (
      <div className="flex flex-col gap-2" data-orcid-state="disabled">
        <button
          type="button"
          disabled
          aria-disabled
          className="btn-ghost"
          style={{ width: '100%', justifyContent: 'center', opacity: 0.55 }}
          data-testid="orcid-button"
        >
          <OrcidGlyph disabled />
          <span>用 ORCID 登录 · Continue with ORCID</span>
        </button>
        <p
          className="font-sans text-xs"
          style={{ color: 'var(--color-ink-3)', lineHeight: 1.5 }}
          data-testid="orcid-disabled-hint"
        >
          管理员未配置 ORCID 凭据 · ORCID credentials not configured
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-orcid-state="enabled">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="btn-primary"
        style={{
          width: '100%',
          justifyContent: 'center',
          background: 'var(--color-accent-ink)',
          color: 'var(--color-paper)',
        }}
        data-testid="orcid-button"
      >
        <OrcidGlyph disabled={false} />
        <span>{pending ? '...' : '用 ORCID 登录 · Continue with ORCID'}</span>
      </button>
      {err && (
        <p
          className="font-sans text-sm"
          role="alert"
          style={{ color: 'var(--color-accent-ox)' }}
        >
          {err}
        </p>
      )}
    </div>
  );
}
