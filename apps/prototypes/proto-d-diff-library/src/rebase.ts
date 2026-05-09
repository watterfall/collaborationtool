import { Node as PMNode } from "prosemirror-model";
import { Step, Transform } from "prosemirror-transform";

export interface RebaseReport {
  baseDocSize: number;
  acceptedAuthor: string;
  pendingAuthor: string;
  pendingStepCount: number;
  appliedStepCount: number;
  droppedSteps: number[];          // indices that step.map returned null for
  failedApplyAt: number | null;    // index of first step that .apply failed on
  rebasedDoc: PMNode | null;
  resolution: "auto-rebased" | "conflict";
}

/**
 * Attempt to rebase `pending` on top of `accepted`, both produced from the
 * same `base`. Returns a report describing whether the auto-path worked or
 * which steps stranded the revision.
 *
 * Strategy mirrors what prosemirror's collab module does internally for OT-
 * like rebasing: walk pending.steps, map each through accepted.mapping, and
 * apply to the moving accumulator. A null result from `step.map` flags the
 * step as conflicting; we record it but keep walking so the report is
 * complete.
 */
export function rebasePendingOntoAccepted(
  base: PMNode,
  accepted: Transform,
  pending: Transform,
  acceptedAuthor: string,
  pendingAuthor: string,
): RebaseReport {
  const droppedSteps: number[] = [];
  let failedApplyAt: number | null = null;
  let working = new Transform(accepted.doc);
  let appliedStepCount = 0;

  pending.steps.forEach((step: Step, idx: number) => {
    const remapped = step.map(accepted.mapping);
    if (!remapped) {
      droppedSteps.push(idx);
      return;
    }
    const result = working.maybeStep(remapped);
    if (result.failed) {
      if (failedApplyAt === null) failedApplyAt = idx;
      droppedSteps.push(idx);
      return;
    }
    appliedStepCount += 1;
  });

  const allApplied = droppedSteps.length === 0 && failedApplyAt === null;
  return {
    baseDocSize: base.content.size,
    acceptedAuthor,
    pendingAuthor,
    pendingStepCount: pending.steps.length,
    appliedStepCount,
    droppedSteps,
    failedApplyAt,
    rebasedDoc: allApplied ? working.doc : null,
    resolution: allApplied ? "auto-rebased" : "conflict",
  };
}
