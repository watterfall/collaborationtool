// Phase 4 W2 BYO model settings shared validation + types.
//
// Both the API route (POST /api/settings/models) and the Server Action
// in /settings/models call validateModelPrefInput() to keep the
// validation rules in one place.

export const WIRE_FORMATS = [
  'anthropic',
  'openai-compat',
  'ollama',
  'custom-http',
] as const;
export type WireFormat = (typeof WIRE_FORMATS)[number];

/** Defaults the UI suggests when the user picks a wireFormat. The
 * user can override; this is just to save typing on the common
 * happy paths. */
export const WIRE_FORMAT_DEFAULTS: Record<
  WireFormat,
  { modelId: string; endpointUrl: string | null; apiKeyEnvVar: string | null }
> = {
  anthropic: {
    modelId: 'claude-sonnet-4-6',
    endpointUrl: null,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  },
  'openai-compat': {
    modelId: 'gpt-4o',
    endpointUrl: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
  },
  ollama: {
    modelId: 'llama3.1',
    endpointUrl: 'http://localhost:11434',
    apiKeyEnvVar: null,
  },
  'custom-http': {
    modelId: '',
    endpointUrl: '',
    apiKeyEnvVar: null,
  },
};

export interface ModelPrefInput {
  /** Discriminator label for the user's UI; e.g. 'Personal Anthropic'. */
  providerId: string;
  wireFormat: WireFormat;
  modelId: string;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  extraHeaders: Record<string, string> | null;
  /** Free-text label for UI; shown alongside providerId in lists. */
  label: string | null;
}

export type ValidationVerdict =
  | { ok: true; value: ModelPrefInput }
  | { ok: false; reason: string; field?: string };

/** Pure validator. Centralises rules so API + Server Action match.
 *
 * Rules:
 *   - providerId, modelId required
 *   - wireFormat must be one of the 4 allowed
 *   - openai-compat / ollama / custom-http require non-empty endpointUrl
 *   - apiKeyEnvVar (if set) must look like `[A-Z_][A-Z0-9_]*`
 *   - extraHeaders entries are string→string
 */
export function validateModelPrefInput(raw: unknown): ValidationVerdict {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'expected-object' };
  }
  const r = raw as Record<string, unknown>;

  const providerId = typeof r['providerId'] === 'string' ? r['providerId'].trim() : '';
  if (!providerId) return { ok: false, reason: 'providerId-required', field: 'providerId' };

  const wireFormat = r['wireFormat'];
  if (
    typeof wireFormat !== 'string' ||
    !(WIRE_FORMATS as readonly string[]).includes(wireFormat)
  ) {
    return { ok: false, reason: 'invalid-wire-format', field: 'wireFormat' };
  }
  const wf = wireFormat as WireFormat;

  const modelId = typeof r['modelId'] === 'string' ? r['modelId'].trim() : '';
  if (!modelId) return { ok: false, reason: 'modelId-required', field: 'modelId' };

  const endpointUrlRaw =
    typeof r['endpointUrl'] === 'string' ? r['endpointUrl'].trim() : '';
  const endpointUrl = endpointUrlRaw.length > 0 ? endpointUrlRaw : null;
  if ((wf === 'openai-compat' || wf === 'ollama' || wf === 'custom-http') && !endpointUrl) {
    return {
      ok: false,
      reason: 'endpoint-required',
      field: 'endpointUrl',
    };
  }
  if (endpointUrl && !/^https?:\/\//i.test(endpointUrl)) {
    return { ok: false, reason: 'endpoint-not-http', field: 'endpointUrl' };
  }

  const apiKeyEnvVarRaw =
    typeof r['apiKeyEnvVar'] === 'string' ? r['apiKeyEnvVar'].trim() : '';
  const apiKeyEnvVar = apiKeyEnvVarRaw.length > 0 ? apiKeyEnvVarRaw : null;
  if (apiKeyEnvVar && !/^[A-Z_][A-Z0-9_]*$/.test(apiKeyEnvVar)) {
    return { ok: false, reason: 'api-key-env-var-shape', field: 'apiKeyEnvVar' };
  }

  let extraHeaders: Record<string, string> | null = null;
  if (r['extraHeaders'] != null) {
    const eh = r['extraHeaders'];
    if (typeof eh !== 'object' || Array.isArray(eh)) {
      return { ok: false, reason: 'extra-headers-shape', field: 'extraHeaders' };
    }
    const ehObj = eh as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(ehObj)) {
      if (typeof v !== 'string') {
        return {
          ok: false,
          reason: 'extra-headers-value-not-string',
          field: 'extraHeaders',
        };
      }
      out[k] = v;
    }
    if (Object.keys(out).length > 0) extraHeaders = out;
  }

  const labelRaw = typeof r['label'] === 'string' ? r['label'].trim() : '';
  const label = labelRaw.length > 0 ? labelRaw : null;

  return {
    ok: true,
    value: {
      providerId,
      wireFormat: wf,
      modelId,
      endpointUrl,
      apiKeyEnvVar,
      extraHeaders,
      label,
    },
  };
}

/** Whether the given env var name is currently set on the host process.
 * Used by the settings UI to flag rows that point to an unset key. */
export function isEnvVarSet(name: string | null): boolean {
  if (!name) return true; // null env var = no key needed (e.g. local Ollama)
  return Boolean(process.env[name]);
}
