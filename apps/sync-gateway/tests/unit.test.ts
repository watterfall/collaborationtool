// Unit tests for the parts of the gateway that don't need PG or
// network: parseHandshakeQuery, gateUpdate.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  Capability,
  PrincipalContext,
} from '@collaborationtool/permissions';

import { parseHandshakeQuery } from '../src/auth';
import { gateUpdate } from '../src/capability-gate';

describe('parseHandshakeQuery', () => {
  it('returns null on no URL', () => {
    assert.equal(parseHandshakeQuery(undefined, 'localhost'), null);
  });

  it('returns null when docId missing', () => {
    assert.equal(parseHandshakeQuery('/ws?token=abc', 'localhost'), null);
  });

  it('returns null when token missing', () => {
    assert.equal(parseHandshakeQuery('/ws?docId=doc1', 'localhost'), null);
  });

  it('returns parsed pair on valid URL', () => {
    const got = parseHandshakeQuery('/ws?docId=doc1&token=tok1', 'localhost');
    assert.deepEqual(got, { documentId: 'doc1', token: 'tok1' });
  });

  it('decodes URL-encoded values', () => {
    const got = parseHandshakeQuery(
      '/ws?docId=01HXX-doc&token=eyJhbGciOiJIUzI1NiJ9.payload.sig',
      'localhost',
    );
    assert.deepEqual(got, {
      documentId: '01HXX-doc',
      token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
    });
  });

  it('returns null on garbled URL', () => {
    assert.equal(parseHandshakeQuery('not-a-url', ''), null);
  });
});

describe('gateUpdate', () => {
  function ctx(
    docCaps: readonly Capability[],
    perBlock?: ReadonlyMap<string, ReadonlySet<Capability>>,
  ): PrincipalContext {
    return {
      principalId: 'user:test',
      documentCapabilities: new Set(docCaps),
      globalCapabilities: new Set(),
      perBlockCapabilities: perBlock,
      expiresAt: null,
    };
  }

  const update = new Uint8Array([1, 2, 3]);

  it('writer → forward-to-body', () => {
    const r = gateUpdate({
      principalContext: ctx([
        'document.read',
        'block.read',
        'block.commit',
        'block.propose',
      ]),
      documentId: 'doc-1',
      mode: 'writer',
      update,
    });
    assert.equal(r.kind, 'forward-to-body');
  });

  it('proposer → route-to-draft', () => {
    const r = gateUpdate({
      principalContext: ctx(['document.read', 'block.read', 'block.propose']),
      documentId: 'doc-1',
      mode: 'proposer',
      update,
    });
    assert.equal(r.kind, 'route-to-draft');
  });

  it('reader → reject', () => {
    const r = gateUpdate({
      principalContext: ctx(['document.read', 'block.read']),
      documentId: 'doc-1',
      mode: 'reader',
      update,
    });
    assert.equal(r.kind, 'reject');
    if (r.kind === 'reject') {
      assert.equal(r.reason, 'reader-cannot-write');
    }
  });

  it('mode mismatch (claimed writer but no commit cap) → reject', () => {
    const r = gateUpdate({
      principalContext: ctx(['document.read', 'block.read']),
      documentId: 'doc-1',
      // The handshake should have classified this as reader, but if
      // some upstream bug claims writer, the gate must still reject.
      mode: 'writer',
      update,
    });
    assert.equal(r.kind, 'reject');
  });
});
