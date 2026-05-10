// Phase 4 W4 maintenance-scan tests.
//
// We stub the DbExecutor so these tests don't need a real Postgres.
// The stub's `select().from().where()` chain is intercepted to return
// canned rows for each finding kind. This is good enough to verify:
//   - The 3 SQL-pure finding generators produce the expected
//     PendingFinding shape.
//   - severity / kind / details mappings match design.
//   - Aging / staleness thresholds are honoured.
//
// Real PG round-trip lives in the drizzle round-trip suite; this
// module only checks the JS-side composition.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  scanForFindings,
  type PendingFinding,
  type ScanInput,
} from '../src/maintenance-scan';

// ---------- Stub DbExecutor ----------
// The scan module calls `db.select(...).from(table).leftJoin(...).where(...)`
// and `db.select(...).from(table).where(...)`. We build a chainable
// stub that returns user-provided rows when the chain terminates.

interface StubResponse {
  table: 'claim' | 'evidence' | 'source' | 'document';
  rows: unknown[];
}

function makeStubDb(responses: StubResponse[]): unknown {
  let pulled = 0;
  function chain(): unknown {
    return {
      from: (_table: unknown) => {
        const fromTableName = String(
          (_table as { _?: { name?: string } })._?.name ?? '',
        );
        // Pull the next response that matches the table name (or fall
        // back to FIFO if the stub doesn't tag rows). The scan module
        // uses 4 different tables, so order matters for tests below.
        const idx = responses.findIndex(
          (r) => fromTableName.includes(r.table) || responses.indexOf(r) === pulled,
        );
        const resp = idx >= 0 ? responses[idx]! : responses[pulled]!;
        pulled++;
        const rows = resp ? resp.rows : [];
        const terminal = Promise.resolve(rows);
        const builder: Record<string, unknown> = {
          leftJoin: () => builder,
          where: () => terminal,
          limit: () => terminal,
          then: terminal.then.bind(terminal),
        };
        return builder;
      },
    };
  }
  return {
    select: () => chain(),
  };
}

function baseInput(jobId = 'job-1'): ScanInput {
  return {
    scope: { kind: 'vault', vaultPrincipalId: 'principal:user-1' as never },
    jobId,
  };
}

describe('scanForFindings — unsupported-claim', () => {
  it('emits a high severity finding for approved claim with no evidence', async () => {
    const db = makeStubDb([
      // claim leftJoin evidence — one approved claim, evidence null
      {
        table: 'claim',
        rows: [
          {
            claimId: 'claim:c1',
            claimText: 'Caffeine improves endurance performance',
            claimStatus: 'approved',
            documentOriginId: 'doc:1',
          },
          // deprecated claim should be filtered out
          {
            claimId: 'claim:c2',
            claimText: 'old claim',
            claimStatus: 'deprecated',
            documentOriginId: 'doc:1',
          },
        ],
      },
      // outdated-source not requested
      { table: 'source', rows: [] },
      // unverified-ai-block (claims) not requested
      { table: 'claim', rows: [] },
      { table: 'evidence', rows: [] },
    ]);

    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unsupported-claim'],
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.kind, 'unsupported-claim');
    assert.equal(findings[0]!.severity, 'high');
    assert.equal(findings[0]!.claimId, 'claim:c1');
    assert.equal(findings[0]!.documentId, 'doc:1');
    assert.match(findings[0]!.summary, /Caffeine improves endurance/);
  });

  it('downgrades severity to medium when claim is ai-suggested', async () => {
    const db = makeStubDb([
      {
        table: 'claim',
        rows: [
          {
            claimId: 'claim:c3',
            claimText: 'A speculative idea',
            claimStatus: 'ai-suggested',
            documentOriginId: 'doc:2',
          },
        ],
      },
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unsupported-claim'],
    });
    assert.equal(findings[0]!.severity, 'medium');
  });
});

describe('scanForFindings — outdated-source', () => {
  it('flags sources whose accessed_at predates the cutoff', async () => {
    const oldDate = new Date(Date.now() - 600 * 24 * 60 * 60 * 1000);
    const db = makeStubDb([
      {
        table: 'source',
        rows: [
          {
            sourceId: 'src:1',
            title: 'Old paper from 2024',
            accessedAt: oldDate,
          },
        ],
      },
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['outdated-source'],
      outdatedSourceDays: 540,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.kind, 'outdated-source');
    assert.equal(findings[0]!.severity, 'low');
    assert.equal(findings[0]!.sourceId, 'src:1');
    assert.match(findings[0]!.summary, /Old paper from 2024/);
    const detail = findings[0]!.details as { cutoffDays: number };
    assert.equal(detail.cutoffDays, 540);
  });

  it('emits no finding when sources list is empty', async () => {
    const db = makeStubDb([{ table: 'source', rows: [] }]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['outdated-source'],
    });
    assert.equal(findings.length, 0);
  });
});

describe('scanForFindings — unverified-ai-block', () => {
  it('flags both aging claims and aging evidence', async () => {
    const aged = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const db = makeStubDb([
      // claim rows
      {
        table: 'claim',
        rows: [
          {
            claimId: 'claim:ai-1',
            claimText: 'AI-suggested claim from 30 days ago',
            createdAt: aged,
            documentOriginId: 'doc:42',
          },
        ],
      },
      // evidence rows
      {
        table: 'evidence',
        rows: [
          {
            evidenceId: 'ev:ai-1',
            excerpt: 'AI-suggested evidence from 30 days ago',
            createdAt: aged,
          },
        ],
      },
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unverified-ai-block'],
      unverifiedAiAgingDays: 14,
    });
    assert.equal(findings.length, 2);
    assert.deepEqual(
      findings.map((f) => f.kind),
      ['unverified-ai-block', 'unverified-ai-block'],
    );
    const claimF = findings.find((f) => f.claimId !== null)!;
    const evidenceF = findings.find((f) => f.evidenceId !== null)!;
    assert.equal(claimF.severity, 'medium');
    assert.match(claimF.summary, /AI-suggested claim/);
    assert.equal(evidenceF.severity, 'medium');
    assert.match(evidenceF.summary, /AI-suggested evidence/);
    const ageDays = (claimF.details as { ageDays: number }).ageDays;
    assert.ok(ageDays >= 29 && ageDays <= 31, 'ageDays ≈ 30');
  });
});

describe('scanForFindings — combined', () => {
  it('runs default 3 kinds when findingKinds omitted', async () => {
    const db = makeStubDb([
      // unsupported-claim: returns []
      { table: 'claim', rows: [] },
      // outdated-source: returns []
      { table: 'source', rows: [] },
      // unverified-ai-block claims: []
      { table: 'claim', rows: [] },
      // unverified-ai-block evidence: []
      { table: 'evidence', rows: [] },
    ]);
    const findings: PendingFinding[] = await scanForFindings(
      db as never,
      baseInput(),
    );
    assert.equal(findings.length, 0);
  });
});
