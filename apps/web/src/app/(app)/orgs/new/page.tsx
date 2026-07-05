'use client';

// Design.md v2 Phase 3 — adopts the shared design-system primitives
// (PageShell / PageHeader / Field / TextInput / form-banner-error) in place
// of the local FIELD_STYLE const. orgs/new shares chrome with docs list
// (Design.md §6.5).

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Button,
  Field,
  PageHeader,
  PageShell,
  TextInput,
} from '@/components/design';
import { authClient } from '@/lib/auth-client';

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
    <PageShell width="prose">
      <PageHeader title="新组织" titleEn="New organization" />
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="NAME · 名称" htmlFor="org-name" required>
          <TextInput
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="SLUG" htmlFor="org-slug" required>
          <TextInput
            id="org-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            pattern="[a-z0-9-]+"
          />
        </Field>
        {error ? (
          <p className="form-banner-error" role="alert">
            {error}
          </p>
        ) : null}
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
    </PageShell>
  );
}
