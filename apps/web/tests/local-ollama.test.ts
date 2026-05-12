import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectOllamaInBrowser,
  chatCompletion,
  parseStreamChunk,
  type OllamaChatRequest,
} from '../src/lib/local-ollama.js';

// fetch mocking via global override
const originalFetch = globalThis.fetch;

describe('local-ollama', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('detectOllamaInBrowser returns true when /api/tags 200', async () => {
    globalThis.fetch = (async () =>
      new Response('{"models":[]}', { status: 200 })) as typeof fetch;
    const ok = await detectOllamaInBrowser();
    assert.equal(ok, true);
  });

  test('detectOllamaInBrowser returns false when fetch throws', async () => {
    globalThis.fetch = (async () => {
      throw new Error('NetworkError');
    }) as typeof fetch;
    const ok = await detectOllamaInBrowser();
    assert.equal(ok, false);
  });

  test('detectOllamaInBrowser returns false when 500', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 500 })) as typeof fetch;
    const ok = await detectOllamaInBrowser();
    assert.equal(ok, false);
  });

  test('chatCompletion POSTs to /api/chat with body', async () => {
    const captured: { url?: string; body?: string } = {};
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      captured.url = String(url);
      captured.body = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          message: { role: 'assistant', content: 'hi' },
          done: true,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const req: OllamaChatRequest = {
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }],
    };
    const resp = await chatCompletion(req);

    assert.equal(captured.url, 'http://localhost:11434/api/chat');
    assert.match(captured.body!, /llama3/);
    assert.match(captured.body!, /hello/);
    assert.equal(resp.message.content, 'hi');
  });

  test('parseStreamChunk extracts content from NDJSON', () => {
    const line = JSON.stringify({
      message: { role: 'assistant', content: 'wor' },
      done: false,
    });
    const out = parseStreamChunk(line);
    assert.equal(out?.content, 'wor');
    assert.equal(out?.done, false);
  });

  test('parseStreamChunk returns null on malformed line', () => {
    const out = parseStreamChunk('not-json');
    assert.equal(out, null);
  });
});
