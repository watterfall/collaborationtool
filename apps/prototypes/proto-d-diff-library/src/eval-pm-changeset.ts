import { ChangeSet } from "prosemirror-changeset";
import { Node as PMNode } from "prosemirror-model";
import { Transform } from "prosemirror-transform";

export interface PMChangesetReport {
  author: string;
  changeCount: number;
  blocksTouched: number[];               // doc-relative block indices
  ranges: Array<{
    fromA: number;
    toA: number;
    fromB: number;
    toB: number;
    deletedText: string;
    insertedText: string;
    deletedHasMarks: string[];           // mark types lost
    insertedHasMarks: string[];          // mark types added
  }>;
}

export function evaluatePmChangeset(
  base: PMNode,
  revised: PMNode,
  transform: Transform,
  author: string,
): PMChangesetReport {
  const changeset = ChangeSet.create<{ author: string }>(base).addSteps(
    revised,
    transform.mapping.maps,
    { author },
  );
  const blocksTouched = new Set<number>();
  const ranges = changeset.changes.map((change) => {
    const deletedSlice = base.slice(change.fromA, change.toA);
    const insertedSlice = revised.slice(change.fromB, change.toB);
    const deletedText = deletedSlice.content.textBetween(0, deletedSlice.content.size, " ");
    const insertedText = insertedSlice.content.textBetween(0, insertedSlice.content.size, " ");
    blocksTouched.add(blockIndexFor(base, change.fromA));
    return {
      fromA: change.fromA,
      toA: change.toA,
      fromB: change.fromB,
      toB: change.toB,
      deletedText,
      insertedText,
      deletedHasMarks: collectMarkTypes(deletedSlice.content),
      insertedHasMarks: collectMarkTypes(insertedSlice.content),
    };
  });
  return {
    author,
    changeCount: changeset.changes.length,
    blocksTouched: [...blocksTouched].sort((a, b) => a - b),
    ranges,
  };
}

function blockIndexFor(doc: PMNode, pos: number): number {
  let i = 0;
  let acc = 0;
  let foundIndex = -1;
  doc.forEach((child, offset) => {
    if (foundIndex >= 0) return;
    const start = offset;
    const end = offset + child.nodeSize;
    if (pos >= start && pos <= end) foundIndex = i;
    i += 1;
    acc = end;
  });
  if (foundIndex < 0) foundIndex = i - 1; // tail edits land in the last block
  void acc;
  return foundIndex;
}

function collectMarkTypes(content: PMNode["content"]): string[] {
  const seen = new Set<string>();
  content.descendants((node) => {
    if (node.isText) {
      for (const m of node.marks) seen.add(m.type.name);
    }
    return true;
  });
  return [...seen].sort();
}
