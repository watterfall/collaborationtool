// Convenience: turn a better-auth session's userId into our PrincipalId.
// Cached per-request via React's `cache` (so multiple Server Components
// in the same request share one DB roundtrip).

import { cache } from 'react';

import { findPrincipalIdByUserId } from '@collaborationtool/permissions';

import { getDb } from './db';

export const getPrincipalIdForUser = cache(
  async (userId: string): Promise<string | null> => {
    return findPrincipalIdByUserId(getDb(), userId);
  },
);
