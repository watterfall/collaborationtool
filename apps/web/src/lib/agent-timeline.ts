// Phase 5 Wave A A4 — pure tree builder for the AgentTimeline view.
//
// Worker emits agent_job rows + agent_job_event rows (append-only).
// When a coordinator dispatches an async handoff, the spawned job has
// `parent_job_id` set to the dispatcher's job id (ADR-0008 §2.1 +
// Phase 3 W6 closeout). The timeline view renders this DAG as a tree
// rooted at the requested job, with each node showing its progress /
// done / error / cancelled event stream.
//
// This file is the pure logic so the route can be a thin wrapper and
// the React component a thin renderer.

export interface TimelineJobRow {
  id: string;
  kind: string;
  status: string;
  parentJobId: string | null;
  progressFraction: number;
  progressMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  costUsdMilli: number;
  triggeringPrincipalId: string;
}

export interface TimelineEventRow {
  id: number;
  jobId: string;
  eventKind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TimelineNode {
  job: TimelineJobRow;
  events: TimelineEventRow[];
  children: TimelineNode[];
}

export interface BuildTimelineInput {
  /** All jobs that should appear in the tree. Caller filters scope
   * (root + descendants); this function assumes everything passed in
   * belongs in the tree. */
  jobs: TimelineJobRow[];
  events: TimelineEventRow[];
  /** Root job id. Trees with multiple roots are rare (only for the
   * orphan case below); we require the caller to pick one. */
  rootJobId: string;
}

export interface BuildTimelineResult {
  /** The fully-assembled root node, or null when the root job is
   * missing (caller renders an "agent not found" surface). */
  root: TimelineNode | null;
  /** Jobs whose parent_job_id pointed somewhere outside the supplied
   * `jobs` list. These never make it into the tree; surface them so
   * the UI can render a "could not link to parent" diagnostic instead
   * of silently dropping. */
  orphans: TimelineJobRow[];
}

/** Build a tree rooted at `rootJobId`. Events are bucketed under their
 * owning job sorted by `id` ascending (bigserial order = emit order).
 * Children are sorted by `startedAt` ascending (so the timeline reads
 * top-to-bottom in dispatch order); jobs that never started yet sort
 * to the end of the children list. */
export function buildTimelineTree(
  input: BuildTimelineInput,
): BuildTimelineResult {
  const jobsById = new Map<string, TimelineJobRow>();
  for (const job of input.jobs) {
    jobsById.set(job.id, job);
  }

  const eventsByJob = new Map<string, TimelineEventRow[]>();
  for (const ev of input.events) {
    const bucket = eventsByJob.get(ev.jobId);
    if (bucket) {
      bucket.push(ev);
    } else {
      eventsByJob.set(ev.jobId, [ev]);
    }
  }
  for (const bucket of eventsByJob.values()) {
    bucket.sort((a, b) => a.id - b.id);
  }

  const childrenByParent = new Map<string, TimelineJobRow[]>();
  const orphans: TimelineJobRow[] = [];
  for (const job of input.jobs) {
    if (job.id === input.rootJobId) continue;
    if (job.parentJobId === null) {
      // A row passed in with no parent that isn't the root is an
      // orphan from this view's perspective.
      orphans.push(job);
      continue;
    }
    if (!jobsById.has(job.parentJobId)) {
      orphans.push(job);
      continue;
    }
    const bucket = childrenByParent.get(job.parentJobId);
    if (bucket) {
      bucket.push(job);
    } else {
      childrenByParent.set(job.parentJobId, [job]);
    }
  }

  const startedAtRank = (job: TimelineJobRow): number => {
    if (job.startedAt) return Date.parse(job.startedAt);
    return Number.POSITIVE_INFINITY;
  };
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => startedAtRank(a) - startedAtRank(b));
  }

  const rootJob = jobsById.get(input.rootJobId);
  if (!rootJob) {
    return { root: null, orphans };
  }

  const visited = new Set<string>();
  const buildNode = (job: TimelineJobRow): TimelineNode => {
    if (visited.has(job.id)) {
      // Cycle guard. Should not happen since parent_job_id is set
      // once at insert time, but defensively return a leaf so the UI
      // doesn't infinite-loop. The cycle node is surfaced as orphan
      // for the caller to flag.
      orphans.push(job);
      return { job, events: eventsByJob.get(job.id) ?? [], children: [] };
    }
    visited.add(job.id);
    const childRows = childrenByParent.get(job.id) ?? [];
    return {
      job,
      events: eventsByJob.get(job.id) ?? [],
      children: childRows.map(buildNode),
    };
  };

  return { root: buildNode(rootJob), orphans };
}

export type TimelineNodeStatusBucket =
  | 'queued'
  | 'in-progress'
  | 'cancelled'
  | 'done'
  | 'error';

/** Coarse classification for UI styling. Cancelling collapses into
 * in-progress because the worker hasn't confirmed the stop yet. */
export function classifyJobStatus(status: string): TimelineNodeStatusBucket {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'running':
    case 'cancelling':
      return 'in-progress';
    case 'cancelled':
      return 'cancelled';
    case 'done':
      return 'done';
    case 'error':
    default:
      return 'error';
  }
}

/** Total cost rolled up from a node + all descendants. */
export function totalCostUsdMilli(node: TimelineNode): number {
  let sum = node.job.costUsdMilli;
  for (const child of node.children) {
    sum += totalCostUsdMilli(child);
  }
  return sum;
}

/** Count the leaves under a node — useful for the "agent dispatched 5
 * sub-jobs" headline in the UI. */
export function countDescendants(node: TimelineNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}
