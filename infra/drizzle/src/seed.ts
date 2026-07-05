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
import { desc, eq } from 'drizzle-orm';

import {
  buildDemoEntry,
  DEMO_OPEN_DATASET_CONTENT,
  DEMO_OPEN_DATASET_ID,
  DEMO_OPEN_QUESTION_CONTENT,
  DEMO_OPEN_QUESTION_ID,
  DEMO_OPEN_REVIEW_CONTENT,
  DEMO_OPEN_REVIEW_ID,
  DEMO_OPEN_SIGNER_PRINCIPAL_ID,
  DEMO_OPEN_SIGNER_PUBLIC_KEY,
  DEMO_OPEN_SIGNER_SECRET_HEX,
  DEMO_REVIEWER_PRINCIPAL_ID,
  DEMO_REVIEWER_PUBLIC_KEY,
  DEMO_REVIEWER_SECRET_HEX,
  DEMO_REVIEWER_USER_ID,
  DEMO_SHARE_SNAPSHOT_CONTENT,
  DEMO_SHARE_SNAPSHOT_ID,
} from './open-content-demo-fixtures';
import { openDatabase, schema, type Database } from './client';

export interface SeedIds {
  servicePrincipalId: string;
  demoUserPrincipalId: string;
  demoUserUserId: string;
  citationAgentId: string;
  citationAgentPrincipalId: string;
  citationLookupPromptTemplateId: string;
  demoDocumentId: string;
  demoReviewerPrincipalId: string;
  demoOpenQuestionId: string;
  demoOpenDatasetId: string;
  demoShareSnapshotPermalink: string;
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
          ed25519PublicKey: DEMO_OPEN_SIGNER_PUBLIC_KEY,
        },
        {
          id: DEMO_REVIEWER_PRINCIPAL_ID,
          kind: 'user',
          displayName: 'Demo Reviewer',
          userId: DEMO_REVIEWER_USER_ID,
          ed25519PublicKey: DEMO_REVIEWER_PUBLIC_KEY,
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

    // Older local databases may already have the demo principals from a
    // previous seed run. Keep their public keys current so open-content
    // verification is strict instead of falling back to unsigned demos.
    await db
      .update(schema.principal)
      .set({ ed25519PublicKey: DEMO_OPEN_SIGNER_PUBLIC_KEY })
      .where(eq(schema.principal.id, DEMO_OPEN_SIGNER_PRINCIPAL_ID));
    await db
      .update(schema.principal)
      .set({ ed25519PublicKey: DEMO_REVIEWER_PUBLIC_KEY })
      .where(eq(schema.principal.id, DEMO_REVIEWER_PRINCIPAL_ID));

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

    await seedOpenContentDemo(db);

    return {
      servicePrincipalId: SERVICE_PRINCIPAL_ID,
      demoUserPrincipalId: DEMO_USER_PRINCIPAL_ID,
      demoUserUserId: DEMO_USER_USER_ID,
      citationAgentId: CITATION_AGENT_ID,
      citationAgentPrincipalId: CITATION_AGENT_PRINCIPAL_ID,
      citationLookupPromptTemplateId: CITATION_LOOKUP_PROMPT_TEMPLATE_ID,
      demoDocumentId: DEMO_DOCUMENT_ID,
      demoReviewerPrincipalId: DEMO_REVIEWER_PRINCIPAL_ID,
      demoOpenQuestionId: DEMO_OPEN_QUESTION_ID,
      demoOpenDatasetId: DEMO_OPEN_DATASET_ID,
      demoShareSnapshotPermalink: DEMO_SHARE_SNAPSHOT_CONTENT.permalinkHash,
    };
  } finally {
    await close();
  }
}

async function seedOpenContentDemo(db: Database): Promise<void> {
  await seedDemoOpenQuestion(db);
  await seedDemoOpenReview(db);
  await seedDemoOpenDataset(db);
  await seedDemoShareSnapshot(db);
}

