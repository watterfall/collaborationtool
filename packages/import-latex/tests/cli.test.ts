// Phase 2.5: mystmd CLI subprocess wrapper tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LatexImportError, probeMystBinary, runMystExport } from '../src/index';

describe('probeMystBinary', () => {
  it('returns null when binary missing', async () => {
    const v = await probeMystBinary('definitely-not-myst-12345');
    assert.equal(v, null);
  });

  it('returns version when MYST_BINARY env set (CI/dev gate)', async () => {
    if (!process.env['MYST_BINARY']) return; // skip
    const v = await probeMystBinary(process.env['MYST_BINARY']);
    assert.ok(v);
  });
});

describe('runMystExport', () => {
  it('throws LatexImportError(binary-missing) when binary not on PATH', async () => {
    await assert.rejects(
      () =>
        runMystExport({
          binary: 'definitely-not-myst-12345',
          entryPath: '/tmp/nonexistent.tex',
        }),
      (err: Error) =>
        err instanceof LatexImportError && err.reason === 'binary-missing',
    );
  });
});
