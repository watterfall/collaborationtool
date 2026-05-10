// Server-side locale resolution.
//
// Order of precedence:
//   1. Explicit cookie (`locale` = zh | en) — set by the LocaleToggle
//      Server Action; takes priority once the user has chosen.
//   2. Accept-Language header — if it contains any zh-* tag, use zh;
//      otherwise default to en (when an explicit en-* tag is present)
//      or fall back to DEFAULT_LOCALE.
//   3. DEFAULT_LOCALE (zh) — for direct hits with no cookie and no
//      header at all.
//
// parseAcceptLanguage and resolveLocale are pure helpers exported for
// unit tests so we don't need the next/headers shim to verify them.

import { cookies, headers } from 'next/headers';

import { zh } from './locales/zh';
import { en } from './locales/en';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
  type LocaleDict,
} from './types';

// `zh` is `as const` (readonly literal types) — the LocaleDict alias
// widens those to plain strings + mutable arrays so en.ts can satisfy
// the same shape with different values. We cast through `unknown`
// because TS won't narrow readonly→mutable structurally; the runtime
// value is identical.
const DICTS: Record<Locale, LocaleDict> = {
  zh: zh as unknown as LocaleDict,
  en,
};

/**
 * Pure: parse an Accept-Language header value into a Locale.
 *
 * Heuristic: walk the comma-separated tags in order. The first tag
 * starting with `zh` returns zh, the first starting with `en` returns
 * en. We deliberately ignore q-values — the dual-locale story is
 * coarse and ambiguity should land on the explicit toggle.
 *
 * Returns DEFAULT_LOCALE (zh) when the header is null, empty, or
 * mentions only scripts we don't support.
 */
export function parseAcceptLanguage(
  headerValue: string | null | undefined,
): Locale {
  if (!headerValue) return DEFAULT_LOCALE;
  const tags = headerValue
    .toLowerCase()
    .split(',')
    .map((s) => s.trim().split(';')[0] ?? '');
  for (const tag of tags) {
    if (tag.startsWith('zh')) return 'zh';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

/**
 * Pure resolver — same precedence as getLocale but takes raw inputs
 * so it can be exercised from unit tests without the next/headers
 * shim.
 */
export function resolveLocale(input: {
  cookieValue: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): Locale {
  if (isLocale(input.cookieValue)) return input.cookieValue;
  return parseAcceptLanguage(input.acceptLanguage);
}

/**
 * Server Component / Server Action helper. Reads cookie + Accept-Language
 * and returns a Locale. Use in any RSC tree to render the right copy
 * without requiring a client-side hydration roundtrip.
 */
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const h = await headers();
  return resolveLocale({
    cookieValue: c.get(LOCALE_COOKIE)?.value ?? null,
    acceptLanguage: h.get('accept-language'),
  });
}

/**
 * Convenience: resolve the locale and return the right dictionary.
 * Most pages call this directly: `const { t, locale } = await getDict()`.
 */
export async function getDict(): Promise<{ t: LocaleDict; locale: Locale }> {
  const locale = await getLocale();
  return { t: DICTS[locale], locale };
}

export function dictFor(locale: Locale): LocaleDict {
  return DICTS[locale];
}