async function seedDemoOpenQuestion(db: Database): Promise<void> {
  const existing = await db
    .select({ id: schema.openQuestion.id })
    .from(schema.openQuestion)
    .where(eq(schema.openQuestion.id, DEMO_OPEN_QUESTION_ID))
    .limit(1);
  if (existing.length > 0) return;

  const entry = buildDemoEntry({
    entityKind: 'open_question',
    entityId: DEMO_OPEN_QUESTION_ID,
    merkleEntryId: 'merkle:demo-question',
    payload: DEMO_OPEN_QUESTION_CONTENT,
    signerPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
    secretKeyHex: DEMO_OPEN_SIGNER_SECRET_HEX,
    prevEntryId: await loadLatestMerkleEntryId(db),
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.provenanceMerkleLog).values({
      id: entry.merkleEntry.id,
      prevEntryId: entry.merkleEntry.prevEntryId,
      entityKind: entry.merkleEntry.entityKind,
      entityId: entry.merkleEntry.entityId,
      contentHash: entry.merkleEntry.contentHash,
      signedJws: entry.merkleEntry.signedJws,
      signerPrincipalId: entry.merkleEntry.signerPrincipalId,
    });
    await tx.insert(schema.openQuestion).values({
      id: DEMO_OPEN_QUESTION_ID,
      askerPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
      askerOrcidId: '0000-0002-1825-0097',
      questionMd: DEMO_OPEN_QUESTION_CONTENT.questionMd,
      domainTags: [...DEMO_OPEN_QUESTION_CONTENT.domainTags],
      signedPayloadJws: entry.signedJws,
      merkleLogEntryId: entry.merkleEntry.id,
    });
  });
}

async function seedDemoOpenReview(db: Database): Promise<void> {
  const existing = await db
    .select({ id: schema.openPeerReview.id })
    .from(schema.openPeerReview)
    .where(eq(schema.openPeerReview.id, DEMO_OPEN_REVIEW_ID))
    .limit(1);
  if (existing.length > 0) return;

  const entry = buildDemoEntry({
    entityKind: 'open_peer_review',
    entityId: DEMO_OPEN_REVIEW_ID,
    merkleEntryId: 'merkle:demo-review',
    payload: DEMO_OPEN_REVIEW_CONTENT,
    signerPrincipalId: DEMO_REVIEWER_PRINCIPAL_ID,
    secretKeyHex: DEMO_REVIEWER_SECRET_HEX,
    prevEntryId: await loadLatestMerkleEntryId(db),
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.provenanceMerkleLog).values({
      id: entry.merkleEntry.id,
      prevEntryId: entry.merkleEntry.prevEntryId,
      entityKind: entry.merkleEntry.entityKind,
      entityId: entry.merkleEntry.entityId,
      contentHash: entry.merkleEntry.contentHash,
      signedJws: entry.merkleEntry.signedJws,
      signerPrincipalId: entry.merkleEntry.signerPrincipalId,
    });
    await tx.insert(schema.openPeerReview).values({
      id: DEMO_OPEN_REVIEW_ID,
      reviewerPrincipalId: DEMO_REVIEWER_PRINCIPAL_ID,
      reviewerOrcidId: DEMO_OPEN_REVIEW_CONTENT.reviewerOrcidId,
      targetKind: 'question',
      targetId: DEMO_OPEN_QUESTION_ID,
      verdict: 'refines',
      bodyMd: DEMO_OPEN_REVIEW_CONTENT.bodyMd,
      evidenceRefs: [...DEMO_OPEN_REVIEW_CONTENT.evidenceRefs],
      signedPayloadJws: entry.signedJws,
      merkleLogEntryId: entry.merkleEntry.id,
    });
  });
}

