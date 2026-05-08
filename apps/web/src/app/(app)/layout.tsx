import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { PropsWithChildren } from 'react';

import { auth } from '@/lib/auth';
import SignOutButton from '@/components/sign-out-button';

export default async function AppLayout({ children }: PropsWithChildren) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/docs" className="font-medium text-zinc-900">
            协作论文平台
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/docs" className="text-zinc-700 hover:text-zinc-900">
              文档 · Docs
            </Link>
            <Link href="/orgs/new" className="text-zinc-700 hover:text-zinc-900">
              新组织 · New org
            </Link>
            <span className="text-zinc-500">{session.user.email}</span>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
