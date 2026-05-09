// Resource types — what a capability is granted *on*. Matches the
// `capability_resource_type` Postgres enum in
// infra/drizzle/migrations/0001_initial.sql.
//
// 'global' is the catch-all for site-level grants like `document.create`
// (you create new documents, not "create a document on document X").
// Per the CHECK constraint in 0001_initial.sql, global grants must have
// a NULL resource_id.

export const RESOURCE_TYPES = ['document', 'block', 'thread', 'global'] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_SET: ReadonlySet<ResourceType> = new Set(
  RESOURCE_TYPES,
);

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPE_SET as ReadonlySet<string>).has(value);
}
