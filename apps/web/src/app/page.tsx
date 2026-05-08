import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function LandingPage() {
  // Logged in → straight to docs.
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect('/docs');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-medium tracking-tight">
        协作论文平台
      </h1>
      <p className="max-w-prose text-lg text-zinc-600">
        AI-native research paper platform · 思考-写作-验证-发表 一体化工作台。
        从 Phase 1 起进入两人协作 MVP。
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          注册 / Sign up
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
        >
          登录 / Sign in
        </Link>
      </div>
      <p className="text-xs text-zinc-500">
        Phase 1 D9 — better-auth + Principal bridge live; editor wires in
        D10/D11/D14.
      </p>
    </main>
  );
}
