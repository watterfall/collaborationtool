// Phase 4 W2 ADR-0013 §2.4 lookup precedence resolver tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isUserConfigured,
  resolveProvider,
  type DocumentModelOverrideSnapshot,
  type EnvDefault,
  type ManifestPrefersProvider,
  type UserModelPrefSnapshot,
} from '../src/providers';

const ENV: EnvDefault = {
  anthropicApiKeyVar: 'ANTHROPIC_API_KEY',
  defaultModelId: 'claude-opus-4-7',
};

function envBag(map: Record<string, string>): (n: string) => string | undefined {
  return (n) => map[n];
}

describe('resolveProvider precedence', () => {
  const docOverride: DocumentModelOverrideSnapshot = {
    providerId: 'on-prem-ollama',
    wireFormat: 'ollama',
    modelId: 'llama-3.1-70b',
    endpointUrl: 'http://gpu.lan:11434',
    apiKeyEnvVar: null,
    extraHeaders: null,
    reason: 'sensitive legal review',
  };
  const userPref: UserModelPrefSnapshot = {
    providerId: 'my-deepseek',
    wireFormat: 'openai-compat',
    modelId: 'deepseek-chat',
    endpointUrl: 'https://api.deepseek.com/v1',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    extraHeaders: null,
    label: 'DeepSeek personal',
  };
  const manifestHint: ManifestPrefersProvider = {
    wireFormat: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    rationale: 'long-context document review',
  };

  it('document-override wins over user-pref + manifest', () => {
    const r = resolveProvider({
      documentOverride: docOverride,
      userPref,
      manifestHint,
      env: ENV,
    });
    assert.equal(r.source, 'document-override');
    assert.equal(r.providerId, 'on-prem-ollama');
    assert.equal(r.modelId, 'llama-3.1-70b');
    assert.equal(r.note, 'sensitive legal review');
  });

  it('user-pref wins when no document-override', () => {
    const r = resolveProvider(
      {
        documentOverride: null,
        userPref,
        manifestHint,
        env: ENV,
      },
      envBag({ DEEPSEEK_API_KEY: 'sk-deepseek-fake' }),
    );
    assert.equal(r.source, 'user-pref');
    assert.equal(r.wireFormat, 'openai-compat');
    assert.equal(r.apiKey, 'sk-deepseek-fake');
  });

  it('manifest-hint wins when no doc-override + no user-pref', () => {
    const r = resolveProvider({
      documentOverride: null,
      userPref: null,
      manifestHint,
      env: ENV,
    });
    assert.equal(r.source, 'manifest-hint');
    assert.equal(r.wireFormat, 'anthropic');
    assert.equal(r.modelId, 'claude-sonnet-4-6');
    assert.equal(r.note, 'long-context document review');
  });

  it('env-default fallback when all higher tiers null', () => {
    const r = resolveProvider(
      {
        documentOverride: null,
        userPref: null,
        manifestHint: null,
        env: ENV,
      },
      envBag({ ANTHROPIC_API_KEY: 'sk-ant-fake' }),
    );
    assert.equal(r.source, 'env-default');
    assert.equal(r.wireFormat, 'anthropic');
    assert.equal(r.modelId, 'claude-opus-4-7');
    assert.equal(r.apiKey, 'sk-ant-fake');
  });

  it('env-default with missing API key → apiKey null (host decides mock fallback)', () => {
    const r = resolveProvider(
      {
        documentOverride: null,
        userPref: null,
        manifestHint: null,
        env: ENV,
      },
      envBag({}),
    );
    assert.equal(r.source, 'env-default');
    assert.equal(r.apiKey, null);
  });

  it('user-pref with missing env-var → apiKey null (host falls back to mock or errors)', () => {
    const pref: UserModelPrefSnapshot = {
      ...userPref,
      apiKeyEnvVar: 'NONEXISTENT_VAR',
    };
    const r = resolveProvider(
      {
        documentOverride: null,
        userPref: pref,
        manifestHint: null,
        env: ENV,
      },
      envBag({}),
    );
    assert.equal(r.source, 'user-pref');
    assert.equal(r.apiKey, null);
    assert.equal(r.apiKeyEnvVar, 'NONEXISTENT_VAR');
  });

  it('user-pref with apiKeyEnvVar=null skips env lookup entirely', () => {
    // Local Ollama: no auth needed
    const ollama: UserModelPrefSnapshot = {
      providerId: 'local-ollama',
      wireFormat: 'ollama',
      modelId: 'qwen2.5:7b',
      endpointUrl: 'http://localhost:11434',
      apiKeyEnvVar: null,
      extraHeaders: null,
      label: null,
    };
    const r = resolveProvider({
      documentOverride: null,
      userPref: ollama,
      manifestHint: null,
      env: ENV,
    });
    assert.equal(r.apiKey, null);
    assert.equal(r.apiKeyEnvVar, null);
    assert.equal(r.endpointUrl, 'http://localhost:11434');
  });
});

describe('isUserConfigured', () => {
  it('true for document-override + user-pref', () => {
    const r1 = resolveProvider({
      documentOverride: {
        providerId: 'p',
        wireFormat: 'ollama',
        modelId: 'm',
        endpointUrl: null,
        apiKeyEnvVar: null,
        extraHeaders: null,
        reason: null,
      },
      userPref: null,
      manifestHint: null,
      env: ENV,
    });
    assert.equal(isUserConfigured(r1), true);
  });

  it('false for manifest-hint + env-default', () => {
    const r2 = resolveProvider({
      documentOverride: null,
      userPref: null,
      manifestHint: { wireFormat: 'anthropic' },
      env: ENV,
    });
    assert.equal(isUserConfigured(r2), false);

    const r3 = resolveProvider({
      documentOverride: null,
      userPref: null,
      manifestHint: null,
      env: ENV,
    });
    assert.equal(isUserConfigured(r3), false);
  });
});
