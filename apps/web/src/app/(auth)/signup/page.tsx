'use client';

// Phase 4 W8.2 · Design.md §6.5 + §7 — signup surface.
//
// Mirrors the login layout (1fr 1fr grid, 400px form left, specimen
// right). Email + password are tucked behind a ghost-toggle so ORCID
// reads as the recommended path for researchers.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import OrcidSignIn from '@/components/orcid-sign-in';
import SpecimenQuote from '@/components/specimen-quote';
import { signUp } from '@/lib/auth-client';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await signUp.email({ email, password, name });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? 'Sign up failed');
      return;
    }
    router.push('/docs');
    router.refresh();
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--color-paper)' }}
      data-testid="signup-root"
    >
      <div
        className="grid min-h-screen grid-cols-1 md:grid-cols-2"
        data-testid="signup-grid"
      >
        {/* ── Left: form column ─────────────────────────────────────── */}
        <section
          className="flex items-center justify-center px-6 py-16 md:px-12"
          data-testid="signup-form-column"
        >
          <div className="flex w-full max-w-[400px] flex-col gap-6">
            <header className="flex flex-col gap-2">
              <p className="label-cap">注册 · sign up</p>
              <h2
                className="font-serif font-medium leading-[1.25]"
                style={{
                  fontSize: '30px',
                  color: 'var(--color-ink)',
                  letterSpacing: '-0.005em',
                }}
              >
                开始一篇论文{' '}
                <span
                  className="italic"
                  style={{ color: 'var(--color-ink-2)', fontWeight: 400 }}
                >
                  · start a paper
                </span>
              </h2>
              <p
                className="font-sans text-sm"
                style={{ color: 'var(--color-ink-3)' }}
              >
                推荐用 ORCID · ORCID recommended for researchers
              </p>
            </header>

            <OrcidSignIn callbackURL="/docs" />

            <div className="flex items-center gap-3">
              <hr className="rule flex-1" />
              <span className="label-cap">或 · or</span>
              <hr className="rule flex-1" />
            </div>

            {!showEmailForm ? (
              <button
                type="button"
                className="btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowEmailForm(true)}
                data-testid="signup-email-toggle"
              >
                邮箱密码 · Email & password
              </button>
            ) : (
              <form
                onSubmit={onSubmit}
                className="flex flex-col gap-4"
                data-testid="signup-email-form"
              >
                <FieldLabel label="姓名 · Name">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    style={inputStyle}
                  />
                </FieldLabel>
                <FieldLabel label="邮箱 · Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    style={inputStyle}
                  />
                </FieldLabel>
                <FieldLabel label="密码 · Password (≥ 8)">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    style={inputStyle}
                  />
                </FieldLabel>
                {error && (
                  <p
                    className="font-sans text-sm"
                    role="alert"
                    style={{ color: 'var(--color-accent-ox)' }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {pending ? '...' : '注册 · Sign up'}
                </button>
              </form>
            )}

            <hr className="rule" />
            <p
              className="font-serif italic text-sm"
              style={{ color: 'var(--color-ink-2)' }}
            >
              已有账号？{' '}
              <Link
                href="/login"
                className="underline underline-offset-4"
                style={{ color: 'var(--color-ink)' }}
              >
                登录 · Sign in
              </Link>
            </p>
          </div>
        </section>

        {/* ── Right: specimen quote (md+ only) ─────────────────────── */}
        <aside
          className="hidden md:flex"
          data-testid="signup-specimen-column"
          style={{ background: 'var(--color-paper-2)' }}
        >
          <SpecimenQuote />
        </aside>
      </div>
    </main>
  );
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
  width: '100%',
} as const;

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="font-sans text-xs"
        style={{ color: 'var(--color-ink-2)' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
