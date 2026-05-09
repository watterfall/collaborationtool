// Phase 1.5 #1 — Accept invitation page.
//
// /invite/<id> — when the invitee opens the link:
//  - if not signed in, redirect to /login?next=/invite/<id>
//  - if signed in, render the client component which POSTs accept and
//    routes to the document editor on success
//
// All authorization is server-side; the client component is just UX.

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import AcceptClient from './accept-client';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${id}`)}`);
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header>
        <h1 className="text-3xl font-medium">接受邀请 / Accept invitation</h1>
        <p className="mt-2 text-sm text-zinc-500">
          以 {session.user.email} 的身份加入文档。
        </p>
      </header>
      <AcceptClient invitationId={id} />
    </main>
  );
}
