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
