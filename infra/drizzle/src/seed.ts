// Seed: minimum dataset to bring an empty Postgres up to "can run a
// fresh demo against it" state. Idempotent — uses ON CONFLICT DO NOTHING
// on stable IDs so re-running doesn't error.
//
// What's seeded:
//   - 1 service principal (the platform itself, used for system actions)
//   - 1 demo user principal + minimal user_id placeholder
//   - 1 demo citation agent + its principal
//   - 1 prompt_template row for skills/citation-lookup/SKILL.md (bound to
//     a deterministic version+hash so demos can reference it)
//   - 1 demo document owned by the demo user, with a slug
//
// Real production rows come through the application API; this is for
// local dev / CI / round-trip tests only.

import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from './client';

export interface SeedIds {
  servicePrincipalId: string;
  demoUserPrincipalId: string;
  demoUserUserId: string;
  citationAgentId: string;
  citationAgentPrincipalId: string;
  citationLookupPromptTemplateId: string;
  demoDocumentId: string;
}

// Stable IDs so seed is idempotent.
const SERVICE_PRINCIPAL_ID = 'service:platform';
const DEMO_USER_USER_ID = 'demo-user-0001';
const DEMO_USER_PRINCIPAL_ID = 'user:00000000-0000-7000-8000-000000000001';
const CITATION_AGENT_ID = '00000000-0000-7000-8000-00000000a001';
const CITATION_AGENT_PRINCIPAL_ID = `agent:${CITATION_AGENT_ID}`;
const INLINE_EDITOR_AGENT_ID = '00000000-0000-7000-8000-00000000b001';
const INLINE_EDITOR_AGENT_PRINCIPAL_ID = `agent:${INLINE_EDITOR_AGENT_ID}`;
const CITATION_LOOKUP_PROMPT_TEMPLATE_ID = 'citation-lookup@seed-v1';
const DEMO_DOCUMENT_ID = '00000000-0000-7000-8000-00000000d001';

export async function seed(databaseUrl?: string): Promise<SeedIds> {
  const { db, close } = openDatabase({ url: databaseUrl });

  try {
    // ----- Principals -----
    await db
      .insert(schema.principal)
      .values([
        {
          id: SERVICE_PRINCIPAL_ID,
          kind: 'service',
          displayName: 'Platform service',
        },
        {
          id: DEMO_USER_PRINCIPAL_ID,
          kind: 'user',
          displayName: 'Demo User',
          userId: DEMO_USER_USER_ID,
        },
        {
          id: CITATION_AGENT_PRINCIPAL_ID,
          kind: 'agent',
          displayName: 'Citation Lookup Agent',
          agentId: CITATION_AGENT_ID,
        },
        {
          id: INLINE_EDITOR_AGENT_PRINCIPAL_ID,
          kind: 'agent',
          displayName: 'Inline Editor Agent',
          agentId: INLINE_EDITOR_AGENT_ID,
        },
      ])
      .onConflictDoNothing({ target: schema.principal.id });

    // ----- Agent (depends on its own principal existing) -----
    await db
      .insert(schema.agent)
      .values({
        id: CITATION_AGENT_ID,
        ownerPrincipalId: SERVICE_PRINCIPAL_ID,
        name: 'Citation Lookup',
        kind: 'citation',
        runtime: 'server',
        defaultModelId: 'claude-sonnet-4-6',
        defaultSkillIds: ['citation-lookup'],
        allowedMcpServerIds: [
          'crossref',
          'crossref-mock',
          'semantic-scholar',
          'arxiv',
        ],
        defaultMaxTokens: 4096,
        defaultTimeoutMs: 60000,
        principalId: CITATION_AGENT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.agent.id });

    // ----- Inline Editor Agent -----
    await db
      .insert(schema.agent)
      .values({
        id: INLINE_EDITOR_AGENT_ID,
        ownerPrincipalId: SERVICE_PRINCIPAL_ID,
        name: 'Inline Editor',
        kind: 'editor',
        runtime: 'server',
        defaultModelId: 'claude-sonnet-4-6',
        defaultSkillIds: ['inline-editor'],
        allowedMcpServerIds: [],
        defaultMaxTokens: 4096,
        defaultTimeoutMs: 60000,
        principalId: INLINE_EDITOR_AGENT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.agent.id });

    // ----- Prompt template (immutable; one row per skill+version) -----
    await db
      .insert(schema.promptTemplate)
      .values({
        id: CITATION_LOOKUP_PROMPT_TEMPLATE_ID,
        skillId: 'citation-lookup',
        version: 'seed-v1',
        // Hash of seed body — deterministic. Real loader computes sha256
        // over the actual SKILL.md file content; for seed we use a fixed
        // sentinel so tests can assert against it.
        hash: 'sha256:seed-v1-citation-lookup-fixture',
        body: '<seed prompt body — replaced by real SKILL.md content at runtime>',
      })
      .onConflictDoNothing({ target: schema.promptTemplate.id });

    // ----- Demo document -----
    await db
      .insert(schema.document)
      .values({
        id: DEMO_DOCUMENT_ID,
        ownerPrincipalId: DEMO_USER_PRINCIPAL_ID,
        primaryLanguage: 'zh-Hans',
        bilingualMode: 'mixed',
        title: '示例文档 / Demo Document',
        slug: 'demo-document',
      })
      .onConflictDoNothing({ target: schema.document.id });

    return {
      servicePrincipalId: SERVICE_PRINCIPAL_ID,
      demoUserPrincipalId: DEMO_USER_PRINCIPAL_ID,
      demoUserUserId: DEMO_USER_USER_ID,
      citationAgentId: CITATION_AGENT_ID,
      citationAgentPrincipalId: CITATION_AGENT_PRINCIPAL_ID,
      citationLookupPromptTemplateId: CITATION_LOOKUP_PROMPT_TEMPLATE_ID,
      demoDocumentId: DEMO_DOCUMENT_ID,
    };
  } finally {
    await close();
  }
}

// Helper for tests / fixtures: create a fresh user principal pair.
export async function makeUserPrincipal(
  db: ReturnType<typeof openDatabase>['db'],
  displayName: string,
): Promise<{ principalId: string; userId: string }> {
  const userId = `u-${uuidv7()}`;
  const principalId = `user:${uuidv7()}`;
  await db.insert(schema.principal).values({
    id: principalId,
    kind: 'user',
    displayName,
    userId,
  });
  return { principalId, userId };
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then((ids) => {
      console.log('[seed] ok');
      console.log(JSON.stringify(ids, null, 2));
    })
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
