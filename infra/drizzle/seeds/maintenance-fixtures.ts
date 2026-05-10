// Phase 4 W9 dogfood gate G4 (ADR-0011 §7) — maintenance fixtures seed.
//
// Seeds 6 finding fixtures (one per ScanFindingKind) into PG so a fresh
// pgboss `maintenance-scan` job will surface exactly 6 findings. The
// dashboard E2E + the e2e:dogfood:maintenance spec assert against this
// shape.
//
// Fixture map (1 finding per kind):
//   1. unsupported-claim    — approved claim with NO evidence row
//   2. outdated-source      — source whose accessed_at is 24 months old
//                             (default scan threshold = 18 months)
//   3. unverified-ai-block  — claim still 'ai-suggested' for 30 days
//                             (default scan threshold = 14 days)
//   4. contradicted-conclusion — claim with 'challenges' evidence + no
//                             synthesizing claim resolves it
//   5. duplicated-claim     — 2 claims with identical text in same vault
//   6. broken-citation      — citation row whose DOI we'll mark unresolvable
//                             via the in-memory DoiResolver in the e2e spec
//
// Idempotent: stable IDs + ON CONFLICT DO NOTHING on every insert. Re-
// running the seed against a populated DB is safe.
//
// Usage:
//   pnpm db:seed:maintenance              (CLI)
//   import { seedMaintenanceFixtures } from '...'  (e2e)

import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '../src/client';

export interface MaintenanceFixtureIds {
  vaultPrincipalId: string;
  documentId: string;
  /** One representative claim/source/citation id per finding kind. */
  unsupportedClaimId: string;
  outdatedSourceId: string;
  agingClaimId: string;
  contradictedClaimId: string;
  challengingEvidenceId: string;
  duplicatedClaimAId: string;
  duplicatedClaimBId: string;
  brokenCitationId: string;
  brokenCitationDoi: string;
}

// Stable IDs so the seed is idempotent.
const VAULT_PRINCIPAL_ID = 'user:00000000-0000-7000-8000-000000000001';
const FIXTURE_DOC_ID = '00000000-0000-7000-8000-0000000fdoc1';

// One claim / evidence / source / citation per kind. UUIDs encode the
// finding kind for easy debugging.
const UNSUP_CLAIM_ID = '00000000-0000-7000-8000-0001unsup0001';
const OUTDATED_SOURCE_ID = '00000000-0000-7000-8000-0002outds0001';
const AGING_CLAIM_ID = '00000000-0000-7000-8000-0003aging0001';
const CONTRA_CLAIM_ID = '00000000-0000-7000-8000-0004ctra00001';
const CHALL_EVIDENCE_ID = '00000000-0000-7000-8000-0004ctraEv001';
const DUP_CLAIM_A_ID = '00000000-0000-7000-8000-0005dupAA0001';
const DUP_CLAIM_B_ID = '00000000-0000-7000-8000-0005dupBB0001';
const BROKEN_CIT_ID = '00000000-0000-7000-8000-0006broken0001';
const BROKEN_CIT_DOI = '10.9999/dogfood-broken-citation-fixture';

const DUPLICATED_TEXT = 'CRDTs converge under arbitrary network reordering';

/**
 * Seed the 6 maintenance fixtures. Caller must have already seeded the
 * service principal + demo user (the regular `seed.ts` does this);
 * vaultPrincipalId is reused.
 */
