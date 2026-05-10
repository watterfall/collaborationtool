import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { PropsWithChildren } from 'react';

import { auth } from '@/lib/auth';
import { getOrcidIdForUser } from '@/lib/orcid-lookup';
import SignOutButton from '@/components/sign-out-button';
import { getDict } from '@/lib/i18n/get-locale';
import { HeaderControls } from '@/components/chrome/HeaderControls';

export default async function AppLayout({ children }: PropsWithChildren) {
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
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href="/docs"
            className="font-medium text-zinc-900 dark:text-zinc-100"
          >
            {t.common.nav.brand}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/docs"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {t.common.nav.docs}
            </Link>
            <Link
              href="/maintenance"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {t.common.nav.maintenance}
            </Link>
            <Link
              href="/settings"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {t.common.nav.settings}
            </Link>
            <Link
              href="/orgs/new"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {t.common.nav.newOrg}
            </Link>
            <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              {orcid && (
                <a
                  href={`https://orcid.org/${orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`ORCID iD ${orcid}`}
                  className="flex items-center gap-1 rounded bg-[#a6ce39]/10 px-2 py-0.5 text-xs font-mono text-[#5b7a1f] hover:bg-[#a6ce39]/20 dark:text-[#a6ce39] dark:hover:bg-[#a6ce39]/15"
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
        {children}
      </main>
    </div>
  );
}
