// invitations lib — pure helper tests (renderInvitationEmail).
// The createInvitation / acceptInvitation paths require Postgres and
// are exercised by tests/e2e (Phase 1.5 follow-up).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderInvitationEmail } from '../src/lib/invitations';

describe('renderInvitationEmail', () => {
  const baseArgs = {
    inviterDisplayName: '王明',
    documentTitle: 'Foundation Models 中文综述',
    roleId: 'paper-reviewer',
    acceptUrl: 'https://example.com/invite/abc123',
    expiresAt: new Date('2026-05-16T00:00:00Z'),
  };

  it('subject contains inviter + document', () => {
    const out = renderInvitationEmail(baseArgs);
    assert.match(out.subject, /王明/);
    assert.match(out.subject, /Foundation Models 中文综述/);
  });

  it('text body includes the accept URL and expiry date', () => {
    const out = renderInvitationEmail(baseArgs);
    assert.match(out.text, /https:\/\/example\.com\/invite\/abc123/);
    assert.match(out.text, /2026-05-16/);
    assert.match(out.text, /paper-reviewer/);
  });

  it('html body escapes inviter name and url attribute', () => {
    const out = renderInvitationEmail({
      ...baseArgs,
      inviterDisplayName: '<script>alert(1)</script>',
      acceptUrl: 'https://example.com/invite/<bad>',
    });
    assert.doesNotMatch(out.html, /<script>/);
    assert.match(out.html, /&lt;script&gt;/);
    assert.doesNotMatch(out.html, /href="https:\/\/example\.com\/invite\/<bad>"/);
    assert.match(out.html, /href="https:\/\/example\.com\/invite\/&lt;bad&gt;"/);
  });

  it('html body has accept link', () => {
    const out = renderInvitationEmail(baseArgs);
    assert.match(out.html, /<a href="https:\/\/example\.com\/invite\/abc123"/);
  });
});
