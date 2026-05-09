// mailer lib tests — verifies env routing + webhook payload shape.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sendEmail, type MailerEnv } from '../src/lib/mailer';

interface MockFetchCall {
  url: string;
  init: RequestInit;
}

function mockFetch(status = 200, body = 'ok'): {
  fetch: typeof fetch;
  calls: MockFetchCall[];
} {
  const calls: MockFetchCall[] = [];
  const fn = ((url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(new Response(body, { status }));
  }) as unknown as typeof fetch;
  return { fetch: fn, calls };
}

describe('sendEmail', () => {
  it('returns console backend when MAIL_WEBHOOK_URL unset', async () => {
    const result = await sendEmail(
      { to: 'x@x.com', subject: 's', html: 'h', text: 't' },
      {},
      mockFetch().fetch,
    );
    assert.equal(result.backend, 'console');
  });

  it('POSTs JSON to webhook with bearer token when set', async () => {
    const m = mockFetch();
    const env: MailerEnv = {
      webhookUrl: 'https://mail.example/send',
      webhookAuth: 'tok-abc',
      fromAddress: 'noreply@example.com',
    };
    const result = await sendEmail(
      { to: 'a@example.com', subject: 'Hi', html: '<b>Hi</b>', text: 'Hi' },
      env,
      m.fetch,
    );
    assert.deepEqual(result, { backend: 'webhook', status: 200 });
    assert.equal(m.calls.length, 1);
    const call = m.calls[0]!;
    assert.equal(call.url, 'https://mail.example/send');
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['authorization'], 'Bearer tok-abc');
    const payload = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    assert.equal(payload.to, 'a@example.com');
    assert.equal(payload.subject, 'Hi');
    assert.equal(payload.from, 'noreply@example.com');
    assert.equal(payload.html, '<b>Hi</b>');
  });

  it('throws when webhook returns non-2xx', async () => {
    const m = mockFetch(500, 'boom');
    const env: MailerEnv = { webhookUrl: 'https://mail.example/send' };
    await assert.rejects(
      () =>
        sendEmail(
          { to: 'a@x.com', subject: 's', html: 'h', text: 't' },
          env,
          m.fetch,
        ),
      /mail webhook 500/,
    );
  });
});
