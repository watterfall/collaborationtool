// Client-side better-auth handle — used inside client components for
// signup / login / signout actions and for `useSession()`.

import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env['NEXT_PUBLIC_BETTER_AUTH_URL'] ?? 'http://localhost:3000'),
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession, organization } = authClient;
