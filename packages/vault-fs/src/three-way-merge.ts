// Three-way merge — diff3-style line-based merge over markdown emit.
//
// Spike-2 simplified strategy: line-based naive diff (NOT Yjs operational
// merge — that's the Phase 6 W3-W4 goal). Spike-2 only proves we can
// surface conflicts; merged Y.Doc is base + auto-applied non-conflict
// hunks; conflict regions are left for the UI.
//
// Strategy:
//   1. emit base / local to markdown, take remote as-is markdown
//   2. diff base→local and base→remote line-by-line
//   3. overlap of divergent ranges = conflict
//   4. non-overlap auto-apply (local hunks + remote hunks, preferring local
//      on conflict per Spike-2 simplification)
//   5. parse merged markdown back to Y.Doc → encode as update

import * as Y from 'yjs';

import { emitMarkdown } from './ydoc-to-markdown';
import { parseMarkdown } from './markdown-to-ydoc';
import type { ConflictRegion, ThreeWayMergeResult } from './_shared';

export interface ThreeWayMergeInput {
  /** Common ancestor (typically the last-synced sidecar's Y.Doc). */
  base: Y.Doc;
  /** Current in-memory Y.Doc (user's local edits since base). */
  local: Y.Doc;
  /** Remote / external markdown (VS Code edit, git pull, etc). */
  remoteMarkdown: string;
}

interface DiffHunk {
  baseStart: number;
  baseEnd: number;
  baseLines: readonly string[];
  newLines: readonly string[];
}

function splitLines(s: string): string[] {
  if (s.length === 0) return [];
  return s.split('\n');
}

// Naive diff: walk lines in parallel; where they differ, collect a
// divergent block until both sides re-align. Spike-2 PoC quality; Phase 6
// W3-W4 swaps to Myers diff.
function naiveDiff(base: readonly string[], next: readonly string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const maxLen = Math.max(base.length, next.length);
  let i = 0;
  while (i < maxLen) {
    if (base[i] === next[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i < maxLen && base[i] !== next[i]) i++;
    hunks.push({
      baseStart: start,
      baseEnd: i,
      baseLines: base.slice(start, i),
      newLines: next.slice(start, i),
    });
  }
  return hunks;
}

export function threeWayMerge(input: ThreeWayMergeInput): ThreeWayMergeResult {
  const baseLines = splitLines(emitMarkdown(input.base));
  const localLines = splitLines(emitMarkdown(input.local));
  const remoteLines = splitLines(input.remoteMarkdown);

  const localDiff = naiveDiff(baseLines, localLines);
  const remoteDiff = naiveDiff(baseLines, remoteLines);

  const conflicts: ConflictRegion[] = [];
  for (const lh of localDiff) {
    for (const rh of remoteDiff) {
      // Overlapping divergent ranges = conflict.
      if (!(lh.baseEnd <= rh.baseStart || rh.baseEnd <= lh.baseStart)) {
        conflicts.push({
          startLineNumber: Math.min(lh.baseStart, rh.baseStart) + 1,
          endLineNumber: Math.max(lh.baseEnd, rh.baseEnd),
          baseContent: baseLines.slice(lh.baseStart, lh.baseEnd).join('\n'),
          localContent: lh.newLines.join('\n'),
          remoteContent: rh.newLines.join('\n'),
        });
      }
    }
  }

  // Merge strategy (Spike-2): start from base, apply non-conflicting hunks
  // from both sides. Where both sides diverge in the same range, prefer
  // local (Spike-2 simplification — Phase 6 W3-W4 UI lets user pick).
  // Build a unified hunk list keyed by baseStart; on conflict (same
  // baseStart in both), local wins.
  const hunkByStart = new Map<number, DiffHunk>();
  // Apply remote first, then overwrite with local where they overlap.
  for (const h of remoteDiff) hunkByStart.set(h.baseStart, h);
  for (const h of localDiff) hunkByStart.set(h.baseStart, h);
  const allHunks = Array.from(hunkByStart.values()).sort((a, b) => a.baseStart - b.baseStart);

  const out: string[] = [];
  let cursor = 0;
  for (const h of allHunks) {
    while (cursor < h.baseStart) {
      out.push(baseLines[cursor]!);
      cursor++;
    }
    out.push(...h.newLines);
    cursor = h.baseEnd;
  }
  while (cursor < baseLines.length) {
    out.push(baseLines[cursor]!);
    cursor++;
  }

  const mergedMd = out.join('\n');
  const merged = parseMarkdown(mergedMd);
  return {
    mergedUpdate: Y.encodeStateAsUpdate(merged),
    conflicts,
  };
}