async function seedDemoOpenDataset(db: Database): Promise<void> {
  const existing = await db
    .select({ id: schema.openDataset.id })
    .from(schema.openDataset)
    .where(eq(schema.openDataset.id, DEMO_OPEN_DATASET_ID))
    .limit(1);
  if (existing.length > 0) return;

  const entry = buildDemoEntry({
    entityKind: 'open_dataset',
    entityId: DEMO_OPEN_DATASET_ID,
    merkleEntryId: 'merkle:demo-dataset',
    payload: DEMO_OPEN_DATASET_CONTENT,
    signerPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
    secretKeyHex: DEMO_OPEN_SIGNER_SECRET_HEX,
    prevEntryId: await loadLatestMerkleEntryId(db),
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.provenanceMerkleLog).values({
      id: entry.merkleEntry.id,
      prevEntryId: entry.merkleEntry.prevEntryId,
      entityKind: entry.merkleEntry.entityKind,
      entityId: entry.merkleEntry.entityId,
      contentHash: entry.merkleEntry.contentHash,
      signedJws: entry.merkleEntry.signedJws,
      signerPrincipalId: entry.merkleEntry.signerPrincipalId,
    });
    await tx.insert(schema.openDataset).values({
      id: DEMO_OPEN_DATASET_ID,
      contributorPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
      datasetDoi: DEMO_OPEN_DATASET_CONTENT.datasetDoi,
      title: DEMO_OPEN_DATASET_CONTENT.title,
      descriptionMd: DEMO_OPEN_DATASET_CONTENT.descriptionMd,
      blobStorageRef: DEMO_OPEN_DATASET_CONTENT.blobStorageRef,
      sizeBytes: BigInt(DEMO_OPEN_DATASET_CONTENT.sizeBytes),
      licenseSpdx: DEMO_OPEN_DATASET_CONTENT.licenseSpdx,
      signedPayloadJws: entry.signedJws,
      merkleLogEntryId: entry.merkleEntry.id,
    });
  });
}

async function seedDemoShareSnapshot(db: Database): Promise<void> {
  const existing = await db
    .select({ id: schema.shareSnapshot.id })
    .from(schema.shareSnapshot)
    .where(eq(schema.shareSnapshot.id, DEMO_SHARE_SNAPSHOT_ID))
    .limit(1);
  if (existing.length > 0) return;

  const entry = buildDemoEntry({
    entityKind: 'share_snapshot',
    entityId: DEMO_SHARE_SNAPSHOT_ID,
    merkleEntryId: 'merkle:demo-snapshot',
    payload: DEMO_SHARE_SNAPSHOT_CONTENT,
    signerPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
    secretKeyHex: DEMO_OPEN_SIGNER_SECRET_HEX,
    prevEntryId: await loadLatestMerkleEntryId(db),
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.provenanceMerkleLog).values({
      id: entry.merkleEntry.id,
      prevEntryId: entry.merkleEntry.prevEntryId,
      entityKind: entry.merkleEntry.entityKind,
      entityId: entry.merkleEntry.entityId,
      contentHash: entry.merkleEntry.contentHash,
      signedJws: entry.merkleEntry.signedJws,
      signerPrincipalId: entry.merkleEntry.signerPrincipalId,
    });
    await tx.insert(schema.shareSnapshot).values({
      id: DEMO_SHARE_SNAPSHOT_ID,
      sourcePrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
      markdownContent: DEMO_SHARE_SNAPSHOT_CONTENT.markdownContent,
      yjsBinary: Buffer.from(
        DEMO_SHARE_SNAPSHOT_CONTENT.yjsBinaryBase64,
        'base64',
      ),
      kind: DEMO_SHARE_SNAPSHOT_CONTENT.kind,
      permalinkHash: DEMO_SHARE_SNAPSHOT_CONTENT.permalinkHash,
      signedPayloadJws: entry.signedJws,
      merkleLogEntryId: entry.merkleEntry.id,
    });
  });
}

async function loadLatestMerkleEntryId(db: Database): Promise<string | null> {
  const rows = await db
    .select({ id: schema.provenanceMerkleLog.id })
    .from(schema.provenanceMerkleLog)
    .orderBy(desc(schema.provenanceMerkleLog.entrySeq))
    .limit(1);
  return rows[0]?.id ?? null;
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
