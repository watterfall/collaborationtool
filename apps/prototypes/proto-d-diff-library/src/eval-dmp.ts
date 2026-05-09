import {
  cleanupSemantic,
  DIFF_DELETE,
  DIFF_EQUAL,
  DIFF_INSERT,
  makeDiff,
} from "@sanity/diff-match-patch";
import { Node as PMNode } from "prosemirror-model";

export interface DmpReport {
  author: string;
  baseTextLen: number;
  revisedTextLen: number;
  segmentCount: number;
  segments: Array<{ kind: "equal" | "insert" | "delete"; text: string }>;
  citationLost: boolean;       // did the textContent diff blow away the cite mark span?
  blockBoundaryLost: boolean;  // did it merge two blocks into one diff segment?
}

export function evaluateDmp(base: PMNode, revised: PMNode, author: string): DmpReport {
  // PM textContent flattens block boundaries to spaces. We use textBetween
  // with "\n" as the block separator so the diff at least *sees* paragraph
  // breaks, but they remain ambiguous.
  const baseText = base.textBetween(0, base.content.size, "\n");
  const revisedText = revised.textBetween(0, revised.content.size, "\n");
  const raw = makeDiff(baseText, revisedText);
  const cleaned = cleanupSemantic(raw);
  const segments = cleaned.map(([op, text]) => ({
    kind: op === DIFF_INSERT ? "insert" : op === DIFF_DELETE ? "delete" : "equal",
    text,
  })) as DmpReport["segments"];
  // Heuristics to demonstrate what the text-only view loses.
  const citationLost = !revisedText.includes("[Smith2020]") && !revisedText.includes("[Smith2023]")
    ? false
    : !cleaned.some(([op, text]) => op !== DIFF_EQUAL && /\[Smith\d+]/.test(text));
  const blockBoundaryLost = cleaned.some(([op, text]) => op !== DIFF_EQUAL && text.includes("\n"));
  return {
    author,
    baseTextLen: baseText.length,
    revisedTextLen: revisedText.length,
    segmentCount: cleaned.length,
    segments,
    citationLost,
    blockBoundaryLost,
  };
}
