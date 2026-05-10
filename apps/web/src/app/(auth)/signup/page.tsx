'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signUp } from '@/lib/auth-client';
import OrcidSignIn from '@/components/orcid-sign-in';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await signUp.email({
      email,
      password,
      name,
    });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? 'Sign up failed');
      return;
    }
    router.push('/docs');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header>
        <p className="label-cap mb-2">注册 · sign up</p>
        <h1
          className="font-serif text-4xl font-medium leading-[1.15]"
          style={{
            color: 'var(--color-ink)',
            letterSpacing: '-0.01em',
          }}
        >
          开始一篇论文{' '}
          <span
            className="italic"
            style={{ color: 'var(--color-ink-2)', fontWeight: 400 }}
          >
            · start a paper
          </span>
        </h1>
        <p
          className="mt-2 font-sans text-sm"
          style={{ color: 'var(--color-ink-3)' }}
        >
          邮箱 + ORCID 都可以；密码至少 8 位。
        </p>
      </header>
      <OrcidSignIn />
      <div className="flex items-center gap-3">
        <hr className="rule flex-1" />
        <span className="label-cap">or 邮箱</span>
        <hr className="rule flex-1" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="姓名 · Name"
          value={name}
          onChange={setName}
          autoComplete="name"
          required
        />
        <Field
          label="邮箱 · Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="密码 · Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
        />
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
          {pending ? '...' : '注册 · Sign up'}
        </button>
      </form>
      <p
        className="font-sans text-sm"
        style={{ color: 'var(--color-ink-2)' }}
      >
        已有账户？{' '}
        <Link
          href="/login"
          className="underline underline-offset-4"
          style={{ color: 'var(--color-ink)' }}
        >
          登录 · Sign in
        </Link>
      </p>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="font-sans text-xs"
        style={{ color: 'var(--color-ink-2)' }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        style={{
          background: 'var(--color-paper)',
          color: 'var(--color-ink)',
          border: '1.25px solid var(--color-pencil)',
          borderRadius: 'var(--radius-1)',
          padding: '8px 12px',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          lineHeight: 1.4,
          outline: 'none',
        }}
      />
    </label>
  );
}
