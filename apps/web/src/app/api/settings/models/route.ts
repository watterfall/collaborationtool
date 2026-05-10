// Phase 4 W2 ADR-0013 BYO model: list + create user_model_pref.
//
// GET  /api/settings/models   → user's prefs + which env-var is currently set
// POST /api/settings/models   → create a new pref row
//
// Authorization: caller's principal_id; rows are private to the principal.

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import {
  isEnvVarSet,
  validateModelPrefInput,
} from '@/lib/byo-model';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function GET(): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.userModelPref)
    .where(eq(schema.userModelPref.principalId, principalId));

  return NextResponse.json({
    prefs: rows.map((r) => ({
      id: r.id,
      providerId: r.providerId,
      wireFormat: r.wireFormat,
      modelId: r.modelId,
      endpointUrl: r.endpointUrl,
      apiKeyEnvVar: r.apiKeyEnvVar,
      extraHeaders: r.extraHeaders,
      label: r.label,
      prefKind: r.prefKind,
      apiKeyConfigured: isEnvVarSet(r.apiKeyEnvVar),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    envDefault: {
      // What the resolver falls back to when no user_model_pref / no
      // document_model_override / no manifest hint matches.
      anthropicApiKeyConfigured: isEnvVarSet('ANTHROPIC_API_KEY'),
      defaultModelId: 'claude-sonnet-4-6',
    },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const verdict = validateModelPrefInput(body);
  if (!verdict.ok) {
    return NextResponse.json(verdict, { status: 400 });
  }

  const db = getDb();
  const id = uuidv7();
  const now = new Date();
  await db.insert(schema.userModelPref).values({
    id,
    principalId,
    prefKind: 'default',
    providerId: verdict.value.providerId,
    wireFormat: verdict.value.wireFormat,
    modelId: verdict.value.modelId,
    endpointUrl: verdict.value.endpointUrl,
    apiKeyEnvVar: verdict.value.apiKeyEnvVar,
    extraHeaders: verdict.value.extraHeaders,
    label: verdict.value.label,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    { ok: true, id, apiKeyConfigured: isEnvVarSet(verdict.value.apiKeyEnvVar) },
    { status: 201 },
  );
}
