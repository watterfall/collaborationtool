'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-medium">新组织 · New organization</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">名称 / Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            pattern="[a-z0-9-]+"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </label>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? '...' : '创建 / Create'}
        </button>
      </form>
    </div>
  );
}
