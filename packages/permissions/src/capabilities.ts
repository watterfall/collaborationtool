// Capability vocabulary — verbatim from ADR-0002 §2.1 (36 entries).
//
// IMPORTANT: every Phase 1 / Phase 2 / Phase 3 code path that checks a
// capability must import the constant from THIS file. String literals
// like 'document.read' anywhere else are an ADR-0002 §6 violation
// (it's why we collapsed verbs to 36 in the first place — to keep the
// surface auditable). The lint guard (Phase 1.5) will enforce that.
//
// Adding a new capability:
//   1. Append it here in the appropriate domain group below
//   2. Update ADR-0002 §2.1 + add a row to §3 explaining the use case
//   3. Optionally add it to the relevant role bundle in roles.ts
//   4. The TypeScript `Capability` literal union auto-updates
//
// Removing a capability is harder: search uses, migrate grants in PG,
// then remove. Don't silently drop verbs from this list.

// ---------- Document layer (10) ----------

export const DOCUMENT_CAPABILITIES = [
  'document.read',
  'document.read:metadata-only',
  'document.create',
  'document.delete',
  'document.export',
  'document.fork',
  'document.merge',
  'document.transfer-ownership',
  'document.archive',
  'document.publish',
] as const;

// ---------- Block layer (8) ----------

export const BLOCK_CAPABILITIES = [
  'block.read',
  'block.propose',
  'block.commit',
  'block.review',
  'block.create',
  'block.delete',
  'block.move',
  'block.lock',
] as const;

// ---------- Annotation layer (5) ----------

export const ANNOTATION_CAPABILITIES = [
  'annotation.read',
  'annotation.create',
  'annotation.reply',
  'annotation.resolve',
  'annotation.delete',
] as const;

// ---------- Citation layer (4) ----------

export const CITATION_CAPABILITIES = [
  'citation.read',
  'citation.create',
  'citation.update',
  'citation.bind',
] as const;

// ---------- Agent layer (5) ----------

export const AGENT_CAPABILITIES = [
  'agent.register',
  'agent.invoke:editor',
  'agent.invoke:reviewer',
  'agent.invoke:citation',
  'agent.invoke:custom',
] as const;

// ---------- Provenance layer (2) ----------

export const PROVENANCE_CAPABILITIES = [
  'provenance.read',
  'provenance.read:agent-detail',
] as const;

// ---------- Capability meta layer (2) ----------

export const CAPABILITY_META_CAPABILITIES = [
  'capability.grant',
  'capability.revoke',
] as const;

// ---------- Aggregate ----------

export const CAPABILITIES = [
  ...DOCUMENT_CAPABILITIES,
  ...BLOCK_CAPABILITIES,
  ...ANNOTATION_CAPABILITIES,
  ...CITATION_CAPABILITIES,
  ...AGENT_CAPABILITIES,
  ...PROVENANCE_CAPABILITIES,
  ...CAPABILITY_META_CAPABILITIES,
] as const;

export type Capability = (typeof CAPABILITIES)[number];

// Set form for O(1) membership checks at hot path. Frozen so callers
// don't accidentally mutate it.
export const CAPABILITY_SET: ReadonlySet<Capability> = new Set(CAPABILITIES);

export function isCapability(value: string): value is Capability {
  return (CAPABILITY_SET as ReadonlySet<string>).has(value);
}

// Domain index: useful for UI grouping and ADR-aligned audits.
export const CAPABILITY_DOMAIN: Readonly<Record<Capability, string>> = (() => {
  const m = new Map<string, string>();
  for (const v of DOCUMENT_CAPABILITIES) m.set(v, 'document');
  for (const v of BLOCK_CAPABILITIES) m.set(v, 'block');
  for (const v of ANNOTATION_CAPABILITIES) m.set(v, 'annotation');
  for (const v of CITATION_CAPABILITIES) m.set(v, 'citation');
  for (const v of AGENT_CAPABILITIES) m.set(v, 'agent');
  for (const v of PROVENANCE_CAPABILITIES) m.set(v, 'provenance');
  for (const v of CAPABILITY_META_CAPABILITIES) m.set(v, 'capability-meta');
  return Object.freeze(Object.fromEntries(m)) as Readonly<
    Record<Capability, string>
  >;
})();
