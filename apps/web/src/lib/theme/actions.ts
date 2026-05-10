'use server';

// Server Action: persist the user's theme preference. Accepts
// 'light' | 'dark' | 'system'. The client toggle calls this on
// click; the FOUC script picks up the new cookie value on the next
// page load.

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { THEME_COOKIE, isThemePref } from './types';

export async function setThemeAction(formData: FormData): Promise<void> {
  const value = formData.get('theme');
  if (!isThemePref(value)) return;
  const c = await cookies();
  c.set(THEME_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  const path = String(formData.get('path') ?? '/');
  revalidatePath(path);
}
