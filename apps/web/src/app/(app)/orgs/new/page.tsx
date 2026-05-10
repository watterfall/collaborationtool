'use client';

// Phase 4 W10.7 — refactored to Design.md tokens. The previous form used
// `bg-zinc-900` submit + `rounded-md border-zinc-300` inputs. We now go
// through the SoT `<Button>` and inline editorial input styles so this
// surface matches Design.md §6.5 (orgs/new shares chrome with docs list).

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, HairlineRule } from '@/components/design';
import { authClient } from '@/lib/auth-client';

const FIELD_STYLE = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  padding: '8px 12px',
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--radius-1)',
} as const;

export default function NewOrgPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await authClient.organization.create({ name, slug });

    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Create org failed');
      return;
    }

    // Tell our backend bridge to create the org Principal + ACL link.
    // better-auth doesn't (yet) expose an organization databaseHook in
    // the Drizzle adapter; we call our own server action.
    const orgId = res.data?.id;
    if (orgId) {
      const bridgeRes = await fetch('/api/orgs/bridge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, name }),
      });
      if (!bridgeRes.ok) {
        setError('Org bridge failed (check server logs)');
        return;
      }
    }

    router.push('/docs');
    router.refresh();
  }

  return (
    <div
      className="mx-auto max-w-xl px-6 py-10"
      style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}
    >
      <header className="mb-6">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '30px',
            fontWeight: 500,
            letterSpacing: '-0.005em',
          }}
        >
          新组织 · New organization
        </h1>
        <HairlineRule className="mt-3" />
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span
            className="label-cap"
            style={{ color: 'var(--color-ink-3)' }}
          >
            NAME · 名称
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={FIELD_STYLE}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span
            className="label-cap"
            style={{ color: 'var(--color-ink-3)' }}
          >
            SLUG
          </span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            pattern="[a-z0-9-]+"
            style={FIELD_STYLE}
          />
        </label>
        {error && (
          <p
            role="alert"
            style={{
              borderLeft: '2px solid var(--color-accent-ox)',
              paddingLeft: '10px',
              fontStyle: 'italic',
              color: 'var(--color-accent-ox)',
              fontSize: '13px',
            }}
          >
            {error}
          </p>
        )}
        <Button
          variant="primary"
          size="md"
          type="submit"
          disabled={pending}
          className="self-start"
        >
          {pending ? '...' : '创建 · Create'}
        </Button>
      </form>
    </div>
  );
}
