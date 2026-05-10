// Theme types — shared between server reader, client toggle and
// FOUC-avoidance inline script.

export type Theme = 'light' | 'dark';
export type ThemePref = Theme | 'system';

export const THEMES: readonly Theme[] = ['light', 'dark'] as const;
export const DEFAULT_THEME: Theme = 'light';
export const THEME_COOKIE = 'theme';

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}
