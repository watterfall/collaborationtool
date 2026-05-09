// Client-side better-auth handle — used inside client components for
// signup / login / signout actions and for `useSession()`.

import {
  genericOAuthClient,
  organizationClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env['NEXT_PUBLIC_BETTER_AUTH_URL'] ?? 'http://localhost:3000'),
  // The genericOAuth client is always loaded; it's a no-op when the
  // server hasn't registered any OAuth providers (sign-in call returns
  // PROVIDER_CONFIG_NOT_FOUND, which the UI handles).
  plugins: [organizationClient(), genericOAuthClient()],
});

export const { signIn, signUp, signOut, useSession, organization } = authClient;

/** True when the server is configured with an ORCID OAuth provider. */
export const ORCID_ENABLED =
  typeof process !== 'undefined' &&
  process.env['NEXT_PUBLIC_ORCID_ENABLED'] === 'true';
