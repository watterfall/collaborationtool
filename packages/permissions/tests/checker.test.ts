// Capability checker behavior — covers hasCapability, requireCapability,
// canApplyUpdate, and the connection-mode classification it depends on.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Capability } from '../src/capabilities';
import {
  CapabilityDeniedError,
  canApplyUpdate,
  hasCapability,
  requireCapability,
  type PrincipalContext,
} from '../src/checker';
import { classifyConnectionMode } from '../src/connection-mode';
import { DEFAULT_ROLE_BUNDLES } from '../src/roles';

function ctx(args: {
  principalId?: string;
  doc?: readonly Capability[];
  global?: readonly Capability[];
  perBlock?: ReadonlyMap<string, ReadonlySet<Capability>>;
  expiresAt?: Date | null;
}): PrincipalContext {
  return {
    principalId: args.principalId ?? 'user:test-001',
    documentCapabilities: new Set(args.doc ?? []),
    globalCapabilities: new Set(args.global ?? []),
    perBlockCapabilities: args.perBlock,
    expiresAt: args.expiresAt ?? null,
  };
}

describe('connection mode classification', () => {
  it('returns null when document.read missing', () => {
    const r = classifyConnectionMode(new Set(['block.read']));
    assert.equal(r.mode, null);
    assert.equal(r.reason, 'missing-document.read');
  });

  it('returns reader when only document.read + block.read', () => {
    const r = classifyConnectionMode(
      new Set<Capability>(['document.read', 'block.read']),
    );
    assert.equal(r.mode, 'reader');
  });

  it('returns proposer when block.propose granted but not block.commit', () => {
    const r = classifyConnectionMode(
      new Set<Capability>(['document.read', 'block.read', 'block.propose']),
    );
    assert.equal(r.mode, 'proposer');
  });

  it('returns writer when block.commit granted', () => {
    const r = classifyConnectionMode(
      new Set<Capability>([
        'document.read',
        'block.read',
        'block.commit',
        'block.propose',
      ]),
    );
    assert.equal(r.mode, 'writer');
  });

  it('5 default roles classify per ADR-0002 §2.4 expectations', () => {
    const author = new Set(DEFAULT_ROLE_BUNDLES['paper-author']);
    const reviewer = new Set(DEFAULT_ROLE_BUNDLES['paper-reviewer']);
    const commenter = new Set(DEFAULT_ROLE_BUNDLES['commenter']);
    const inlineEditor = new Set(DEFAULT_ROLE_BUNDLES['inline-editor-agent']);
    const citation = new Set(DEFAULT_ROLE_BUNDLES['citation-agent']);

    assert.equal(classifyConnectionMode(author).mode, 'writer');
    assert.equal(classifyConnectionMode(reviewer).mode, 'proposer');
    assert.equal(classifyConnectionMode(commenter).mode, 'reader');
    // Agents lack `document.read` in their default bundle (they get it
    // by being granted on a specific doc) — without it they're rejected.
    assert.equal(classifyConnectionMode(inlineEditor).mode, null);
    assert.equal(classifyConnectionMode(citation).mode, null);
  });
});

