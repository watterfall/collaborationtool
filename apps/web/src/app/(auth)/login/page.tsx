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

  const inputStyle = {
    background: 'var(--color-paper)',
    color: 'var(--color-ink)',
    border: '1.25px solid var(--color-pencil)',
    borderRadius: 'var(--radius-1)',
    padding: '8px 12px',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    lineHeight: '1.4',
    outline: 'none',
  } as const;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header>
        <p className="label-cap mb-2">登录 · sign in</p>
        <h1
          className="font-serif text-4xl font-medium leading-[1.15]"
          style={{
            color: 'var(--color-ink)',
            letterSpacing: '-0.01em',
          }}
        >
          继续编辑{' '}
          <span
            className="italic"
            style={{ color: 'var(--color-ink-2)', fontWeight: 400 }}
          >
            · keep writing
          </span>
        </h1>
      </header>
      <OrcidSignIn />
      <div className="flex items-center gap-3">
        <hr className="rule flex-1" />
        <span className="label-cap">or 邮箱</span>
        <hr className="rule flex-1" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span
            className="font-sans text-xs"
            style={{ color: 'var(--color-ink-2)' }}
          >
            邮箱 · Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span
            className="font-sans text-xs"
            style={{ color: 'var(--color-ink-2)' }}
          >
            密码 · Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={inputStyle}
          />
        </label>
        {error && (
          <p
            className="font-sans text-sm"
            role="alert"
            style={{ color: 'var(--color-accent-ox)' }}
          >
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? '...' : '登录 · Sign in'}
        </button>
      </form>
      <p
        className="font-sans text-sm"
        style={{ color: 'var(--color-ink-2)' }}
      >
        还没有账户？{' '}
        <Link
          href="/signup"
          className="underline underline-offset-4"
          style={{ color: 'var(--color-ink)' }}
        >
          注册 · Sign up
        </Link>
      </p>
    </main>
  );
}
