// Public landing page (Server Component).
//   • Anonymous visitors → marketing landing in their resolved locale.
//   • Authenticated users → server-side redirect to /docs.
//
// Page-level metadata overrides the bilingual root metadata with
// the joined CN/EN strings so SEO previews look right regardless of
// which language a crawler picks up.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getDict } from '@/lib/i18n/get-locale';
import { en } from '@/lib/i18n/locales/en';
import { zh } from '@/lib/i18n/locales/zh';
import { Landing } from '@/components/landing/Landing';
import { HeaderControls } from '@/components/chrome/HeaderControls';

export async function generateMetadata(): Promise<Metadata> {
  // Bilingual title + description so a crawler that hits the page
  // before the cookie is set still gets meaningful copy in both
  // scripts. Order: zh first (default locale), en after.
  const title = `${zh.landing.meta.title} · ${en.landing.meta.title}`;
  const description = `${zh.landing.meta.description} · ${en.landing.meta.description}`;
  return { title, description };
}

export default async function LandingPage() {
  // Logged-in → straight to docs. Same behavior as the previous
  // landing, kept identical so middleware + UX stay consistent.
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect('/docs');

  const { t } = await getDict();
  return (
    <div
      style={{
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
      }}
    >
      {/* Compact public chrome — no auth-gated nav, just sign-in plus
          locale + theme toggles. Hairline-divided, no shadow / blur,
          per Design.md §11 (reject criteria). */}
      <header
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          background: 'var(--color-paper)',
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <span
            className="font-serif text-base font-medium"
            style={{ color: 'var(--color-ink)' }}
          >
            {t.common.nav.brand}
          </span>
          <div
            className="flex items-center gap-4 font-sans text-sm"
            style={{ color: 'var(--color-ink-2)' }}
          >
            <a
              href="/open"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              Open ledger · 开放账本
            </a>
            <a
              href="/login"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {t.common.actions.signIn}
            </a>
            <HeaderControls pathname="/" />
          </div>
        </div>
      </header>
      <Landing t={t} />
    </div>
  );
}
