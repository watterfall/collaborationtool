// Phase 2 W4 ADR-0007: molab postMessage protocol parser tests.
//
// Coverage:
//   - 6 message kinds (3 outbound + 4 inbound, kind enumerations align)
//   - protocol-version envelope strictness
//   - artifact-byte and artifact-count limits
//   - progress fraction range + stderrTail length
//   - cell.cancel kind
//   - asCellEvalId nullability check

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ARTIFACT_BYTE_LIMIT,
  ARTIFACT_COUNT_LIMIT,
  PROTOCOL_VERSION,
  ProtocolError,
  STDERR_TAIL_LIMIT,
  asCellEvalId,
  parseInbound,
  parseOutbound,
  type CellExecutedPayload,
} from '../src/index';

describe('isAnyMessage / envelope', () => {
  it('rejects non-v1 envelope', () => {
    assert.throws(() => parseInbound({ v: 2, kind: 'cell.ready', payload: {} }), ProtocolError);
    assert.throws(() => parseOutbound({ kind: 'cell.config' }), ProtocolError);
    assert.throws(() => parseInbound(null), ProtocolError);
  });
});

describe('parseInbound', () => {
  it('accepts cell.ready', () => {
    const m = parseInbound({
      v: PROTOCOL_VERSION,
      kind: 'cell.ready',
      payload: { kernelVersion: '0.10.1' },
    });
    assert.equal(m.kind, 'cell.ready');
  });

  it('accepts cell.executed within limits', () => {
    const m = parseInbound({
      v: PROTOCOL_VERSION,
      kind: 'cell.executed',
      payload: {
        cellEvalId: asCellEvalId('eval-1'),
        artifacts: [{ type: 'image/png', body: 'AAAA', byteLength: 4 }],
      } satisfies CellExecutedPayload,
    });
    assert.equal(m.kind, 'cell.executed');
  });

  it('rejects cell.executed exceeding ARTIFACT_BYTE_LIMIT', () => {
    assert.throws(
      () =>
        parseInbound({
          v: PROTOCOL_VERSION,
          kind: 'cell.executed',
          payload: {
            cellEvalId: 'eval-1',
            artifacts: [
              { type: 'image/png', body: 'x', byteLength: ARTIFACT_BYTE_LIMIT + 1 },
            ],
          },
        }),
      (err: Error) => err instanceof ProtocolError && /byteLength/.test(err.message),
    );
  });

  it('rejects cell.executed exceeding ARTIFACT_COUNT_LIMIT', () => {
    const arts = Array.from({ length: ARTIFACT_COUNT_LIMIT + 1 }, () => ({
      type: 'text/plain' as const,
      body: 'x',
      byteLength: 1,
    }));
    assert.throws(
      () =>
        parseInbound({
          v: PROTOCOL_VERSION,
          kind: 'cell.executed',
          payload: { cellEvalId: 'eval-1', artifacts: arts },
        }),
      (err: Error) => err instanceof ProtocolError && /too many artifacts/.test(err.message),
    );
  });

  it('rejects cell.progress fraction out of [0,1]', () => {
    assert.throws(
      () =>
        parseInbound({
          v: PROTOCOL_VERSION,
          kind: 'cell.progress',
          payload: { cellEvalId: 'eval-1', fraction: 1.5 },
        }),
      (err: Error) => err instanceof ProtocolError && /fraction out of/.test(err.message),
    );
  });

  it('rejects cell.progress stderrTail too long', () => {
    assert.throws(
      () =>
        parseInbound({
          v: PROTOCOL_VERSION,
          kind: 'cell.progress',
          payload: {
            cellEvalId: 'eval-1',
            fraction: 0.5,
            stderrTail: 'x'.repeat(STDERR_TAIL_LIMIT + 1),
          },
        }),
      (err: Error) => err instanceof ProtocolError && /stderrTail length/.test(err.message),
    );
  });

  it('rejects unknown inbound kind', () => {
    assert.throws(
      () =>
        parseInbound({
          v: PROTOCOL_VERSION,
          kind: 'cell.weird',
          payload: {},
        }),
      (err: Error) => err instanceof ProtocolError && /unknown kind/.test(err.message),
    );
  });
});

describe('parseOutbound', () => {
  it('accepts cell.config / cell.execute / cell.cancel', () => {
    parseOutbound({
      v: PROTOCOL_VERSION,
      kind: 'cell.config',
      payload: { authToken: 'token', datasetUrls: [] },
    });
    parseOutbound({
      v: PROTOCOL_VERSION,
      kind: 'cell.execute',
      payload: { sourceCode: 'print(1)', sourceLanguage: 'python', cellEvalId: 'e' },
    });
    parseOutbound({
      v: PROTOCOL_VERSION,
      kind: 'cell.cancel',
      payload: { cellEvalId: 'e' },
    });
  });

  it('rejects unknown outbound kind', () => {
    assert.throws(
      () =>
        parseOutbound({
          v: PROTOCOL_VERSION,
          kind: 'cell.deploy',
          payload: {},
        }),
      ProtocolError,
    );
  });
});

describe('asCellEvalId', () => {
  it('rejects empty', () => {
    assert.throws(() => asCellEvalId(''), ProtocolError);
  });
  it('returns brand on non-empty', () => {
    const id = asCellEvalId('eval-abc');
    assert.equal(String(id), 'eval-abc');
  });
});
