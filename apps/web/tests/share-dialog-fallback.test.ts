// Phase 4 W6.5 — ShareDialog email fallback helpers.
//
// `.brainstorm/role-user.md §2`：MAIL_WEBHOOK_URL 没配时，acceptUrl 只
// 落在 server stderr。ShareDialog 必须在 `email.backend !== 'webhook'`
// 时把链接渲染出来 + 一键复制 + 中英双语提示。
//
// 这里用 node:test + tsx 跑纯逻辑（统一 helper 模块）。React 渲染层由
// 集成 / e2e 测试覆盖；本文件锁定的是 backend → tone / showCopyAffordance
// / 文案 / clipboard 旁路这四件事。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COPY_BUTTON_LABEL,
  copyTextToClipboard,
  isFallbackBackend,
  shareDialogStatusCopy,
} from '../src/lib/share-dialog-fallback';

describe('isFallbackBackend', () => {
  it('webhook backend is NOT a fallback', () => {
    assert.equal(isFallbackBackend('webhook'), false);
  });

  it('console backend is a fallback', () => {
    assert.equal(isFallbackBackend('console'), true);
  });

  it('console-fallback explicit tag is a fallback', () => {
    assert.equal(isFallbackBackend('console-fallback'), true);
  });

  it('undefined / unknown backend defaults to fallback (fail safe)', () => {
    assert.equal(isFallbackBackend(undefined), true);
    assert.equal(isFallbackBackend('mystery-relay'), true);
  });
});

describe('shareDialogStatusCopy — webhook', () => {
  const copy = shareDialogStatusCopy('webhook');

  it('uses emerald tone (success delivered)', () => {
    assert.equal(copy.tone, 'emerald');
  });

  it('headline mentions invitation sent in 中英双语', () => {
    assert.match(copy.headline, /邀请已发送/);
    assert.match(copy.headline, /Invitation sent/);
  });

  it('body explains email was sent (no manual-copy demand)', () => {
    assert.match(copy.body, /已经把邀请邮件发给受邀人/);
    assert.match(copy.body, /invitation email has been sent/i);
  });

  it('still surfaces a copy affordance for owner backup', () => {
    assert.equal(copy.showCopyAffordance, true);
  });
});

describe('shareDialogStatusCopy — fallback (no MAIL_WEBHOOK_URL)', () => {
  const copy = shareDialogStatusCopy('console');

  it('uses amber tone to flag manual action required', () => {
    assert.equal(copy.tone, 'amber');
  });

  it('headline says mail backend not configured in 中英双语', () => {
    assert.match(copy.headline, /邮件服务未配置/);
    assert.match(copy.headline, /Mail backend not configured/);
  });

  it('body instructs the owner to send the link manually (中英双语)', () => {
    assert.match(copy.body, /手动发送给受邀人/);
    assert.match(copy.body, /send it to the invitee manually/i);
  });

  it('forces showCopyAffordance — acceptUrl must be reachable from UI', () => {
    assert.equal(copy.showCopyAffordance, true);
  });

  it('treats undefined backend the same as console fallback', () => {
    const c2 = shareDialogStatusCopy(undefined);
    assert.equal(c2.tone, 'amber');
    assert.equal(c2.showCopyAffordance, true);
  });

  it('treats explicit console-fallback tag the same way', () => {
    const c3 = shareDialogStatusCopy('console-fallback');
    assert.equal(c3.tone, 'amber');
    assert.match(c3.headline, /Mail backend not configured/);
  });
});

describe('COPY_BUTTON_LABEL', () => {
  it('exposes 中英双语 idle / copying / copied / failed states', () => {
    for (const v of [
      COPY_BUTTON_LABEL.idle,
      COPY_BUTTON_LABEL.copying,
      COPY_BUTTON_LABEL.copied,
      COPY_BUTTON_LABEL.failed,
    ]) {
      assert.match(v, /[一-鿿]/, `expected 中文 in ${JSON.stringify(v)}`);
      assert.match(v, /[A-Za-z]/, `expected English in ${JSON.stringify(v)}`);
    }
  });

  it('idle label says "复制邀请链接 / Copy link"', () => {
    assert.match(COPY_BUTTON_LABEL.idle, /复制邀请链接/);
    assert.match(COPY_BUTTON_LABEL.idle, /Copy link/);
  });
});

describe('copyTextToClipboard', () => {
  it('returns true when clipboard.writeText resolves', async () => {
    const calls: string[] = [];
    const ok = await copyTextToClipboard('https://example.com/invite/abc', {
      writeText: async (s) => {
        calls.push(s);
      },
    });
    assert.equal(ok, true);
    assert.deepEqual(calls, ['https://example.com/invite/abc']);
  });

  it('returns false when clipboard rejects (e.g. permission denied)', async () => {
    const ok = await copyTextToClipboard('x', {
      writeText: async () => {
        throw new Error('NotAllowedError');
      },
    });
    assert.equal(ok, false);
  });

  it('returns false when clipboard API is unavailable (older browser)', async () => {
    const ok = await copyTextToClipboard('x', undefined);
    assert.equal(ok, false);
  });

  it('returns false when writeText is not a function (malformed shim)', async () => {
    // Cast through unknown — emulating a hostile / partial polyfill.
    const ok = await copyTextToClipboard(
      'x',
      { writeText: undefined as unknown as (s: string) => Promise<void> },
    );
    assert.equal(ok, false);
  });
});
