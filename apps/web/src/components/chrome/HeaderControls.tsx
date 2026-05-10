// Server Component wrapper that resolves locale + theme on the
// server and hands the Client toggles their initial state. Avoids
// hydration flicker because the chips render the right active state
// from the very first paint.

import { dictFor, getLocale } from '@/lib/i18n/get-locale';
import { getTheme } from '@/lib/theme/get-theme';
import { LocaleToggle } from '@/components/i18n/LocaleToggle';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export async function HeaderControls({ pathname }: { pathname: string }) {
  const locale = await getLocale();
  const theme = await getTheme();
  const t = dictFor(locale);
  return (
    <div className="flex items-center gap-3">
      <LocaleToggle
        current={locale}
        pathname={pathname}
        labels={{
          zh: t.common.locale.zh,
          en: t.common.locale.en,
          switchToZh: t.common.locale.switchToZh,
          switchToEn: t.common.locale.switchToEn,
        }}
      />
      <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
        |
      </span>
      <ThemeToggle
        current={theme}
        pathname={pathname}
        labels={{
          toggleLabel: t.common.theme.toggleLabel,
          toggleToDark: t.common.theme.toggleToDark,
          toggleToLight: t.common.theme.toggleToLight,
        }}
      />
    </div>
  );
}
