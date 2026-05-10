// File-based i18n: zh.ts is the source-of-truth shape; LocaleDict is
// derived from it. The English dictionary must structurally match
// — the i18n.test.ts walks both trees and asserts shape equality.

import { zh } from './locales/zh';

export type Locale = 'zh' | 'en';

export const LOCALES: readonly Locale[] = ['zh', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'zh';

// Recursive widening: zh is `as const`, which freezes every leaf to a
// literal type ("新组织"). The English mirror needs the same SHAPE but
// with different STRINGS, so we strip readonly AND widen string-literal
// types to `string`. Number / boolean leaves widen to their primitives
// for the same reason.
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? Widen<U>[]
        : T extends object
          ? { -readonly [K in keyof T]: Widen<T[K]> }
          : T;

export type LocaleDict = Widen<typeof zh>;

// Cookie name shared between server reader, client reader and
// Server Action writer. Single string — DO NOT inline elsewhere.
export const LOCALE_COOKIE = 'locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'zh' || value === 'en';
}
