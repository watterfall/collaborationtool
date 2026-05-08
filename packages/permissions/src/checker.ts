// Capability checker — Phase 1 ADR-0002 §6.B says we self-implement (no
// OPA / Cedar) until vocabulary explodes past ~80 verbs or conditions
// get complex. Phase 1's surface is small and explicit:
//
//   `hasCapability(ctx, requirement) → boolean`  — explicit single check
//   `requireCapability(ctx, requirement)`        — throws on deny
//   `canApplyUpdate(ctx, documentId, update)`    — gateway shim entry
//
// Resource scoping: Phase 1 only enforces `global` and `document` scopes.
// Per-block scopes exist in the data model (capability_grant.resourceId
// can point at a block) but the gateway can't enforce them at connection
// level — Phase 3 unlocks this when subdocuments arrive (ADR-0002 §3.B).

import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import type { Capability } from './capabilities';
import { type ConnectionMode, classifyConnectionMode } from './connection-mode';
import type { ResourceType } from './resources';

export interface CapabilityRequirement {
  verb: Capability;
  resourceType: ResourceType;
  /** null when resourceType=global */
  resourceId?: string | null;
}

export interface PrincipalContext {
  principalId: PrincipalId;
  /** Capabilities scoped to this document (already filtered by ACL loader). */
  documentCapabilities: ReadonlySet<Capability>;
  /** Capabilities granted globally (e.g. document.create on the platform). */
  globalCapabilities: ReadonlySet<Capability>;
  /** Optional: per-block grants we've loaded for this connection. Phase 1 unused. */
  perBlockCapabilities?: ReadonlyMap<string, ReadonlySet<Capability>>;
  /** ACL row expiresAt; gateway enforces by closing connection. */
  expiresAt?: Date | null;
}

export class CapabilityDeniedError extends Error {
  override name = 'CapabilityDeniedError';
  constructor(
    public readonly principalId: PrincipalId,
    public readonly requirement: CapabilityRequirement,
    public readonly reason: string,
  ) {
    super(
      `principal ${principalId} denied ${requirement.verb} on ` +
        `${requirement.resourceType}:${requirement.resourceId ?? 'global'} (${reason})`,
    );
  }
}

export function hasCapability(
  ctx: PrincipalContext,
  required: CapabilityRequirement,
): boolean {
  if (ctx.expiresAt && ctx.expiresAt.getTime() < Date.now()) return false;

  switch (required.resourceType) {
    case 'global':
      return ctx.globalCapabilities.has(required.verb);

    case 'document':
      // Phase 1: any document grant (the document-level ACL row carries
      // the full bundle). resource_id is enforced by the ACL loader
      // already filtering to the right document.
      return ctx.documentCapabilities.has(required.verb);

    case 'block': {
      // Phase 1 fallback: if document-level has it, OK. Phase 3 will
      // require an explicit per-block grant when none exists at doc level.
      if (ctx.documentCapabilities.has(required.verb)) return true;
      if (!required.resourceId) return false;
      const blockCaps = ctx.perBlockCapabilities?.get(required.resourceId);
      return blockCaps?.has(required.verb) ?? false;
    }

    case 'thread':
      // Phase 1 simplification: thread-level grants always inherit doc-level.
      return ctx.documentCapabilities.has(required.verb);

    default: {
      // Exhaustiveness check.
      const _exhaustive: never = required.resourceType;
      void _exhaustive;
      return false;
    }
  }
}

export function requireCapability(
  ctx: PrincipalContext,
  required: CapabilityRequirement,
): void {
  if (!hasCapability(ctx, required)) {
    const reason =
      ctx.expiresAt && ctx.expiresAt.getTime() < Date.now() ? 'expired' : 'no-grant';
    throw new CapabilityDeniedError(ctx.principalId, required, reason);
  }
}

export interface SyncGatewayDecision {
  allow: boolean;
  mode: ConnectionMode | null;
  reason: string;
}

/**
 * The Phase 1 gateway shim entry point — kept under the name documented
 * in ADR-0002 §2.4 ("canApplyUpdate") even though Phase 1 only inspects
 * connection-level mode. Phase 3 will inspect `update` (Yjs binary) for
 * affected block IDs and check per-block capability for each.
 *
 * NOTE: Phase 1 does NOT decode `update` to keep the gateway hot path
 * cheap — it relies on the connection-mode classification at handshake.
 * `update` is accepted as an argument so call sites that already have
 * the bytes don't have to refactor when Phase 3 lands.
 */
export function canApplyUpdate(
  ctx: PrincipalContext,
  documentId: DocumentId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update: Uint8Array,
): SyncGatewayDecision {
  // Document-bound check: the ACL loader is responsible for matching
  // ctx.documentCapabilities to *this* documentId. The argument here is
  // kept so future per-block path can refer back to it.
  void documentId;

  const { mode, reason } = classifyConnectionMode(ctx.documentCapabilities);
  if (mode === null) return { allow: false, mode, reason };
  if (mode === 'reader') return { allow: false, mode, reason: 'reader-cannot-write' };
  // Phase 1: writer fully accepted; proposer accepted but routed to draft
  // by capability-gate.ts (the gateway), not by this checker.
  return { allow: true, mode, reason };
}
