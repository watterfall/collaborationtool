// Phase 4 W4 maintenance dashboard shared types + transition matrix.
//
// Both the API route (POST /api/maintenance/findings/<id>/transition)
// and the dashboard Server Action (apps/web/src/app/(app)/maintenance
// /page.tsx) call validateTransition(); keeping it here gives both
// callers identical semantics and lets tests cover the matrix.

export const FINDING_STATUSES = [
  'open',
  'acknowledged',
  'resolved',
  'dismissed',
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export type TransitionTarget = Exclude<FindingStatus, 'open'>;

export interface MaintenanceFilter {
  status?: FindingStatus;
  documentId?: string;
  claimId?: string;
  findingId?: string;
}

export function parseMaintenanceFilter(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): MaintenanceFilter {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const raw = params[key];
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  };
  const filter: MaintenanceFilter = {};
  const status = get('status');
  if (status && (FINDING_STATUSES as readonly string[]).includes(status)) {
    filter.status = status as FindingStatus;
  }
  for (const key of ['documentId', 'claimId', 'findingId'] as const) {
    const value = get(key);
    if (value && value.trim()) {
      filter[key] = value.trim();
    }
  }
  return filter;
}

export const ALLOWED_TRANSITIONS: Readonly<
  Record<FindingStatus, readonly TransitionTarget[]>
> = {
  open: ['acknowledged', 'resolved', 'dismissed'],
  acknowledged: ['resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
};

export type TransitionVerdict =
  | { ok: true; updates: TransitionUpdates }
  | {
      ok: false;
      reason:
        | 'invalid-target'
        | 'transition-not-allowed'
        | 'reason-required-for-dismissed';
      from?: FindingStatus;
      to?: TransitionTarget;
      allowedFromCurrent?: readonly TransitionTarget[];
    };

export interface TransitionUpdates {
  status: TransitionTarget;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  dismissedAt?: Date;
  dismissedBy?: string;
  dismissReason?: string;
}

/** Pure validator. Returns either {ok:true, updates} ready to feed
 * into a drizzle UPDATE, or {ok:false, reason} for the caller to
 * surface as 4xx / no-op. */
export function validateTransition(args: {
  currentStatus: string;
  to: unknown;
  reason: string | null;
  actorPrincipalId: string;
  now?: Date;
}): TransitionVerdict {
  const { currentStatus, to, reason, actorPrincipalId } = args;
  const now = args.now ?? new Date();

  if (
    to !== 'acknowledged' &&
    to !== 'resolved' &&
    to !== 'dismissed'
  ) {
    return { ok: false, reason: 'invalid-target' };
  }

  const fromKey = (FINDING_STATUSES as readonly string[]).includes(currentStatus)
    ? (currentStatus as FindingStatus)
    : ('open' as FindingStatus);
  const allowed = ALLOWED_TRANSITIONS[fromKey];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: 'transition-not-allowed',
      from: fromKey,
      to,
      allowedFromCurrent: allowed,
    };
  }

  if (to === 'dismissed' && (!reason || reason.trim().length === 0)) {
    return { ok: false, reason: 'reason-required-for-dismissed' };
  }

  const updates: TransitionUpdates = { status: to };
  if (to === 'acknowledged') {
    updates.acknowledgedAt = now;
    updates.acknowledgedBy = actorPrincipalId;
  } else if (to === 'resolved') {
    updates.resolvedAt = now;
    updates.resolvedBy = actorPrincipalId;
  } else if (to === 'dismissed') {
    updates.dismissedAt = now;
    updates.dismissedBy = actorPrincipalId;
    updates.dismissReason = (reason ?? '').trim();
  }
  return { ok: true, updates };
}

// ---------------------------------------------------------------------------
// Phase 4 W10.7 — severity → StatusPill mapping (Design.md §11 reject #5).
//
// Maintenance findings have 4 severity levels (high / medium / low / info).
// Design.md only allows 3 statuses on StatusPill (proposed / applied /
// blocked); collapsing 4 → 3 is acceptable because severity is an *axis*,
// not a state — high/medium share blocking semantics ("must address"),
// low signals applied (already-fine), info is informational (proposed).

export function severityToPillStatus(
  severity: string,
): 'blocked' | 'proposed' | 'applied' {
  switch (severity) {
    case 'high':
    case 'medium':
      return 'blocked';
    case 'info':
      return 'proposed';
    case 'low':
    default:
      return 'applied';
  }
}
