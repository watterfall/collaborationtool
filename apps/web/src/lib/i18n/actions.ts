'use server';

// Server Action: write the locale cookie. Used by the LocaleToggle
// client component. We do this server-side so the next render
// already returns the right dictionary — avoids hydration flicker.

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { LOCALE_COOKIE, isLocale } from './types';

/**
 * Persist the chosen locale in a cookie. 1 year max-age; HttpOnly is
 * deliberately OFF so a future client-side bilingual piece can read
 * its own current value without a roundtrip if needed.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const value = formData.get('locale');
  if (!isLocale(value)) return;
  const c = await cookies();
  c.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  // Revalidate the current path so the page re-renders with the new
  // dictionary immediately. The toggle passes a `path` formData entry
  // pointing at the page that initiated the action.
  const path = String(formData.get('path') ?? '/');
  revalidatePath(path);
}
