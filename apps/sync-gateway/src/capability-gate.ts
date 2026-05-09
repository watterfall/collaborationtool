// Mode-based filter on incoming Y.Doc updates. Phase 1 connection-level:
//
//   reader   → all client→server frames rejected with `update_rejected`
//   proposer → frames go to a `draft revision` queue (not body)
//   writer   → frames forwarded to body (Phase 1 stub: in-memory record;
//              D11 wires y-sweet)
//
// Phase 3 will swap this for per-frame node-range checks once Yjs
// subdocuments are split per section. The `decide` function signature
// stays — it's the documented gateway shim API in ADR-0002 §2.4.

import {
  type ConnectionMode,
  type PrincipalContext,
  canApplyUpdate,
} from '@collaborationtool/permissions';
import type { DocumentId } from '@collaborationtool/schema';

export type GateOutcome =
  | { kind: 'forward-to-body'; mode: 'writer' }
  | { kind: 'route-to-draft'; mode: 'proposer' }
  | { kind: 'reject'; reason: string; mode: ConnectionMode };

export interface GateInput {
  principalContext: PrincipalContext;
  documentId: DocumentId;
  mode: ConnectionMode;
  update: Uint8Array;
}

export function gateUpdate(input: GateInput): GateOutcome {
  // First, the heavy authorization gate from packages/permissions.
  const decision = canApplyUpdate(
    input.principalContext,
    input.documentId,
    input.update,
  );
  if (!decision.allow) {
    return {
      kind: 'reject',
      reason: decision.reason,
      mode: decision.mode ?? input.mode,
    };
  }

  // Phase 1 routing.
  switch (input.mode) {
    case 'writer':
      return { kind: 'forward-to-body', mode: 'writer' };
    case 'proposer':
      return { kind: 'route-to-draft', mode: 'proposer' };
    case 'reader':
      return { kind: 'reject', reason: 'reader-cannot-write', mode: 'reader' };
  }
}
