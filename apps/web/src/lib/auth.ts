// Server-side better-auth config. The `auth` export is the canonical
// handler — `app/api/auth/[...all]/route.ts` forwards into it; React
// Server Components can call `auth.api.getSession()` directly.
//
// Bridge wiring: better-auth's `databaseHooks` fire after row writes;
// we hook user.create / organization.create / user.update (revoke) to
// keep the `principal` table in sync per ADR-0002 §2.3.

import { authSchema } from '@collaborationtool/drizzle';
import {
  createOrgPrincipal,
  createUserPrincipal,
  revokeUserPrincipal,
} from '@collaborationtool/permissions';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, organization } from 'better-auth/plugins';

import { getDb } from './db';
import { env } from './env';
import { buildOrcidProviderConfig, readOrcidEnv } from './orcid';

const db = getDb();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
      organization: authSchema.organization,
      member: authSchema.member,
      invitation: authSchema.invitation,
    },
  }),
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Phase 1.5 will turn this on + add a sender; Phase 1 keeps it off
    // so dev signup is single-step.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  // Phase 1.5 #2: ORCID OAuth (env-gated). When ORCID_CLIENT_ID +
  // _SECRET are unset, the provider list stays empty so the existing
  // email/password flow is the only sign-in path.
  plugins: buildPlugins(),
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await createUserPrincipal(db, {
            userId: createdUser.id,
            displayName: createdUser.name || createdUser.email,
          });
        },
      },
      update: {
        // Phase 1: no soft-delete in better-auth; Phase 1.5 surface a
        // `disabled_at` column + revoke principal here.
        after: async () => {
          /* noop */
        },
      },
    },
    session: {
      // No principal-side action on session events; sync-gateway loads
      // ACL fresh on connect.
    },
  },
  // Phase 1: cookie-based sessions only; Phase 2 will add the
  // sync-gateway JWT exchange endpoint here once apps/web actually
  // serves the editor.
});

export type Auth = typeof auth;

/**
 * Bridge helper for the org plugin. better-auth's hooks for the
 * organization plugin are surfaced via plugin lifecycle — Phase 1.x
 * the plugin doesn't yet expose a fully typed databaseHook, so we wire
 * org-create on the server action path in `app/(app)/orgs/new/page.tsx`.
 *
 * Keeping the helper here so the bridge invocation lives next to the
 * better-auth instance, even if the call site is in a server action.
 */
export async function bridgeOrgCreate(args: {
  orgId: string;
  displayName: string;
}): Promise<void> {
  await createOrgPrincipal(db, args);
}

/** Soft-delete a user's principal. Wire this in when better-auth user
 *  delete is exposed. Currently unused — Phase 1.5. */
export async function bridgeUserRevoke(userId: string): Promise<void> {
  await revokeUserPrincipal(db, userId);
}

function buildPlugins() {
  const plugins: ReturnType<typeof organization>[] = [
    organization({
      // Phase 1: organization metadata is bare-bones. Phase 1.5 adds
      // invitation flow + role beyond owner/member.
      allowUserToCreateOrganization: true,
    }),
  ];
  const orcidEnv = readOrcidEnv();
  if (orcidEnv) {
    plugins.push(
      genericOAuth({
        config: [buildOrcidProviderConfig(orcidEnv)],
      }) as unknown as ReturnType<typeof organization>,
    );
  }
  return plugins;
}
