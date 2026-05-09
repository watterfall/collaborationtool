'use client';

import { useRouter } from 'next/navigation';

import { signOut } from '@/lib/auth-client';

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push('/login');
        router.refresh();
      }}
      className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
    >
      退出 / Sign out
    </button>
  );
}
