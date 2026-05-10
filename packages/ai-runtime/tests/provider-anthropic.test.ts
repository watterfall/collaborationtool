// Phase 3 W7 ADR-0013: Anthropic provider adapter shape tests.
// We don't call the real Anthropic API; the adapter is exercised in
// agents-with-pg integration test if ANTHROPIC_API_KEY is set
// (existing path). These tests verify config/error shape only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createAnthropicProvider,
  ProviderError,
  type ModelProvider,
} from '../src/providers';

describe('createAnthropicProvider', () => {
  it('throws ProviderError(config-invalid) without apiKey', () => {
    assert.throws(
      () => createAnthropicProvider({ id: 'anthropic-test' }),
      (err: Error) =>
        err instanceof ProviderError && err.code === 'config-invalid',
    );
  });

  it('returns a ModelProvider with correct features', () => {
    const provider: ModelProvider = createAnthropicProvider({
      id: 'anthropic-test',
      apiKey: 'sk-test-fake',
    });
    assert.equal(provider.id, 'anthropic-test');
    assert.equal(provider.wireFormat, 'anthropic');
    assert.equal(provider.features.toolUse, true);
    assert.equal(provider.features.systemPrompt, true);
    assert.equal(provider.features.streaming, true);
    assert.equal(provider.features.visionInput, true);
    assert.ok(provider.features.approxContextTokens >= 100_000);
  });

  it('respects custom label / endpointUrl / headers', () => {
    const provider = createAnthropicProvider({
      id: 'anthropic-via-proxy',
      label: 'Anthropic (proxy)',
      apiKey: 'sk-test',
      endpointUrl: 'https://internal-llm-gateway.corp/api',
      headers: { 'x-corp-tenant': 'team-foo' },
    });
    assert.equal(provider.label, 'Anthropic (proxy)');
    // endpointUrl + headers are stored in the underlying Anthropic client
    // — testing those without instantiating the SDK requires mocking;
    // we check the runAgent function exists and is callable shape.
    assert.equal(typeof provider.runAgent, 'function');
  });
});

describe('ProviderError', () => {
  it('preserves code and message', () => {
    const e = new ProviderError('rate-limited', 'too many requests');
    assert.equal(e.name, 'ProviderError');
    assert.equal(e.code, 'rate-limited');
    assert.equal(e.message, 'too many requests');
    assert.ok(e instanceof Error);
  });
});
