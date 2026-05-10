'use client';

// Theme toggle: single chip that flips between light and dark. Click
// → Server Action persists the cookie + revalidates; we also update
// the document.documentElement.classList immediately so the next
// paint reflects the new theme without waiting for the server round
// trip. Cycles light ↔ dark only (system resolves to the OS default
// at first load via the FOUC script; choosing here pins the value).

import { useTransition } from 'react';

import { setThemeAction } from '@/lib/theme/actions';
import type { Theme } from '@/lib/theme/types';

export function ThemeToggle({
  current,
  pathname,
  labels,
}: {
  current: Theme;
  pathname: string;
  labels: { toggleLabel: string; toggleToDark: string; toggleToLight: string };
}) {
  const [isPending, startTransition] = useTransition();

  function submit() {
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    // Apply immediately for snappy feel; the server action will also
    // re-render but we don't want a 1-frame mismatch on click.
    if (typeof document !== 'undefined') {
      const r = document.documentElement;
      if (next === 'dark') r.classList.add('dark');
      else r.classList.remove('dark');
      r.dataset['theme'] = next;
    }
    const fd = new FormData();
    fd.set('theme', next);
    fd.set('path', pathname);
    startTransition(() => {
      void setThemeAction(fd);
    });
  }

  const isDark = current === 'dark';
  return (
    <button
      type="button"
      onClick={submit}
      disabled={isPending}
      aria-label={isDark ? labels.toggleToLight : labels.toggleToDark}
      title={labels.toggleLabel}
      className="inline-flex h-6 w-6 items-center justify-center text-sm text-zinc-700 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-100"
    >
      <span aria-hidden>{isDark ? '☾' : '☀'}</span>
    </button>
  );
}
