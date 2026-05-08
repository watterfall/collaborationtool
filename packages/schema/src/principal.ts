// Principal unifies User / Agent / Shared-link / Service as a single
// authority that holds capabilities. This is what makes "User and Agent
// are first-class citizens" structurally true.

import type { AgentId, IsoDateTime, PrincipalId } from './_shared';

export type PrincipalKind = 'user' | 'agent' | 'shared-link' | 'service';

export interface Principal {
  id: PrincipalId;            // [PG] format: 'user:<uuid>' / 'agent:<uuid>' / 'link:<uuid>' / 'service:<id>'
  kind: PrincipalKind;        // [PG]
  displayName: string;        // [PG]
  userId?: string;            // [PG] when kind=user
  agentId?: AgentId;          // [PG] when kind=agent
  sharedLinkId?: string;      // [PG] when kind=shared-link
  createdAt: IsoDateTime;     // [PG]
  revokedAt?: IsoDateTime;    // [PG]
}

// Capability vocabulary is defined in ADR-0002. This is the minimum shape
// that ADR-0001 entities can refer to.
export type CapabilityVerb = string;

export interface CapabilityGrant {
  id: string;                                                  // [PG]
  principalId: PrincipalId;                                    // [PG]
  resourceType: 'document' | 'block' | 'thread' | 'global';    // [PG]
  resourceId?: string;                                         // [PG] null = global
  verb: CapabilityVerb;                                        // [PG]
  expiresAt?: IsoDateTime;                                     // [PG]
  grantedBy: PrincipalId;                                      // [PG]
  grantedAt: IsoDateTime;                                      // [PG]
}
