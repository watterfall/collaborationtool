import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  toggleLocalAi,
  getDefaultMenuState,
  isLocalAiEnabled,
} from '../src/lib/inline-agent-menu.js';

describe('inline-agent-menu localAi toggle', () => {
  test('default state has localAi disabled', () => {
    const st = getDefaultMenuState();
    assert.equal(isLocalAiEnabled(st), false);
  });

  test('toggleLocalAi flips the flag', () => {
    const st0 = getDefaultMenuState();
    const st1 = toggleLocalAi(st0);
    assert.equal(isLocalAiEnabled(st1), true);
    const st2 = toggleLocalAi(st1);
    assert.equal(isLocalAiEnabled(st2), false);
  });

  test('toggleLocalAi preserves other state fields', () => {
    const st0 = { ...getDefaultMenuState(), prompt: 'hello' };
    const st1 = toggleLocalAi(st0);
    assert.equal((st1 as { prompt: string }).prompt, 'hello');
  });
});