export async function seedMaintenanceFixtures(
  databaseUrl?: string,
): Promise<MaintenanceFixtureIds> {
  const { db, close } = openDatabase({ url: databaseUrl });

  try {
    // ---- Document the fixtures live in (vault scope = user principal) ----
    await db
      .insert(schema.document)
      .values({
        id: FIXTURE_DOC_ID,
        ownerPrincipalId: VAULT_PRINCIPAL_ID,
        primaryLanguage: 'zh-Hans',
        bilingualMode: 'mixed',
        title: 'Dogfood G4 maintenance fixture / 维护扫描夹具',
        slug: 'dogfood-maintenance-fixture',
      })
      .onConflictDoNothing({ target: schema.document.id });

    // ---- Citation row: needed by broken-citation + others. ----
    await db
      .insert(schema.citation)
      .values({
        id: BROKEN_CIT_ID,
        kind: 'doi',
        doi: BROKEN_CIT_DOI,
        cslJson: {
          type: 'article-journal',
          title: 'Phantom paper that never existed',
          DOI: BROKEN_CIT_DOI,
          author: [{ family: 'Nobody', given: 'A.' }],
        },
        createdBy: VAULT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.citation.id });

    // ---- 1. unsupported-claim: approved claim, no evidence. ----
    await db
      .insert(schema.claim)
      .values({
        id: UNSUP_CLAIM_ID,
        text: 'Caffeine improves endurance performance in trained athletes',
        claimType: 'main',
        status: 'approved',
        confidence: 'medium',
        documentOriginId: FIXTURE_DOC_ID,
        createdBy: VAULT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.claim.id });

    // ---- 2. outdated-source: accessed_at = 24 months ago. ----
    {
      const accessed = new Date();
      accessed.setMonth(accessed.getMonth() - 24);
      await db
        .insert(schema.source)
        .values({
          id: OUTDATED_SOURCE_ID,
          kind: 'web',
          title: 'Decade-old methodology blog (link rot)',
          url: 'https://example.invalid/outdated-source-fixture',
          trustLevel: 'low',
          importedBy: VAULT_PRINCIPAL_ID,
          accessedAt: accessed,
          citationId: null,
        })
        .onConflictDoNothing({ target: schema.source.id });
    }

    // ---- 3. unverified-ai-block: ai-suggested claim, 30 days old. ----
    {
      const created = new Date();
      created.setDate(created.getDate() - 30);
      await db
        .insert(schema.claim)
        .values({
          id: AGING_CLAIM_ID,
          text: 'Yjs subdocuments scale linearly past 10k peers (un-vetted)',
          claimType: 'main',
          status: 'ai-suggested',
          confidence: 'low',
          documentOriginId: FIXTURE_DOC_ID,
          createdBy: VAULT_PRINCIPAL_ID,
          createdAt: created,
        })
        .onConflictDoNothing({ target: schema.claim.id });
    }

    // ---- 4. contradicted-conclusion: claim + challenging evidence + no synthesis. ----
    await db
      .insert(schema.claim)
      .values({
        id: CONTRA_CLAIM_ID,
        text: 'Single-master CRDTs always outperform multi-master at scale',
        claimType: 'main',
        status: 'approved',
        confidence: 'medium',
        documentOriginId: FIXTURE_DOC_ID,
        createdBy: VAULT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.claim.id });
    await db
      .insert(schema.evidence)
      .values({
        id: CHALL_EVIDENCE_ID,
        excerpt:
          'Benchmark on 10k-peer fanout shows multi-master wins by 1.4× tail latency.',
        supportsClaimId: CONTRA_CLAIM_ID,
        relation: 'challenges',
        status: 'approved',
        documentOriginId: FIXTURE_DOC_ID,
        createdBy: VAULT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.evidence.id });

    // ---- 5. duplicated-claim: two approved claims, same text. ----
    await db
      .insert(schema.claim)
      .values({
        id: DUP_CLAIM_A_ID,
        text: DUPLICATED_TEXT,
        claimType: 'main',
        status: 'approved',
        confidence: 'medium',
        documentOriginId: FIXTURE_DOC_ID,
        createdBy: VAULT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.claim.id });
    await db
      .insert(schema.claim)
      .values({
        id: DUP_CLAIM_B_ID,
        text: DUPLICATED_TEXT,
        claimType: 'main',
        status: 'approved',
        confidence: 'medium',
        documentOriginId: FIXTURE_DOC_ID,
        createdBy: VAULT_PRINCIPAL_ID,
      })
      .onConflictDoNothing({ target: schema.claim.id });

    // ---- 6. broken-citation: citation already INSERTed above; the
    // scan path is opt-in + needs a DoiResolver. The e2e spec passes a
    // stub that returns ok=false for BROKEN_CIT_DOI to surface this
    // finding without hitting the real doi.org. ----

    return {
      vaultPrincipalId: VAULT_PRINCIPAL_ID,
      documentId: FIXTURE_DOC_ID,
      unsupportedClaimId: UNSUP_CLAIM_ID,
      outdatedSourceId: OUTDATED_SOURCE_ID,
      agingClaimId: AGING_CLAIM_ID,
      contradictedClaimId: CONTRA_CLAIM_ID,
      challengingEvidenceId: CHALL_EVIDENCE_ID,
      duplicatedClaimAId: DUP_CLAIM_A_ID,
      duplicatedClaimBId: DUP_CLAIM_B_ID,
      brokenCitationId: BROKEN_CIT_ID,
      brokenCitationDoi: BROKEN_CIT_DOI,
    };
  } finally {
    await close();
  }
}

// Helper for tests: produce a stub DoiResolver that returns ok=false
// for the seeded broken-citation fixture only. Other DOIs resolve as
// ok=true so live citations don't trip the broken-citation path.
export function makeFixtureDoiResolver(): {
  resolve(doi: string): Promise<{ ok: boolean; reason?: string }>;
} {
  return {
    async resolve(doi: string) {
      if (doi === BROKEN_CIT_DOI) {
        return { ok: false, reason: 'fixture: simulated 404 for dogfood G4' };
      }
      return { ok: true };
    },
  };
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMaintenanceFixtures()
    .then((ids) => {
      console.log('[seed:maintenance] ok');
      console.log(JSON.stringify(ids, null, 2));
      // suppress unused uuid import lint when no fresh ids are minted
      void uuidv7;
    })
    .catch((err) => {
      console.error('[seed:maintenance] failed:', err);
      process.exit(1);
    });
}