describe('hasCapability', () => {
  it('global: matches against globalCapabilities only', () => {
    const c = ctx({ global: ['document.create'] });
    assert.ok(
      hasCapability(c, { verb: 'document.create', resourceType: 'global' }),
    );
    // document.create is on global, not document — checking under
    // resourceType=document fails because docCaps doesn't have it.
    assert.equal(
      hasCapability(c, {
        verb: 'document.create',
        resourceType: 'document',
        resourceId: 'doc-1',
      }),
      false,
    );
  });

  it('document: matches against documentCapabilities', () => {
    const c = ctx({ doc: ['document.read', 'block.read'] });
    assert.ok(
      hasCapability(c, {
        verb: 'document.read',
        resourceType: 'document',
        resourceId: 'doc-1',
      }),
    );
    assert.equal(
      hasCapability(c, {
        verb: 'document.export',
        resourceType: 'document',
        resourceId: 'doc-1',
      }),
      false,
    );
  });

  it('block: doc-level grant inherits to all blocks (Phase 1)', () => {
    const c = ctx({ doc: ['block.read'] });
    assert.ok(
      hasCapability(c, {
        verb: 'block.read',
        resourceType: 'block',
        resourceId: 'blk-arbitrary',
      }),
    );
  });

  it('block: per-block grant works when doc-level missing', () => {
    const c = ctx({
      perBlock: new Map([['blk-target', new Set<Capability>(['block.commit'])]]),
    });
    assert.ok(
      hasCapability(c, {
        verb: 'block.commit',
        resourceType: 'block',
        resourceId: 'blk-target',
      }),
    );
    assert.equal(
      hasCapability(c, {
        verb: 'block.commit',
        resourceType: 'block',
        resourceId: 'blk-other',
      }),
      false,
    );
  });

  it('expiresAt in the past denies all capabilities', () => {
    const c = ctx({
      doc: ['document.read', 'block.read'],
      expiresAt: new Date(Date.now() - 1000),
    });
    assert.equal(
      hasCapability(c, {
        verb: 'document.read',
        resourceType: 'document',
        resourceId: 'doc-1',
      }),
      false,
    );
  });

  it('expiresAt in the future is fine', () => {
    const c = ctx({
      doc: ['document.read'],
      expiresAt: new Date(Date.now() + 60_000),
    });
    assert.ok(
      hasCapability(c, {
        verb: 'document.read',
        resourceType: 'document',
        resourceId: 'doc-1',
      }),
    );
  });
});

describe('requireCapability', () => {
  it('returns void on grant', () => {
    const c = ctx({ doc: ['document.read'] });
    assert.doesNotThrow(() =>
      requireCapability(c, {
        verb: 'document.read',
        resourceType: 'document',
        resourceId: 'doc-1',
      }),
    );
  });

  it('throws CapabilityDeniedError with reason on missing grant', () => {
    const c = ctx({});
    assert.throws(
      () =>
        requireCapability(c, {
          verb: 'document.read',
          resourceType: 'document',
          resourceId: 'doc-1',
        }),
      (err: unknown) => {
        assert.ok(err instanceof CapabilityDeniedError);
        assert.equal(err.reason, 'no-grant');
        assert.equal(err.requirement.verb, 'document.read');
        return true;
      },
    );
  });

  it('throws with reason=expired when ACL stale', () => {
    const c = ctx({
      doc: ['document.read'],
      expiresAt: new Date(Date.now() - 1000),
    });
    assert.throws(
      () =>
        requireCapability(c, {
          verb: 'document.read',
          resourceType: 'document',
          resourceId: 'doc-1',
        }),
      (err: unknown) => {
        assert.ok(err instanceof CapabilityDeniedError);
        assert.equal(err.reason, 'expired');
        return true;
      },
    );
  });
});

describe('canApplyUpdate (gateway shim)', () => {
  const update = new Uint8Array([1, 2, 3]);

  it('reader is rejected', () => {
    const c = ctx({ doc: ['document.read', 'block.read'] });
    const d = canApplyUpdate(c, 'doc-1', update);
    assert.equal(d.allow, false);
    assert.equal(d.mode, 'reader');
    assert.equal(d.reason, 'reader-cannot-write');
  });

  it('proposer is allowed (gateway routes to draft)', () => {
    const c = ctx({
      doc: ['document.read', 'block.read', 'block.propose'],
    });
    const d = canApplyUpdate(c, 'doc-1', update);
    assert.equal(d.allow, true);
    assert.equal(d.mode, 'proposer');
  });

  it('writer is allowed', () => {
    const c = ctx({
      doc: ['document.read', 'block.read', 'block.commit', 'block.propose'],
    });
    const d = canApplyUpdate(c, 'doc-1', update);
    assert.equal(d.allow, true);
    assert.equal(d.mode, 'writer');
  });

  it('no document.read is fully rejected (not even reader)', () => {
    const c = ctx({});
    const d = canApplyUpdate(c, 'doc-1', update);
    assert.equal(d.allow, false);
    assert.equal(d.mode, null);
  });
});
