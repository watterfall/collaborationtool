// Phase 1.5 #2 — server-side helper to read the ORCID iD a user has
// linked. Reads `account.accountId` where `provider_id = 'orcid'`.
// Returns null when the user never signed in via ORCID.

import 'server-only';

import { cache } from 'react';
import { and, eq } from 'drizzle-orm';

import { authSchema } from '@collaborationtool/drizzle';

import { getDb } from './db';

export const getOrcidIdForUser = cache(async (userId: string): Promise<string | null> => {
  const db = getDb();
  const rows = await db
    .select({ accountId: authSchema.account.accountId })
    .from(authSchema.account)
    .where(
      and(
        eq(authSchema.account.userId, userId),
        eq(authSchema.account.providerId, 'orcid'),
      ),
    )
    .limit(1);
  return rows[0]?.accountId ?? null;
});
