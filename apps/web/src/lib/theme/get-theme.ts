// Server-side theme resolution.
//
// Cookie ('theme') values:
//   light    → render <html class="">
//   dark     → render <html class="dark">
//   system   → render <html class=""> server-side; the FOUC inline
//              script then flips to "dark" before paint if the OS
//              prefers dark. (Server can't read prefers-color-scheme.)
//   missing  → same as 'system' (DEFAULT_PREF).
//
// The "system" case is the only path that may briefly mismatch
// between server and client; the inline script in <head> runs before
// CSS-aware paint, keeping FOUC under one frame.

import { cookies } from 'next/headers';

import {
  DEFAULT_THEME,
  THEME_COOKIE,
  isThemePref,
  type Theme,
  type ThemePref,
} from './types';

export const DEFAULT_PREF: ThemePref = 'system';

/**
 * Pure: resolve a Theme from a cookie value. 'system' and missing
 * values fall back to DEFAULT_THEME (light) for SSR. The client
 * inline script overrides this before paint when the OS prefers dark.
 */
export function resolveServerTheme(
  cookieValue: string | null | undefined,
): Theme {
  if (cookieValue === 'light') return 'light';
  if (cookieValue === 'dark') return 'dark';
  return DEFAULT_THEME;
}

/**
 * Pure: read the user's stored preference (including 'system'). The
 * theme toggle uses this to decide its current visual state.
 */
export function resolveServerPref(
  cookieValue: string | null | undefined,
): ThemePref {
  if (isThemePref(cookieValue)) return cookieValue;
  return DEFAULT_PREF;
}

export async function getTheme(): Promise<Theme> {
  const c = await cookies();
  return resolveServerTheme(c.get(THEME_COOKIE)?.value ?? null);
}

export async function getThemePref(): Promise<ThemePref> {
  const c = await cookies();
  return resolveServerPref(c.get(THEME_COOKIE)?.value ?? null);
}

/**
 * Inline script source — emitted in <head> before the <body> renders.
 *
 * Reads the cookie ourselves (no document.cookie helpers, deps-free),
 * checks `prefers-color-scheme: dark` when the cookie says 'system'
 * (or is absent), and toggles `document.documentElement.classList`.
 *
 * Wrapped in IIFE + try/catch so a parse error in any future edit
 * never prevents the page from rendering. Kept ~10 lines per the
 * task brief.
 */
export const FOUC_SCRIPT = `(()=>{try{var m=document.cookie.match(/(?:^|;\\s*)theme=([^;]+)/);var v=m&&m[1];var t=v==='light'||v==='dark'?v:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var r=document.documentElement;if(t==='dark')r.classList.add('dark');else r.classList.remove('dark');r.dataset.theme=t;}catch(e){}})();`;
