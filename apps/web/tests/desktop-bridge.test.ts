// apps/web/tests/desktop-bridge.test.ts
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { isTauri, safeInvoke } from '../src/lib/desktop-bridge.js';

// We simulate the Tauri global via the window.__TAURI_INTERNALS__ marker
// (Tauri 2 injects this; absence = browser env).
const W = globalThis as unknown as Record<string, unknown>;

describe('desktop-bridge', () => {
  afterEach(() => {
    delete W['__TAURI_INTERNALS__'];
  });

  test('isTauri returns false in plain Node / browser env', () => {
    assert.equal(isTauri(), false);
  });

  test('isTauri returns true when Tauri injects globals', () => {
    W['__TAURI_INTERNALS__'] = { invoke: () => {} };
    assert.equal(isTauri(), true);
  });

  test('safeInvoke returns null when not in Tauri', async () => {
    const out = await safeInvoke<{ a: number }>('detect_ollama_available');
    assert.equal(out, null);
  });

  test('safeInvoke calls __TAURI_INTERNALS__.invoke when in Tauri', async () => {
    let captured = '';
    W['__TAURI_INTERNALS__'] = {
      invoke: async (cmd: string) => {
        captured = cmd;
        return { available: true };
      },
    };
    const out = await safeInvoke<{ available: boolean }>(
      'detect_ollama_available',
    );
    assert.equal(captured, 'detect_ollama_available');
    assert.deepEqual(out, { available: true });
  });

  test('safeInvoke catches invoke errors → null', async () => {
    W['__TAURI_INTERNALS__'] = {
      invoke: async () => {
        throw new Error('command not found');
      },
    };
    const out = await safeInvoke<{ a: number }>('nonexistent');
    assert.equal(out, null);
  });
});
