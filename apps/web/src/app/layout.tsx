import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import { dictFor, getLocale } from '@/lib/i18n/get-locale';
import { FOUC_SCRIPT, getTheme } from '@/lib/theme/get-theme';

import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  // Both locales contribute — title and description are bilingual
  // strings rather than locale-switched, so social previews work
  // regardless of how the share was triggered. Page-level metadata
  // (e.g. landing) may override.
  return {
    title: '协作论文平台 · Collaboration Tool',
    description:
      '本地优先的双语论文协作平台 · A local-first, bilingual research-paper workbench.',
  };
}

export default async function RootLayout({ children }: PropsWithChildren) {
  // Server-resolve locale + theme so the <html> tag has the right
  // lang and dark class on first paint. The FOUC inline script then
  // re-checks the cookie + system preference before paint to handle
  // the 'system' preference (which the server can't infer).
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  const t = dictFor(locale);
  const htmlLang = locale === 'zh' ? 'zh-Hans' : 'en';
  return (
    <html
      lang={htmlLang}
      className={theme === 'dark' ? 'dark' : ''}
      data-theme={theme}
      suppressHydrationWarning
    >
      <head>
        {/* Inline FOUC-avoidance script — must run before <body>
            paints. Reads cookie + prefers-color-scheme and sets the
            `dark` class on <html>. Kept tiny + try/catch'd. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }}
        />
        {/* Editorial type stack — Source Serif 4 for Latin body /
            display, Noto Serif SC for CJK body, Noto Sans SC for chrome,
            JetBrains Mono for code. Self-host swaps these for OFL files
            in Phase 2 W6 (see Design.md §12.2). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..900;1,8..60,300..900&family=Noto+Serif+SC:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-zinc-900 focus:px-3 focus:py-1 focus:text-sm focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
        >
          {t.a11y.skipToMain}
        </a>
        {children}
      </body>
    </html>
  );
}
