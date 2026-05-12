import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMarkdown } from '../src/markdown-to-ydoc';
import { emitMarkdown } from '../src/ydoc-to-markdown';

describe('parseMarkdown (Spike-2 Task 3)', () => {
  it('empty string → empty Y.Doc', () => {
    const doc = parseMarkdown('');
    assert.equal(emitMarkdown(doc), '');
  });

  it('single paragraph round-trips through Y.Doc', () => {
    const md = 'hello world\n';
    const doc = parseMarkdown(md);
    assert.equal(emitMarkdown(doc).trim(), 'hello world');
  });

  it('heading + paragraph round-trips', () => {
    const md = '# Intro\n\nbody\n';
    const doc = parseMarkdown(md);
    const emitted = emitMarkdown(doc);
    assert.match(emitted, /^# Intro/m);
    assert.match(emitted, /^body$/m);
  });

  it('emit(parse(emit(parse(md)))) === emit(parse(md)) — stable under double round-trip', () => {
    const md = '# Title\n\npara 1\n\npara 2\n';
    const a = emitMarkdown(parseMarkdown(md));
    const b = emitMarkdown(parseMarkdown(a));
    assert.equal(a, b);
  });

  it('preserves custom-node HTML comments (claim placeholder)', () => {
    const md = 'before\n\n<!-- claim {"id":"c1","text":"x"} -->\n\nafter\n';
    const doc = parseMarkdown(md);
    // Spike-2: custom nodes go through as raw HTML in parse path;
    // emitMarkdown will preserve them verbatim. Phase 6 W3-W4 swap to
    // markdown directive parsing.
    const emitted = emitMarkdown(doc);
    assert.match(emitted, /<!-- claim/);
  });
});
