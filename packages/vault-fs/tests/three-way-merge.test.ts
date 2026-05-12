import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Y from 'yjs';

import { parseMarkdown } from '../src/markdown-to-ydoc';
import { emitMarkdown } from '../src/ydoc-to-markdown';
import { threeWayMerge } from '../src/three-way-merge';

describe('threeWayMerge (Spike-2 Task 7)', () => {
  it('no conflict: identical base / local / remote → 0 conflicts', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nb\n');
    const remoteMd = '# A\n\nb\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 0);
  });

  it('local-only change: local diverges, remote === base → local wins, no conflict', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nlocal-changed\n');
    const remoteMd = '# A\n\nb\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 0);
    // Materialise merged update to check content.
    const merged = new Y.Doc();
    Y.applyUpdate(merged, r.mergedUpdate);
    assert.match(emitMarkdown(merged), /local-changed/);
  });

  it('remote-only change: remote diverges, local === base → remote wins, no conflict', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nb\n');
    const remoteMd = '# A\n\nremote-changed\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 0);
    const merged = new Y.Doc();
    Y.applyUpdate(merged, r.mergedUpdate);
    assert.match(emitMarkdown(merged), /remote-changed/);
  });

  it('conflict: local and remote both diverge in same paragraph → 1 conflict region', () => {
    const base = parseMarkdown('# A\n\nb\n');
    const local = parseMarkdown('# A\n\nLOCAL\n');
    const remoteMd = '# A\n\nREMOTE\n';
    const r = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.equal(r.conflicts.length, 1);
    const c = r.conflicts[0]!;
    assert.match(c.localContent, /LOCAL/);
    assert.match(c.remoteContent, /REMOTE/);
    assert.match(c.baseContent, /b/);
  });
});
