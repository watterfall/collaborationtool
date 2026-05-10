// Phase 4 W2 BYO model validator tests.
//
// Pure: validateModelPrefInput is the source of truth for both the
// API route and the dashboard Server Action. These tests pin the
// validation rules so a future schema change is caught here.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  WIRE_FORMAT_DEFAULTS,
  validateModelPrefInput,
} from '../src/lib/byo-model';

describe('validateModelPrefInput — happy paths', () => {
  it('accepts an anthropic preset', () => {
    const v = validateModelPrefInput({
      providerId: 'my-anthropic',
      wireFormat: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      label: 'Personal',
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.value.providerId, 'my-anthropic');
    assert.equal(v.value.wireFormat, 'anthropic');
    assert.equal(v.value.endpointUrl, null);
    assert.equal(v.value.label, 'Personal');
  });

  it('accepts openai-compat with endpoint', () => {
    const v = validateModelPrefInput({
      providerId: 'openrouter',
      wireFormat: 'openai-compat',
      modelId: 'anthropic/claude-3.5-sonnet',
      endpointUrl: 'https://openrouter.ai/api/v1',
      apiKeyEnvVar: 'OPENROUTER_API_KEY',
    });
    assert.equal(v.ok, true);
  });

  it('accepts ollama with no api key', () => {
    const v = validateModelPrefInput({
      providerId: 'local-ollama',
      wireFormat: 'ollama',
      modelId: 'llama3.1',
      endpointUrl: 'http://localhost:11434',
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.value.apiKeyEnvVar, null);
  });

  it('trims whitespace from string fields', () => {
    const v = validateModelPrefInput({
      providerId: '  trimmed  ',
      wireFormat: 'anthropic',
      modelId: '  m  ',
      label: '  L  ',
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.value.providerId, 'trimmed');
    assert.equal(v.value.modelId, 'm');
    assert.equal(v.value.label, 'L');
  });

  it('preserves extraHeaders dictionary', () => {
    const v = validateModelPrefInput({
      providerId: 'h',
      wireFormat: 'anthropic',
      modelId: 'm',
      extraHeaders: { 'X-Custom': 'v', 'X-Tier': 'pro' },
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.deepEqual(v.value.extraHeaders, {
      'X-Custom': 'v',
      'X-Tier': 'pro',
    });
  });

  it('drops empty extraHeaders to null', () => {
    const v = validateModelPrefInput({
      providerId: 'h',
      wireFormat: 'anthropic',
      modelId: 'm',
      extraHeaders: {},
    });
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.value.extraHeaders, null);
  });
});

describe('validateModelPrefInput — denials', () => {
  it('rejects non-object input', () => {
    assert.equal(validateModelPrefInput(null).ok, false);
    assert.equal(validateModelPrefInput(undefined).ok, false);
    assert.equal(validateModelPrefInput('').ok, false);
    assert.equal(validateModelPrefInput(42).ok, false);
  });

  it('rejects empty providerId', () => {
    const v = validateModelPrefInput({
      providerId: '',
      wireFormat: 'anthropic',
      modelId: 'm',
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.field, 'providerId');
  });

  it('rejects unknown wireFormat', () => {
    const v = validateModelPrefInput({
      providerId: 'p',
      wireFormat: 'gemini',
      modelId: 'm',
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'invalid-wire-format');
  });

  it('requires endpoint for openai-compat / ollama / custom-http', () => {
    for (const wf of ['openai-compat', 'ollama', 'custom-http']) {
      const v = validateModelPrefInput({
        providerId: 'p',
        wireFormat: wf,
        modelId: 'm',
      });
      assert.equal(v.ok, false, `${wf} should require endpoint`);
      if (v.ok) return;
      assert.equal(v.reason, 'endpoint-required');
    }
  });

  it('rejects non-http endpoint URL', () => {
    const v = validateModelPrefInput({
      providerId: 'p',
      wireFormat: 'ollama',
      modelId: 'm',
      endpointUrl: 'ftp://x',
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'endpoint-not-http');
  });

  it('rejects api-key env-var with bad shape', () => {
    const v = validateModelPrefInput({
      providerId: 'p',
      wireFormat: 'anthropic',
      modelId: 'm',
      apiKeyEnvVar: 'sk-secret-value',
    });
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'api-key-env-var-shape');
  });

  it('rejects extraHeaders with non-string values', () => {
    const v = validateModelPrefInput({
      providerId: 'p',
      wireFormat: 'anthropic',
      modelId: 'm',
      extraHeaders: { 'X-N': 42 },
    });
    assert.equal(v.ok, false);
  });
});

describe('WIRE_FORMAT_DEFAULTS', () => {
  it('has an entry for every wire format', () => {
    for (const wf of ['anthropic', 'openai-compat', 'ollama', 'custom-http'] as const) {
      assert.ok(WIRE_FORMAT_DEFAULTS[wf], `missing default for ${wf}`);
      assert.ok(typeof WIRE_FORMAT_DEFAULTS[wf].modelId === 'string');
    }
  });
});
