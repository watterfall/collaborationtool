// Drift detector — compares emit(yDoc) against on-disk markdown content
// via sha256 hashes. Spike-2 baseline does NOT canonicalise (trailing
// blanks count as drift); Phase 6 W3-W4 will add a canonical normalizer.

import { createHash } from 'node:crypto';
import * as Y from 'yjs';

import { emitMarkdown } from './ydoc-to-markdown';
import type { DriftReport } from './_shared';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface DetectDriftInput {
  yDoc: Y.Doc;
  markdownFileContent: string;
}

export function detectDrift(input: DetectDriftInput): DriftReport {
  const emitted = emitMarkdown(input.yDoc);
  const markdownHash = sha256Hex(input.markdownFileContent);
  const emittedHash = sha256Hex(emitted);
  return {
    markdownHash,
    emittedHash,
    drifted: markdownHash !== emittedHash,
  };
}
