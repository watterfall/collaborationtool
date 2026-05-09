'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signUp } from '@/lib/auth-client';

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
        <h1 className="text-3xl font-medium">注册 · Sign up</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Phase 1 仅支持邮箱密码；ORCID / Google 等留 Phase 1.5。
        </p>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="姓名 / Name"
          value={name}
          onChange={setName}
          autoComplete="name"
          required
        />
        <Field
          label="邮箱 / Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="密码 / Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
        />
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
          {pending ? '...' : '注册 / Sign up'}
        </button>
      </form>
      <p className="text-sm text-zinc-600">
        已有账户？{' '}
        <Link href="/login" className="underline">
          登录 / Sign in
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
      <span className="text-sm text-zinc-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
      />
    </label>
  );
}
