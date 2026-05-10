// Phase 4 W2 ADR-0013 §2.4: ModelProvider lookup + resolver.
//
// Lookup precedence (highest wins):
//   1. document_model_override (per-doc pin; admin-grade)
//   2. user_model_pref (principal default)
//   3. agent manifest prefers_provider (author hint)
//   4. ENV default (anthropic via ANTHROPIC_API_KEY)
//
// This module is **pure**: callers pass already-loaded rows from PG +
// process.env; the resolver picks one and returns a constructor input.
// It does NOT touch PG or instantiate clients — that's host code.

import type { WireFormat } from './types';

/** Subset of `user_model_pref` row needed for resolution. */
export interface UserModelPrefSnapshot {
  providerId: string;
  wireFormat: WireFormat;
  modelId: string;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  extraHeaders: Record<string, string> | null;
  label: string | null;
}

/** Subset of `document_model_override` row. */
export interface DocumentModelOverrideSnapshot {
  providerId: string;
  wireFormat: WireFormat;
  modelId: string;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  extraHeaders: Record<string, string> | null;
  reason: string | null;
}

/** Manifest hint (Phase 4 W2 manifest extension). */
export interface ManifestPrefersProvider {
  wireFormat: WireFormat;
  modelId?: string;
  rationale?: string;
}

export interface EnvDefault {
  anthropicApiKeyVar: string;
  defaultModelId: string;
}

export interface ResolveProviderInput {
  documentOverride: DocumentModelOverrideSnapshot | null;
  userPref: UserModelPrefSnapshot | null;
  manifestHint: ManifestPrefersProvider | null;
  env: EnvDefault;
}

/** Output: which wire-format adapter to instantiate + with what config.
 * The `apiKey` field is null when the chosen tier doesn't carry an
 * env-var pointer (e.g. local Ollama with no auth, or env-default but
 * the var is unset — host decides whether to throw or fall back). */
export interface ResolvedProvider {
  /** Which tier won: useful for UI 'this doc is forced to ollama' hints. */
  source: 'document-override' | 'user-pref' | 'manifest-hint' | 'env-default';
  providerId: string;
  wireFormat: WireFormat;
  modelId: string;
  endpointUrl: string | null;
  apiKey: string | null;
  apiKeyEnvVar: string | null;
  extraHeaders: Record<string, string> | null;
  /** Optional human-readable note for UI ("forced to on-prem ollama
   * because legal review"). */
  note: string | null;
}

/** A resolver dependency for env-var lookup; injectable for tests. */
export type EnvResolver = (name: string) => string | undefined;

/**
 * Pure resolver. `envResolver` defaults to process.env if omitted.
 * Throws if no tier matches AND env-default has no API key (host can
 * catch and surface a config-required UI prompt).
 */
export function resolveProvider(
  input: ResolveProviderInput,
  envResolver: EnvResolver = (name) => process.env[name],
): ResolvedProvider {
  if (input.documentOverride) {
    const o = input.documentOverride;
    return {
      source: 'document-override',
      providerId: o.providerId,
      wireFormat: o.wireFormat,
      modelId: o.modelId,
      endpointUrl: o.endpointUrl,
      apiKey: o.apiKeyEnvVar ? envResolver(o.apiKeyEnvVar) ?? null : null,
      apiKeyEnvVar: o.apiKeyEnvVar,
      extraHeaders: o.extraHeaders,
      note: o.reason,
    };
  }

  if (input.userPref) {
    const u = input.userPref;
    return {
      source: 'user-pref',
      providerId: u.providerId,
      wireFormat: u.wireFormat,
      modelId: u.modelId,
      endpointUrl: u.endpointUrl,
      apiKey: u.apiKeyEnvVar ? envResolver(u.apiKeyEnvVar) ?? null : null,
      apiKeyEnvVar: u.apiKeyEnvVar,
      extraHeaders: u.extraHeaders,
      note: u.label,
    };
  }

  if (input.manifestHint) {
    // Manifest hint only declares a wire format + (optional) model id.
    // We can't know the user's actual endpoint/key for that wire format
    // unless it's anthropic (env-default fallback below covers that).
    // If the manifest wants ollama or openai-compat without user config,
    // we still emit a resolved struct but mark apiKey null and let the
    // host throw "user has not configured a $wireFormat provider".
    return {
      source: 'manifest-hint',
      providerId: `hint-${input.manifestHint.wireFormat}`,
      wireFormat: input.manifestHint.wireFormat,
      modelId: input.manifestHint.modelId ?? input.env.defaultModelId,
      endpointUrl: null,
      apiKey: null,
      apiKeyEnvVar: null,
      extraHeaders: null,
      note: input.manifestHint.rationale ?? null,
    };
  }

  // env-default: anthropic via ANTHROPIC_API_KEY (or whatever env name
  // the host injects). null apiKey is a soft state — host decides
  // whether to invoke the mock runner.
  const envKey = envResolver(input.env.anthropicApiKeyVar) ?? null;
  return {
    source: 'env-default',
    providerId: 'anthropic-env-default',
    wireFormat: 'anthropic',
    modelId: input.env.defaultModelId,
    endpointUrl: null,
    apiKey: envKey,
    apiKeyEnvVar: input.env.anthropicApiKeyVar,
    extraHeaders: null,
    note: null,
  };
}

/** True iff resolver returned a tier that the host should treat as
 * "configured by user" (vs falling back to env / mock). */
export function isUserConfigured(r: ResolvedProvider): boolean {
  return r.source === 'document-override' || r.source === 'user-pref';
}
