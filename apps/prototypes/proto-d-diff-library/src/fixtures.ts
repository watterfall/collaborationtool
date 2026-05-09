import { Node as PMNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { Transform } from "prosemirror-transform";

import { spikeSchema } from "./schema.js";

// Fixture base doc. Two paragraphs, one citation mark, no fancy nesting.
//
//   §1. We compare CRDTs and OT in §2. Prior work [Smith2020]
//       claimed OT scales better.
//   §2. Our findings invert that claim.
//
// Each "reviewer revision" below mutates this base in a different way so we
// can demonstrate (a) overlay-on-base diffing and (b) cross-reviewer rebase.
export function buildBaseDoc(): PMNode {
  const { schema } = makeState();
  return schema.node("doc", null, [
    schema.node("paragraph", null, [
      schema.text("We compare CRDTs and OT in §2. Prior work "),
      schema.text("[Smith2020]", [schema.marks.cite_inline!.create({ citationKey: "Smith2020" })]),
      schema.text(" claimed OT scales better."),
    ]),
    schema.node("paragraph", null, [
      schema.text("Our findings invert that claim."),
    ]),
  ]);
}

export function makeState() {
  return EditorState.create({ schema: spikeSchema });
}

export interface RevisionFixture {
  author: string;
  description: string;
  build(base: PMNode): { doc: PMNode; transform: Transform };
}

// Reviewer A swaps the inline order ("OT and CRDTs") and replaces the
// citation key. Pure inline edits, single block touched.
export const reviewerA: RevisionFixture = {
  author: "reviewer-A",
  description: "swap CRDT/OT order; update citation key Smith2020 → Smith2023",
  build(base) {
    const tr = new Transform(base);
    // "We compare " is at positions 1..12 inside the first paragraph.
    // Replace "CRDTs and OT" (12..24) with "OT and CRDTs".
    tr.replaceWith(12, 24, base.type.schema.text("OT and CRDTs"));
    // After the replace, find the cite mark and swap the key + visible label.
    // The citation text "[Smith2020]" sits after the structural prefix.
    const newDoc = tr.doc;
    const citeFromTo = locateCitation(newDoc);
    if (!citeFromTo) throw new Error("citation not found in reviewerA fixture");
    const newMark = base.type.schema.marks.cite_inline!.create({ citationKey: "Smith2023" });
    tr.replaceWith(citeFromTo.from, citeFromTo.to, base.type.schema.text("[Smith2023]", [newMark]));
    return { doc: tr.doc, transform: tr };
  },
};

// Reviewer B rewrites the second paragraph and adds a new third paragraph.
// Different block from reviewer A, plus a structural insert.
export const reviewerB: RevisionFixture = {
  author: "reviewer-B",
  description: "rewrite §2; append a §3 with empirical claim",
  build(base) {
    const tr = new Transform(base);
    // Second paragraph spans positions ~62..91 (depends on first paragraph
    // length); compute it from the doc instead of hardcoding.
    const second = locateNthBlock(base, 1);
    if (!second) throw new Error("second paragraph not found in reviewerB fixture");
    tr.replaceWith(
      second.from + 1,
      second.to - 1,
      base.type.schema.text("We show that the inversion holds across three datasets."),
    );
    // Append a third paragraph at the end of the doc.
    const docEnd = tr.doc.content.size;
    tr.insert(
      docEnd,
      base.type.schema.node("paragraph", null, [
        base.type.schema.text("Replication artefact lives in §A."),
      ]),
    );
    return { doc: tr.doc, transform: tr };
  },
};

// Reviewer A' is a near-collision of reviewer A (touches the SAME first
// paragraph) — used to demonstrate conflict-on-rebase.
export const reviewerAPrime: RevisionFixture = {
  author: "reviewer-A-prime",
  description: "delete the prior-work sentence entirely",
  build(base) {
    const tr = new Transform(base);
    // Remove the second sentence (" Prior work [Smith2020] claimed OT scales better.")
    const firstPara = locateNthBlock(base, 0);
    if (!firstPara) throw new Error("first paragraph not found");
    const text = firstPara.node.textContent;
    const cutStart = firstPara.from + 1 + text.indexOf(" Prior work");
    const cutEnd = firstPara.to - 1;
    tr.delete(cutStart, cutEnd);
    return { doc: tr.doc, transform: tr };
  },
};

// Reviewer B' edits the citation key inside the very sentence reviewer A'
// wants deleted. Used together with reviewerAPrime to demonstrate the
// conflict branch of rebase.
export const reviewerBPrime: RevisionFixture = {
  author: "reviewer-B-prime",
  description: "update citation key inside the prior-work sentence",
  build(base) {
    const tr = new Transform(base);
    const cite = locateCitation(base);
    if (!cite) throw new Error("citation not found");
    const newMark = base.type.schema.marks.cite_inline!.create({ citationKey: "Smith2024" });
    tr.replaceWith(cite.from, cite.to, base.type.schema.text("[Smith2024]", [newMark]));
    return { doc: tr.doc, transform: tr };
  },
};

function locateCitation(doc: PMNode): { from: number; to: number } | null {
  let result: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.isText && node.marks.some((m) => m.type.name === "cite_inline")) {
      result = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });
  return result;
}

function locateNthBlock(doc: PMNode, idx: number): { node: PMNode; from: number; to: number } | null {
  let i = 0;
  let result: { node: PMNode; from: number; to: number } | null = null;
  doc.forEach((child, offset) => {
    if (i === idx && !result) {
      result = { node: child, from: offset, to: offset + child.nodeSize };
    }
    i += 1;
  });
  return result;
}
