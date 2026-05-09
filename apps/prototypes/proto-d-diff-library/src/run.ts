import {
  buildBaseDoc,
  reviewerA,
  reviewerAPrime,
  reviewerB,
  reviewerBPrime,
} from "./fixtures.js";
import { evaluateDmp } from "./eval-dmp.js";
import { evaluatePmChangeset } from "./eval-pm-changeset.js";
import { rebasePendingOntoAccepted } from "./rebase.js";

const sectionDivider = "─".repeat(72);

function sectionHeader(title: string) {
  console.log(`\n${sectionDivider}\n${title}\n${sectionDivider}`);
}

function fmtRange(r: { fromA: number; toA: number; fromB: number; toB: number }) {
  return `[${r.fromA}..${r.toA}] → [${r.fromB}..${r.toB}]`;
}

function main() {
  const base = buildBaseDoc();

  sectionHeader("base doc");
  console.log(`size=${base.content.size} blocks=${base.childCount}`);
  console.log(`textContent = ${JSON.stringify(base.textContent)}`);

  // ──────────────────────────────────────────────────────────────────
  // Question 1: UI granularity. Run both libraries on (base → A) and
  // (base → B) and inspect what each surface gives the UI.
  // ──────────────────────────────────────────────────────────────────
  sectionHeader("§1 UI granularity — base vs reviewer A");
  const aBuilt = reviewerA.build(base);
  const pmA = evaluatePmChangeset(base, aBuilt.doc, aBuilt.transform, reviewerA.author);
  const dmpA = evaluateDmp(base, aBuilt.doc, reviewerA.author);
  console.log("prosemirror-changeset:");
  console.log(`  changes=${pmA.changeCount}  blocks_touched=${JSON.stringify(pmA.blocksTouched)}`);
  for (const r of pmA.ranges) {
    console.log(
      `  • ${fmtRange(r)}  -"${r.deletedText}" (marks=${JSON.stringify(r.deletedHasMarks)})  +"${r.insertedText}" (marks=${JSON.stringify(r.insertedHasMarks)})`,
    );
  }
  console.log(`@sanity/diff-match-patch (cleanupSemantic):`);
  console.log(`  segments=${dmpA.segmentCount}  citation_lost=${dmpA.citationLost}  block_boundary_lost=${dmpA.blockBoundaryLost}`);
  for (const s of dmpA.segments) {
    if (s.kind === "equal") continue;
    console.log(`  • ${s.kind.padStart(6)} ${JSON.stringify(s.text)}`);
  }

  sectionHeader("§1 UI granularity — base vs reviewer B");
  const bBuilt = reviewerB.build(base);
  const pmB = evaluatePmChangeset(base, bBuilt.doc, bBuilt.transform, reviewerB.author);
  const dmpB = evaluateDmp(base, bBuilt.doc, reviewerB.author);
  console.log("prosemirror-changeset:");
  console.log(`  changes=${pmB.changeCount}  blocks_touched=${JSON.stringify(pmB.blocksTouched)}`);
  for (const r of pmB.ranges) {
    console.log(
      `  • ${fmtRange(r)}  -"${r.deletedText}"  +"${r.insertedText}"`,
    );
  }
  console.log(`@sanity/diff-match-patch:`);
  console.log(`  segments=${dmpB.segmentCount}  block_boundary_lost=${dmpB.blockBoundaryLost}`);
  for (const s of dmpB.segments) {
    if (s.kind === "equal") continue;
    console.log(`  • ${s.kind.padStart(6)} ${JSON.stringify(s.text)}`);
  }

  // ──────────────────────────────────────────────────────────────────
  // Question 2: rebase semantics. Two scenarios:
  //   (a) accept A → rebase B onto new base (no overlap)
  //   (b) accept A' (deletes a sentence) → rebase B' (edits that sentence)
  // ──────────────────────────────────────────────────────────────────
  sectionHeader("§2 rebase — accept A, then rebase B (disjoint blocks)");
  const rebaseClean = rebasePendingOntoAccepted(
    base,
    aBuilt.transform,
    bBuilt.transform,
    reviewerA.author,
    reviewerB.author,
  );
  console.log(`resolution=${rebaseClean.resolution}  applied=${rebaseClean.appliedStepCount}/${rebaseClean.pendingStepCount}  dropped=${JSON.stringify(rebaseClean.droppedSteps)}`);
  if (rebaseClean.rebasedDoc) {
    console.log(`rebased doc textContent = ${JSON.stringify(rebaseClean.rebasedDoc.textContent)}`);
  }

  sectionHeader("§2 rebase — accept A' (deletes sentence), then rebase B' (edits inside it)");
  const aPrime = reviewerAPrime.build(base);
  const bPrime = reviewerBPrime.build(base);
  const rebaseConflict = rebasePendingOntoAccepted(
    base,
    aPrime.transform,
    bPrime.transform,
    reviewerAPrime.author,
    reviewerBPrime.author,
  );
  console.log(`resolution=${rebaseConflict.resolution}  applied=${rebaseConflict.appliedStepCount}/${rebaseConflict.pendingStepCount}  dropped=${JSON.stringify(rebaseConflict.droppedSteps)}  failedApplyAt=${rebaseConflict.failedApplyAt}`);
  if (rebaseConflict.resolution === "conflict") {
    console.log("→ surface to UI as 'reviewer-B-prime: edit stranded — sentence deleted by A-prime'");
  }

  sectionHeader("summary");
  console.log("Q1 granularity:");
  console.log("  prosemirror-changeset → block-aware ranges + per-span mark metadata (citation preserved)");
  console.log(`  diff-match-patch     → flat text segments; block_boundary_lost=${dmpA.blockBoundaryLost || dmpB.blockBoundaryLost}, citation invisible`);
  console.log("Q2 rebase:");
  console.log("  disjoint-block case  → auto-rebase succeeds via Step.map(mapping)");
  console.log("  overlapping-delete   → conflict surfaced; revision must drop to manual resolve UI");
}

main();
