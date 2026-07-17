import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/lib/auth';
import { getOrcidIdForUser } from '@/lib/orcid-lookup';
import SignOutButton from '@/components/sign-out-button';
import { getDict } from '@/lib/i18n/get-locale';
import { HeaderControls } from '@/components/chrome/HeaderControls';

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect('/login');

  const orcid = await getOrcidIdForUser(session.user.id);
  const { t } = await getDict();
  // Best-effort current pathname for the toggles' revalidatePath.
  // Next forwards x-pathname / x-invoke-path on RSC; fall back to /docs
  // when neither is present.
  const pathname =
    h.get('x-invoke-path') ?? h.get('x-pathname') ?? '/docs';

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
      }}
    >
      {/* App chrome — hairline divider, paper bg, sans navigation. The
          active link gets a 1.5px ink underline; inactive links keep
          ink-2. ORCID badge uses ORCID's own brand chip (kept as the
          one explicit deviation from the muted triad — it's a brand
          mark, not decoration). */}
      <header style={{ borderBottom: '1px solid var(--color-hairline)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href="/docs"
            className="font-serif text-base font-medium"
            style={{ color: 'var(--color-ink)' }}
          >
            {t.common.nav.brand}
          </Link>
          <nav
            className="flex items-center gap-5 font-sans text-sm"
            style={{ color: 'var(--color-ink-2)' }}
          >
            <Link
              href="/docs"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {t.common.nav.docs}
            </Link>
            <Link
              href="/maintenance"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {t.common.nav.maintenance}
            </Link>
            <Link
              href="/settings"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {t.common.nav.settings}
            </Link>
            <Link
              href="/triadic"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {t.common.nav.triadic}
            </Link>
            <Link
              href="/vault"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {t.common.nav.vault}
            </Link>
            <Link
              href="/orgs/new"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {t.common.nav.newOrg}
            </Link>
            <span
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--color-ink-3)' }}
            >
              {orcid && (
                <a
                  href={`https://orcid.org/${orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`ORCID iD ${orcid}`}
                  className="flex items-center gap-1 px-2 py-0.5 font-mono text-xs"
                  style={{
                    background: 'rgba(166, 206, 57, 0.12)',
                    color: '#5b7a1f',
                    borderRadius: 'var(--radius-1)',
                  }}
                >
                  <span aria-hidden className="font-bold">
                    iD
                  </span>
                  <span>{orcid}</span>
                </a>
              )}
              <span>{session.user.email}</span>
            </span>
            <HeaderControls pathname={pathname} />
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {/* React 19 + Next.js 15 typing workaround — see comment in
         * `apps/web/src/app/layout.tsx`. */}
        <>{children}</>
      </main>
    </div>
  );
}
