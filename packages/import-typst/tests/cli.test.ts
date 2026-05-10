// Phase 2.5: typst CLI subprocess wrapper tests. Pure shape verification
// + graceful fallback (binary-missing). Real `typst query` round-trip
// is gated on a CI image with typst installed (TYPST_BINARY env).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TypstImportError,
  probeTypstBinary,
  runTypstQuery,
} from '../src/index';

describe('probeTypstBinary', () => {
  it('returns null when binary missing', async () => {
    const v = await probeTypstBinary('definitely-not-typst-12345');
    assert.equal(v, null);
  });

  it('returns version string when binary present (CI/dev only)', async () => {
    if (!process.env['TYPST_BINARY']) {
      // Skip when no typst on host — gate via env.
      return;
    }
    const v = await probeTypstBinary(process.env['TYPST_BINARY']);
    assert.ok(v);
    assert.match(v!, /typst/i);
  });
});

describe('runTypstQuery', () => {
  it('throws TypstImportError(binary-missing) when binary not on PATH', async () => {
    await assert.rejects(
      () =>
        runTypstQuery({
          binary: 'definitely-not-typst-12345',
          selector: 'heading',
          entryPath: '/tmp/nonexistent.typ',
        }),
      (err: Error) =>
        err instanceof TypstImportError && err.reason === 'binary-missing',
    );
  });
});
