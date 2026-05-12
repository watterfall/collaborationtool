import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMarkdown } from '../src/markdown-to-ydoc';
import { emitMarkdown } from '../src/ydoc-to-markdown';
import { detectDrift } from '../src/drift-detector';

describe('detectDrift (Spike-2 Task 6)', () => {
  it('no drift when markdown matches emit', () => {
    // Use the emit of parse(md) as the canonical "on-disk" form so the
    // hash comparison is apples-to-apples.
    const md = '# Hello\n\nbody\n';
    const doc = parseMarkdown(md);
    const canonical = emitMarkdown(doc);
    const r = detectDrift({ yDoc: doc, markdownFileContent: canonical });
    assert.equal(r.markdownHash, r.emittedHash);
    assert.equal(r.drifted, false);
  });

  it('drift when external edit changes markdown', () => {
    const md = '# Hello\n\nbody\n';
    const doc = parseMarkdown(md);
    const changed = '# Hello\n\nNEW body\n';
    const r = detectDrift({ yDoc: doc, markdownFileContent: changed });
    assert.notEqual(r.markdownHash, r.emittedHash);
    assert.equal(r.drifted, true);
  });

  it('canonicalises emit before comparing (trailing whitespace etc)', () => {
    const doc = parseMarkdown('# Hello\n');
    const fileWithTrailing = '# Hello\n\n\n'; // extra blank lines
    const r = detectDrift({ yDoc: doc, markdownFileContent: fileWithTrailing });
    // Drift expected here in Spike-2 — Phase 6 will add canonical normalizer
    // that trims trailing blanks. Test pins current behavior so future work
    // (canonicalizer) flips the assertion intentionally.
    assert.equal(r.drifted, true, 'Spike-2: pre-canonicaliser baseline');
  });
});
