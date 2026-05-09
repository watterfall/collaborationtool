// 5 default role bundles — verbatim from ADR-0002 §2.2.
//
// A "role" in our model is just a named bundle of capability verbs;
// it's NOT a database concept. The PG `document_acl.role_id` column
// stores the role name for diagnostics and quick UI labels, but the
// authoritative truth is `capability_verbs[]` in the same row. If a
// role bundle changes here, the application is responsible for
// re-materialising existing `document_acl` rows (Phase 1.5 reconcile job).
//
// Role-bundle strictness: every verb in a bundle must be a known
// `Capability`; the TypeScript type checks this at compile time.

import type { Capability } from './capabilities';

// ---------- IDs ----------

export const DEFAULT_ROLE_IDS = [
  'paper-author',
  'paper-reviewer',
  'commenter',
  'inline-editor-agent',
  'citation-agent',
] as const;

export type DefaultRoleId = (typeof DEFAULT_ROLE_IDS)[number];

// ---------- Bundles ----------

// Phase 1 paper-author: can do basically everything on a document EXCEPT
// the two owner-restricted verbs (transfer-ownership, publish) — those
// stay with the document.ownerPrincipalId. Phase 1 simplification: the
// gate on transfer-ownership / publish is enforced by app code reading
// `document.owner_principal_id`, not via per-document ACL row.
const PAPER_AUTHOR_BUNDLE: readonly Capability[] = [
  'document.read',
  'document.read:metadata-only',
  'document.create',
  'document.delete',
  'document.export',
  'document.fork',
  'document.merge',
  'document.archive',
  // 'document.transfer-ownership' — owner only
  // 'document.publish' — owner only
  ...(
    [
      'block.read',
      'block.propose',
      'block.commit',
      'block.review',
      'block.create',
      'block.delete',
      'block.move',
      'block.lock',
    ] as const
  ),
  ...(
    [
      'annotation.read',
      'annotation.create',
      'annotation.reply',
      'annotation.resolve',
      'annotation.delete',
    ] as const
  ),
  ...(['citation.read', 'citation.create', 'citation.update', 'citation.bind'] as const),
  'agent.invoke:editor',
  'agent.invoke:citation',
  'provenance.read',
  'provenance.read:agent-detail',
  'capability.grant',
  'capability.revoke',
];

// Phase 1 paper-reviewer: read-only access to body + propose / review,
// plus full annotation participation. NO `block.commit` — all changes
// must go through propose → owner accept.
const PAPER_REVIEWER_BUNDLE: readonly Capability[] = [
  'document.read',
  'document.export',
  'block.read',
  'block.propose',
  'block.review',
  'annotation.read',
  'annotation.create',
  'annotation.reply',
  'annotation.resolve',
  'annotation.delete',
  'citation.read',
  'agent.invoke:editor',
  'agent.invoke:citation',
  'provenance.read',
  'provenance.read:agent-detail',
];

// Phase 1 commenter: discussion-only.
const COMMENTER_BUNDLE: readonly Capability[] = [
  'document.read',
  'block.read',
  'annotation.read',
  'annotation.create',
  'annotation.reply',
  'citation.read',
  'provenance.read',
];

// Phase 1 inline-editor-agent: agent that proposes inline rewrites.
// Default propose-only; owner can grant temporary `block.commit:scope=...`
// (resource-scoped grant in capability_grant) for autonomous mode.
// Phase 1 connection-level gateway can't enforce scope — see ADR-0002 §3.B
// known limitation.
const INLINE_EDITOR_AGENT_BUNDLE: readonly Capability[] = [
  'block.read',
  'block.propose',
  'agent.invoke:editor',
  'provenance.read',
];

// Phase 1 citation-agent: scope is even tighter — read access narrowed
// to citation-ref + ±2 paragraphs in Phase 3. Phase 1 connection-level
// has the same limitation as inline-editor-agent.
const CITATION_AGENT_BUNDLE: readonly Capability[] = [
  'block.read',
  'block.propose',
  'citation.read',
  'citation.create',
  'citation.update',
  'citation.bind',
  'agent.invoke:citation',
  'provenance.read',
];

// ---------- Aggregate ----------

export const DEFAULT_ROLE_BUNDLES: Readonly<
  Record<DefaultRoleId, readonly Capability[]>
> = Object.freeze({
  'paper-author': PAPER_AUTHOR_BUNDLE,
  'paper-reviewer': PAPER_REVIEWER_BUNDLE,
  commenter: COMMENTER_BUNDLE,
  'inline-editor-agent': INLINE_EDITOR_AGENT_BUNDLE,
  'citation-agent': CITATION_AGENT_BUNDLE,
});

export function getRoleBundle(role: DefaultRoleId): readonly Capability[] {
  return DEFAULT_ROLE_BUNDLES[role];
}

export function isDefaultRoleId(value: string): value is DefaultRoleId {
  return (DEFAULT_ROLE_IDS as readonly string[]).includes(value);
}
