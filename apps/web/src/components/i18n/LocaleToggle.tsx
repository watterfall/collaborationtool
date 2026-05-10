'use client';

// Locale toggle: two-chip "中" / "EN" segmented switch.
// Submits a form to the setLocaleAction Server Action, which sets the
// cookie and revalidates the current path. Active state is rendered
// from the server-resolved locale prop, so SSR/CSR agree on first
// paint (no hydration flicker).

import { useTransition } from 'react';

import { setLocaleAction } from '@/lib/i18n/actions';
import type { Locale } from '@/lib/i18n/types';

export function LocaleToggle({
  current,
  pathname,
  labels,
}: {
  current: Locale;
  pathname: string;
  labels: { zh: string; en: string; switchToZh: string; switchToEn: string };
}) {
  const [isPending, startTransition] = useTransition();

  function submit(target: Locale) {
    if (target === current) return;
    const fd = new FormData();
    fd.set('locale', target);
    fd.set('path', pathname);
    startTransition(() => {
      void setLocaleAction(fd);
    });
  }

  const baseChip =
    'px-2 py-0.5 text-xs font-medium font-sans transition-colors disabled:opacity-50';
  const activeChip =
    'ring-1 ring-zinc-900 dark:ring-zinc-100 text-zinc-900 dark:text-zinc-100';
  const idleChip =
    'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center gap-1"
    >
      <button
        type="button"
        onClick={() => submit('zh')}
        disabled={isPending}
        aria-pressed={current === 'zh'}
        aria-label={labels.switchToZh}
        className={`${baseChip} ${current === 'zh' ? activeChip : idleChip}`}
      >
        {labels.zh}
      </button>
      <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
        ·
      </span>
      <button
        type="button"
        onClick={() => submit('en')}
        disabled={isPending}
        aria-pressed={current === 'en'}
        aria-label={labels.switchToEn}
        className={`${baseChip} ${current === 'en' ? activeChip : idleChip}`}
      >
        {labels.en}
      </button>
    </div>
  );
}
