// Phase 4.5 W0.3 — Host-side wrapper around `resolveProvider`.
//
// codex review 2026-05-11 flagged `/api/agent/invoke` as still using
// the env-default tier directly. This module is the missing piece that
// loads `document_model_override` + `user_model_pref` from PG, calls
// the pure `resolveProvider`, and instantiates the right adapter.
//
// Lookup precedence (resolver):
//   1. document_model_override (per-doc pin)
//   2. user_model_pref (principal default)
//   3. agent manifest prefers_provider (not loaded here — no plugin
//      manifest currently sets it; route can pass null safely)
//   4. ENV default (ANTHROPIC_API_KEY)
//
// Returns `undefined` when no tier yields a usable api key / endpoint
// — the plugin-host falls back to `createMockModelProvider` keyed by
// agent kind, which is the air-gapped / CI dev path.

import { and, eq } from 'drizzle-orm';

import {
  createAnthropicProvider,
  createOllamaProvider,
  createOpenAICompatProvider,
  isUserConfigured,
  resolveProvider,
  type DocumentModelOverrideSnapshot,
  type ManifestPrefersProvider,
  type ModelProvider,
  type ResolvedProvider,
  type UserModelPrefSnapshot,
} from '@collaborationtool/ai-runtime';
import { schema } from '@collaborationtool/drizzle';

import type { getDb } from './db';

type Db = ReturnType<typeof getDb>;

const DEFAULT_ENV_VAR = 'ANTHROPIC_API_KEY';
const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

export interface ResolveAndInstantiateInput {
  db: Db;
  documentId: string;
  principalId: string;
  /** Optional plugin manifest hint. Currently no plugin sets
   *  `prefers_provider`; passing `null` is the steady state. */
  manifestHint?: ManifestPrefersProvider | null;
}

export interface ResolveAndInstantiateResult {
  provider: ModelProvider | undefined;
  /** Resolver decision metadata — emitted to observability so we can
   *  see whether real users hit document-override / user-pref / env
   *  rather than mock. */
  resolved: ResolvedProvider;
  /** True when the chosen tier was document-override or user-pref. */
  userConfigured: boolean;
}

export async function resolveAndInstantiateProvider(
  input: ResolveAndInstantiateInput,
): Promise<ResolveAndInstantiateResult> {
  const { db, documentId, principalId, manifestHint = null } = input;

  const [overrideRow] = await db
    .select({
      providerId: schema.documentModelOverride.providerId,
      wireFormat: schema.documentModelOverride.wireFormat,
      modelId: schema.documentModelOverride.modelId,
      endpointUrl: schema.documentModelOverride.endpointUrl,
      apiKeyEnvVar: schema.documentModelOverride.apiKeyEnvVar,
      extraHeaders: schema.documentModelOverride.extraHeaders,
      reason: schema.documentModelOverride.reason,
    })
    .from(schema.documentModelOverride)
    .where(eq(schema.documentModelOverride.documentId, documentId))
    .limit(1);

  const documentOverride: DocumentModelOverrideSnapshot | null = overrideRow
    ? {
        providerId: overrideRow.providerId,
        wireFormat: overrideRow.wireFormat,
        modelId: overrideRow.modelId,
        endpointUrl: overrideRow.endpointUrl,
        apiKeyEnvVar: overrideRow.apiKeyEnvVar,
        extraHeaders:
          (overrideRow.extraHeaders as Record<string, string> | null) ?? null,
        reason: overrideRow.reason,
      }
    : null;

  const [prefRow] = await db
    .select({
      providerId: schema.userModelPref.providerId,
      wireFormat: schema.userModelPref.wireFormat,
      modelId: schema.userModelPref.modelId,
      endpointUrl: schema.userModelPref.endpointUrl,
      apiKeyEnvVar: schema.userModelPref.apiKeyEnvVar,
      extraHeaders: schema.userModelPref.extraHeaders,
      label: schema.userModelPref.label,
    })
    .from(schema.userModelPref)
    .where(
      and(
        eq(schema.userModelPref.principalId, principalId),
        eq(schema.userModelPref.prefKind, 'default'),
      ),
    )
    .limit(1);

  const userPref: UserModelPrefSnapshot | null = prefRow
    ? {
        providerId: prefRow.providerId,
        wireFormat: prefRow.wireFormat,
        modelId: prefRow.modelId,
        endpointUrl: prefRow.endpointUrl,
        apiKeyEnvVar: prefRow.apiKeyEnvVar,
        extraHeaders:
          (prefRow.extraHeaders as Record<string, string> | null) ?? null,
        label: prefRow.label,
      }
    : null;

  const resolved = resolveProvider({
    documentOverride,
    userPref,
    manifestHint,
    env: {
      anthropicApiKeyVar: DEFAULT_ENV_VAR,
      defaultModelId: DEFAULT_MODEL_ID,
    },
  });

  const provider = instantiateProvider(resolved);

  return {
    provider,
    resolved,
    userConfigured: isUserConfigured(resolved),
  };
}

/** Switch on `wireFormat` and construct the matching adapter. Returns
 *  `undefined` when the chosen tier carries no usable api key /
 *  endpoint — the plugin host then drops to `createMockModelProvider`. */
function instantiateProvider(
  resolved: ResolvedProvider,
): ModelProvider | undefined {
  const id = resolved.providerId;
  const label = resolved.note ?? undefined;
  const headers = resolved.extraHeaders ?? undefined;

  switch (resolved.wireFormat) {
    case 'anthropic': {
      if (!resolved.apiKey) return undefined;
      return createAnthropicProvider({
        id,
        ...(label ? { label } : {}),
        apiKey: resolved.apiKey,
        ...(resolved.endpointUrl ? { endpointUrl: resolved.endpointUrl } : {}),
        ...(headers ? { headers } : {}),
      });
    }
    case 'openai-compat': {
      if (!resolved.endpointUrl) return undefined;
      return createOpenAICompatProvider({
        id,
        ...(label ? { label } : {}),
        endpointUrl: resolved.endpointUrl,
        ...(resolved.apiKey ? { apiKey: resolved.apiKey } : {}),
        ...(headers ? { headers } : {}),
      });
    }
    case 'ollama': {
      if (!resolved.endpointUrl) return undefined;
      return createOllamaProvider({
        id,
        ...(label ? { label } : {}),
        endpointUrl: resolved.endpointUrl,
        ...(resolved.apiKey ? { apiKey: resolved.apiKey } : {}),
        ...(headers ? { headers } : {}),
      });
    }
    case 'custom-http': {
      // custom-http requires caller-supplied serializeRequest +
      // parseResponse callbacks (per-deployment wire format). The
      // route can't materialise those generically from a PG row, so
      // this tier falls through to mock until a "custom-http
      // template" registry exists. Caller-supplied custom-http via
      // direct ai-runtime API continues to work — only the route's
      // declarative path is affected.
      return undefined;
    }
  }
}
