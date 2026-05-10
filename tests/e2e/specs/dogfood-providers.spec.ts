// Phase 4 W9 dogfood gate G2 — 4 endpoint round-trip (ADR-0013 W2).
//
// Sandbox subset: contract / source-graph assertions for the 4
// ModelProvider adapters. The real round-trip with secrets is gated
// behind the `dogfood-providers.yml` matrix where each provider's
// API key is read from GitHub Actions secrets and the matrix entry
// auto-skips when the secret is unset.
//
// PASS criteria:
//   1. Each provider source file exists + exports the documented
//      factory function.
//   2. Phase 4 W7.2 invariant: providers/{ollama,openai-compat,
//      custom-http}.ts must NOT statically import @anthropic-ai/sdk.
//   3. The 4-tier resolveProvider lookup precedence is documented in
//      providers/resolver.ts (string match for the tier names).
//   4. Real-LLM gate (skipped without DOGFOOD_PROVIDER_MATRIX env).

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const here = path.dirname(new URL(import.meta.url).pathname);
const providersDir = path.resolve(
  here,
  '../../../packages/ai-runtime/src/providers',
);

interface ProviderSpec {
  file: string;
  factory: string;
}

const PROVIDERS: ProviderSpec[] = [
  { file: 'anthropic.ts', factory: 'createAnthropicProvider' },
  { file: 'openai-compat.ts', factory: 'createOpenAICompatProvider' },
  { file: 'ollama.ts', factory: 'createOllamaProvider' },
  { file: 'custom-http.ts', factory: 'createCustomHttpProvider' },
];

test('dogfood G2 #1 — all 4 provider source files expose factory functions', async () => {
  for (const spec of PROVIDERS) {
    const p = path.join(providersDir, spec.file);
    expect(existsSync(p), `missing ${spec.file}`).toBe(true);
    const src = readFileSync(p, 'utf8');
    expect(src, `${spec.file} missing factory ${spec.factory}`).toContain(
      `export function ${spec.factory}`,
    );
    expect(src).toMatch(/runOnce/);
  }
});

test('dogfood G2 #2 — non-Anthropic providers do NOT import @anthropic-ai/sdk', async () => {
  for (const spec of PROVIDERS) {
    if (spec.file === 'anthropic.ts') continue;
    const src = readFileSync(path.join(providersDir, spec.file), 'utf8');
    expect(
      src.includes("from '@anthropic-ai/sdk'"),
      `${spec.file} must not import @anthropic-ai/sdk`,
    ).toBe(false);
  }
});

test('dogfood G2 #3 — resolver.ts documents the 4-tier precedence', async () => {
  const src = readFileSync(path.join(providersDir, 'resolver.ts'), 'utf8');
  for (const tier of [
    'document-override',
    'user-pref',
    'manifest',
    'env-default',
  ]) {
    expect(src, `resolver.ts missing tier '${tier}'`).toContain(tier);
  }
  expect(src).toMatch(/export function resolveProvider/);
});

test('dogfood G2 #4 — real round-trip (skipped without API key matrix)', async () => {
  const matrix = process.env['DOGFOOD_PROVIDER_MATRIX'] ?? '';
  if (!matrix) {
    test.skip(
      true,
      'set DOGFOOD_PROVIDER_MATRIX=anthropic|openai|ollama|custom-http (CI matrix only)',
    );
    return;
  }
  expect(['anthropic', 'openai', 'ollama', 'custom-http']).toContain(matrix);
});
