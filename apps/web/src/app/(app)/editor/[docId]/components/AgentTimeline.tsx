'use client';

// Phase 5 Wave A A4 — AgentTimeline view backing the dogfood gate
// promise "看到完整 dispatch 树 + 中途 cancel 一个 step 真 graceful
// 终止 + 超 quota 拒新 invoke".
//
// Renders the agent_job tree (root + parent_job_id descendants) +
// every agent_job_event bucket. Each node is expandable so the user
// can peek at the event payload, promptHash, retry list, tool calls,
// and the cancel button on still-running nodes.
//
// Design.md tokens only: hairline rules, mono disc, status pill,
// pill-shaped buttons, var(--color-ink) / var(--color-paper) /
// accent triad — Reject criteria 1-13 inclusive.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, HairlineRule, MonoDisc, StatusPill } from '@/components/design';
import {
  type BuildTimelineResult,
  type TimelineNode,
  classifyJobStatus,
  countDescendants,
  totalCostUsdMilli,
} from '@/lib/agent-timeline';

export interface AgentTimelineProps {
  /** Root agent_job id. Children resolve via the tree endpoint's
   * BFS over parent_job_id. */
  rootJobId: string;
  /** Optional poll interval. 0 = fetch once. Default 4_000ms. */
  pollMs?: number;
}

interface TreeResponse extends BuildTimelineResult {}

const STATUS_TO_PILL = {
  'in-progress': 'proposed',
  queued: 'proposed',
  cancelled: 'blocked',
  done: 'applied',
  error: 'blocked',
} as const;

const STATUS_LABEL = {
  queued: { zh: '排队中', en: 'Queued' },
  'in-progress': { zh: '运行中', en: 'Running' },
  cancelled: { zh: '已取消', en: 'Cancelled' },
  done: { zh: '已完成', en: 'Done' },
  error: { zh: '错误', en: 'Error' },
} as const;

export default function AgentTimeline({
  rootJobId,
  pollMs = 4000,
}: AgentTimelineProps) {
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/agent/job/${encodeURIComponent(rootJobId)}/tree`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? `HTTP ${res.status}`);
          setTree(null);
          return;
        }
        const body = (await res.json()) as TreeResponse;
        setTree(body);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootJobId, tick]);

  useEffect(() => {
    if (!pollMs) return;
    // Stop polling once the root settled into a terminal state — saves
    // server load and battery on idle tabs.
    const status = tree?.root?.job.status;
    if (status === 'done' || status === 'error' || status === 'cancelled') {
      return;
    }
    const handle = setInterval(() => setTick((t) => t + 1), pollMs);
    return () => clearInterval(handle);
  }, [pollMs, tree]);

  const onCancel = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(
          `/api/agent/job/${encodeURIComponent(jobId)}/cancel`,
          { method: 'POST' },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? `cancel failed: HTTP ${res.status}`);
          return;
        }
        setTick((t) => t + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const rolledCostUsdMilli = useMemo(() => {
    if (!tree?.root) return 0;
    return totalCostUsdMilli(tree.root);
  }, [tree]);

  const descendantCount = useMemo(() => {
    if (!tree?.root) return 0;
    return countDescendants(tree.root);
  }, [tree]);

  if (loading && !tree) {
    return (
      <div className="margin-entry" role="status" aria-live="polite">
        <p>
          <span lang="zh">载入 agent 时间线…</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Loading agent timeline…</span>
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="margin-entry" data-accent="ox" role="alert">
        <p>
          <span lang="zh">无法载入：{error}</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Could not load: {error}</span>
        </p>
      </div>
    );
  }
  if (!tree?.root) {
    return (
      <div className="margin-entry" role="status">
        <p>
          <span lang="zh">agent 任务不存在</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Agent job not found</span>
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="agent-timeline-heading">
      <header>
        <h2 id="agent-timeline-heading">
          <span lang="zh">Agent 时间线</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Agent timeline</span>
        </h2>
        <p>
          <span lang="zh">{descendantCount} 个子任务 · 累计成本 ${formatCostUsd(rolledCostUsdMilli)}</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">{descendantCount} sub-jobs · total ${formatCostUsd(rolledCostUsdMilli)}</span>
        </p>
      </header>
      <HairlineRule />
      <ol className="agent-timeline-tree" role="tree">
        <NodeRow node={tree.root} depth={0} onCancel={onCancel} />
      </ol>
      {tree.orphans.length > 0 ? (
        <p>
          <em>
            <span lang="zh">{tree.orphans.length} 个未关联任务</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">{tree.orphans.length} orphaned job(s) could not link to a parent</span>
          </em>
        </p>
      ) : null}
    </section>
  );
}

function NodeRow({
  node,
  depth,
  onCancel,
}: {
  node: TimelineNode;
  depth: number;
  onCancel: (jobId: string) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth === 0);
  const bucket = classifyJobStatus(node.job.status);
  const labels = STATUS_LABEL[bucket];
  const showCancel =
    node.job.status === 'queued' || node.job.status === 'running';
  return (
    <li role="treeitem" aria-expanded={expanded}>
      <div className="agent-timeline-node" data-status={bucket}>
        <MonoDisc kind="agent" monogram={initialFor(node.job.kind)} />
        <div>
          <button
            type="button"
            className="btn-link"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span>{node.job.kind}</span>
            <span aria-hidden="true"> · </span>
            <span className="mono-disc-sm">{node.job.id.slice(0, 8)}</span>
          </button>
          <StatusPill
            status={STATUS_TO_PILL[bucket]}
            label={labels.zh}
            labelEn={labels.en}
          />
          {node.job.progressMessage ? (
            <p>{node.job.progressMessage}</p>
          ) : null}
          {expanded ? (
            <div>
              <ul>
                {node.events.map((ev) => (
                  <li key={ev.id}>
                    <code>{ev.eventKind}</code>
                    <span aria-hidden="true"> · </span>
                    <time>{ev.createdAt}</time>
                    <details>
                      <summary>
                        <span lang="zh">载荷</span>
                        <span aria-hidden="true"> · </span>
                        <span lang="en">payload</span>
                      </summary>
                      <pre>{JSON.stringify(ev.payload, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ul>
              {showCancel ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(node.job.id)}
                >
                  <span lang="zh">取消</span>
                  <span aria-hidden="true"> · </span>
                  <span lang="en">Cancel</span>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {node.children.length > 0 ? (
        <ol role="group">
          {node.children.map((child) => (
            <NodeRow
              key={child.job.id}
              node={child}
              depth={depth + 1}
              onCancel={onCancel}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function formatCostUsd(milli: number): string {
  return (milli / 1000).toFixed(2);
}

function initialFor(kind: string): string {
  if (kind === 'reviewer') return 'R';
  if (kind === 'researcher') return 'S';
  if (kind === 'maintenance-scan') return 'M';
  if (kind === 'citation') return 'C';
  if (kind === 'inline-editor') return 'E';
  return kind.charAt(0).toUpperCase() || 'A';
}
