'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { signIn } from '@/lib/auth-client';
import OrcidSignIn from '@/components/orcid-sign-in';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/docs';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await signIn.email({ email, password });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? 'Sign in failed');
      return;
    }
    // `next` defaults to /docs but lets the invite flow redirect back.
    router.push(next.startsWith('/') ? next : '/docs');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header>
        <h1 className="text-3xl font-medium">登录 · Sign in</h1>
        <p className="mt-2 text-sm text-zinc-500">
          继续编辑你的论文。
        </p>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">邮箱 / Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">密码 / Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
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
          {pending ? '...' : '登录 / Sign in'}
        </button>
      </form>
      <OrcidSignIn />
      <p className="text-sm text-zinc-600">
        还没有账户？{' '}
        <Link href="/signup" className="underline">
          注册 / Sign up
        </Link>
      </p>
    </main>
  );
}
