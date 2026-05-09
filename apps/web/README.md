# @collaborationtool/web

Phase 1 D9 — Next.js 15 App Router web shell. Auth via better-auth +
organization plugin; principals materialised via the bridge in
`@collaborationtool/permissions`.

## What's wired (D9)

- Email + password signup / login / signout
- Organization create (better-auth `organization` plugin)
- **Principal bridge** runs on `user.create` (databaseHook) and on
  `organization.create` (server route at `/api/orgs/bridge`)
- Docs list page (owner-filtered) + create-doc form (also materialises
  the `paper-author` ACL row for the owner)
- Editor page is a **placeholder** — D10 lands TipTap, D11 wires y-sweet,
  D14 wires the approval flow UI

## What's NOT wired (deferred to plan)

- OAuth providers (Google / GitHub / ORCID) → Phase 1.5
- Invitation flow → Phase 1.5
- Password reset / email verification → Phase 1.5
- Sentry / PostHog → Phase 1.5
- Editor + collab → D10 / D11
- Render / export → D12
- AI agents UI → D13 / D14
- E2E Playwright happy-path → D15

## Env vars (server)

| Variable | Default | Required |
|---|---|---|
| `BETTER_AUTH_SECRET` | — | yes (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | no |
| `DATABASE_URL` | `postgres://collab:collab@localhost:5432/collaborationtool` | no |
| `SYNC_TOKEN_SECRET` | — | yes (shared with `apps/sync-gateway`) |
| `SYNC_TOKEN_ISSUER` | `collaborationtool.web` | no |
| `SYNC_TOKEN_AUDIENCE` | `sync-gateway` | no |
| `SYNC_GATEWAY_WS_URL` | `ws://127.0.0.1:4321/ws` | no |

## Local run

```bash
# 0. ensure D7 / D9 schema + D8 gateway:
pnpm db:migrate
pnpm db:seed

# 1. set env (one shot):
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export SYNC_TOKEN_SECRET=$(openssl rand -base64 32)

# 2. start web:
pnpm web:dev

# 3. (optional) start gateway in another terminal:
pnpm gateway:start
```

Open http://localhost:3000 and walk through:

1. landing → "Sign up" → form → submit
2. (auto-redirected to `/docs`)
3. "New document" → form → submit → redirected to `/editor/<id>` placeholder
4. Verify in Postgres:

```sql
SELECT id, kind, display_name, user_id, created_at FROM principal
  ORDER BY created_at DESC LIMIT 5;
SELECT id, slug, title, owner_principal_id FROM document
  ORDER BY created_at DESC LIMIT 5;
SELECT document_id, principal_id, role_id, capability_verbs FROM document_acl
  ORDER BY document_id DESC LIMIT 5;
```

You should see (in order, after one signup + one doc create):

- one `principal { kind: 'user', user_id: <better-auth-user-id> }`
- one `document { owner_principal_id: <user-principal>, slug: ... }`
- one `document_acl { role_id: 'paper-author', capability_verbs: [...] }`

## Architectural notes

- **Server-only modules** (`lib/auth.ts`, `lib/db.ts`, `lib/env.ts`,
  `lib/principal.ts`) must NOT be imported from client components. Next
  is configured to throw at build if you do.
- **Bridge isolation**: better-auth-specific shapes live in
  `lib/auth.ts`; the pure bridge functions live in
  `@collaborationtool/permissions/principal-bridge.ts`. Phase 2 swap to
  Auth.js touches `lib/auth.ts` only.
- **No direct PG queries from client components**. All DB access goes
  through the server (`getDb()` plus a server action / route handler).
