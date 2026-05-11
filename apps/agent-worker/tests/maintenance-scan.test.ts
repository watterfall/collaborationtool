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
  type DoiResolver,
  type PendingFinding,
  type ScanInput,
} from '../src/maintenance-scan';

// ---------- Stub DbExecutor ----------
// The scan module calls drizzle-style chains like:
//   db.select(...).from(table).leftJoin(...).where(...)            (await)
//   db.select(...).from(table).where(...).groupBy(...).having(...) (await)
//   db.select(...).from(table).where(...).limit(N)                 (await)
// We build a chainable stub that returns user-provided rows when the
// chain `await`s. Phase 4 W4 added groupBy/having + citation table.

interface StubResponse {
  table: 'claim' | 'evidence' | 'source' | 'document' | 'citation';
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
        // uses 5 different tables now, so order matters for tests below.
        const idx = responses.findIndex(
          (r) => fromTableName.includes(r.table) || responses.indexOf(r) === pulled,
        );
        const resp = idx >= 0 ? responses[idx]! : responses[pulled]!;
        pulled++;
        const rows = resp ? resp.rows : [];
        const terminal = Promise.resolve(rows);
        // All chain methods return the same builder, which is itself
        // awaitable via `then`. This collapses the various drizzle
        // chains into a single thenable that yields canned rows.
        const builder: Record<string, unknown> = {};
        builder['leftJoin'] = () => builder;
        builder['innerJoin'] = () => builder;
        builder['where'] = () => builder;
        builder['groupBy'] = () => builder;
        builder['having'] = () => builder;
        builder['limit'] = () => builder;
        builder['then'] = terminal.then.bind(terminal);
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
  it('runs default 5 kinds when findingKinds omitted (broken-citation opt-in only)', async () => {
    const db = makeStubDb([
      // unsupported-claim: returns []
      { table: 'claim', rows: [] },
      // outdated-source: returns []
      { table: 'source', rows: [] },
      // unverified-ai-block claims: []
      { table: 'claim', rows: [] },
      // unverified-ai-block evidence: []
      { table: 'evidence', rows: [] },
      // contradicted-conclusion: []
      { table: 'claim', rows: [] },
      // duplicated-claim: []
      { table: 'claim', rows: [] },
    ]);
    const findings: PendingFinding[] = await scanForFindings(
      db as never,
      baseInput(),
    );
    assert.equal(findings.length, 0);
  });
});

describe('scanForFindings — contradicted-conclusion', () => {
  it('emits high severity for approved claim with challenging evidence + no synthesis', async () => {
    // The SQL EXISTS / NOT EXISTS push filtering into PG; the stub
    // simulates "rows that survived the filters" so we only assert
    // the JS-side mapping shape.
    const db = makeStubDb([
      {
        table: 'claim',
        rows: [
          {
            claimId: 'claim:c1',
            claimText: 'X causes Y in cohort A',
            claimStatus: 'approved',
            documentOriginId: 'doc:1',
          },
          {
            claimId: 'claim:c2',
            claimText: 'preliminary speculative claim',
            claimStatus: 'ai-suggested',
            documentOriginId: 'doc:2',
          },
        ],
      },
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['contradicted-conclusion'],
    });
    assert.equal(findings.length, 2);
    const approved = findings.find((f) => f.claimId === 'claim:c1')!;
    const aiSugg = findings.find((f) => f.claimId === 'claim:c2')!;
    assert.equal(approved.kind, 'contradicted-conclusion');
    assert.equal(approved.severity, 'high');
    assert.match(approved.summary, /challenging evidence/);
    assert.equal(approved.documentId, 'doc:1');
    assert.equal(aiSugg.severity, 'medium');
  });

  it('emits zero findings when stub returns no contradicted claims', async () => {
    const db = makeStubDb([{ table: 'claim', rows: [] }]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['contradicted-conclusion'],
    });
    assert.equal(findings.length, 0);
  });
});

describe('scanForFindings — duplicated-claim', () => {
  it('expands one group of N duplicates into N findings with otherClaimIds', async () => {
    // Stub returns the result of GROUP BY text HAVING count > 1: one
    // row per duplicate-text group with array_agg fields.
    const db = makeStubDb([
      {
        table: 'claim',
        rows: [
          {
            text: 'Caffeine boosts endurance',
            claimIds: ['claim:c1', 'claim:c2', 'claim:c3'],
            documentOriginIds: ['doc:1', 'doc:2', 'doc:1'],
            statuses: ['approved', 'ai-suggested', 'human-reviewed'],
          },
        ],
      },
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['duplicated-claim'],
    });
    assert.equal(findings.length, 3);
    for (const f of findings) {
      assert.equal(f.kind, 'duplicated-claim');
      const details = f.details as {
        otherClaimIds: string[];
        method: string;
        totalDuplicates: number;
      };
      assert.equal(details.method, 'exact-text-match');
      assert.equal(details.totalDuplicates, 3);
      assert.equal(details.otherClaimIds.length, 2);
      assert.ok(!details.otherClaimIds.includes(f.claimId!));
    }
    // Severity follows status: approved → medium; others → low.
    const approved = findings.find((f) => f.claimId === 'claim:c1')!;
    const ai = findings.find((f) => f.claimId === 'claim:c2')!;
    assert.equal(approved.severity, 'medium');
    assert.equal(ai.severity, 'low');
  });

  it('emits zero findings when no group has count > 1', async () => {
    const db = makeStubDb([{ table: 'claim', rows: [] }]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['duplicated-claim'],
    });
    assert.equal(findings.length, 0);
  });
});

// Phase 5 Wave B B4 — unverified-claim stub helper. The shared stub
// matches by substring, which is ambiguous between `claim` and
// `claim_review`; the FIFO helper below sidesteps that for the
// 2-query scan flow.
function makeFifoStubDb(rowSets: unknown[][]): unknown {
  let pulled = 0;
  function chain(): unknown {
    return {
      from: () => {
        const rows = rowSets[pulled] ?? [];
        pulled++;
        const terminal = Promise.resolve(rows);
        const builder: Record<string, unknown> = {};
        builder['leftJoin'] = () => builder;
        builder['innerJoin'] = () => builder;
        builder['where'] = () => builder;
        builder['groupBy'] = () => builder;
        builder['having'] = () => builder;
        builder['limit'] = () => builder;
        builder['then'] = terminal.then.bind(terminal);
        return builder;
      },
    };
  }
  return { select: () => chain() };
}

describe('scanForFindings — unverified-claim (Phase 5 Wave B B4 / ADR-0016 §2.6)', () => {
  it('flags agent-created claim with no human endorsement after 30+ days', async () => {
    const oldClaim = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const db = makeFifoStubDb([
      // 1st query: claim INNER JOIN principal
      [
        {
          claimId: 'claim:agent-old',
          claimText: 'AI 写出的论点，超过 30 天无人背书',
          claimStatus: 'ai-suggested',
          createdAt: oldClaim,
          documentOriginId: 'doc:1',
          createdByKind: 'agent',
        },
      ],
      // 2nd query: claim_review endorsing-human verdicts (none for this claim)
      [],
    ]);
    const findings: PendingFinding[] = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unverified-claim'],
    });
    assert.equal(findings.length, 1);
    const f = findings[0]!;
    assert.equal(f.kind, 'unverified-claim');
    assert.equal(f.severity, 'medium');
    assert.equal(f.claimId, 'claim:agent-old');
    assert.equal(f.documentId, 'doc:1');
    assert.match(f.summary, /no human-ORCID endorsement/);
    assert.equal((f.details as { agingDays: number }).agingDays, 30);
    assert.equal((f.details as { createdByKind: string }).createdByKind, 'agent');
  });

  it('skips agent-created claim once an endorsing human verdict exists', async () => {
    const oldClaim = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const db = makeFifoStubDb([
      [
        {
          claimId: 'claim:endorsed',
          claimText: '论点已被人类同意',
          claimStatus: 'ai-suggested',
          createdAt: oldClaim,
          documentOriginId: 'doc:1',
          createdByKind: 'agent',
        },
      ],
      // Endorsement exists for this exact claim id.
      [{ claimId: 'claim:endorsed' }],
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unverified-claim'],
    });
    assert.equal(findings.length, 0);
  });

  it('skips deprecated / superseded claims even when aging', async () => {
    const oldClaim = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const db = makeFifoStubDb([
      [
        {
          claimId: 'claim:gone',
          claimText: '已废弃',
          claimStatus: 'deprecated',
          createdAt: oldClaim,
          documentOriginId: 'doc:1',
          createdByKind: 'agent',
        },
        {
          claimId: 'claim:supersededby',
          claimText: '已被新版替代',
          claimStatus: 'superseded',
          createdAt: oldClaim,
          documentOriginId: 'doc:1',
          createdByKind: 'agent',
        },
      ],
      [],
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unverified-claim'],
    });
    assert.equal(findings.length, 0);
  });

  it('returns empty when no candidate claims pass the agent + aging filter', async () => {
    const db = makeFifoStubDb([[], []]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unverified-claim'],
    });
    assert.equal(findings.length, 0);
  });

  it('honors a custom unverifiedClaimAgingDays threshold', async () => {
    // ADR-0016 §2.6 ships 30d as the default; Wave D may tune. Verify
    // override flows into the details payload.
    const oldClaim = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
    const db = makeFifoStubDb([
      [
        {
          claimId: 'claim:tight-threshold',
          claimText: 'short window claim',
          claimStatus: 'ai-suggested',
          createdAt: oldClaim,
          documentOriginId: 'doc:1',
          createdByKind: 'agent',
        },
      ],
      [],
    ]);
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['unverified-claim'],
      unverifiedClaimAgingDays: 7,
    });
    assert.equal(findings.length, 1);
    assert.equal(
      (findings[0]!.details as { agingDays: number }).agingDays,
      7,
    );
  });
});

describe('scanForFindings — broken-citation', () => {
  it('emits high severity finding for each unresolvable DOI', async () => {
    const db = makeStubDb([
      {
        table: 'citation',
        rows: [
          { citationId: 'cit:1', doi: '10.1234/ok', kind: 'article' },
          { citationId: 'cit:2', doi: '10.1234/dead', kind: 'article' },
          { citationId: 'cit:3', doi: '10.5555/timeout', kind: 'preprint' },
        ],
      },
    ]);
    const resolver: DoiResolver = {
      resolve: async (doi) => {
        if (doi === '10.1234/ok') return { ok: true };
        if (doi === '10.1234/dead')
          return { ok: false, reason: 'http-404' };
        return { ok: false, reason: 'timeout-8000ms' };
      },
    };
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['broken-citation'],
      doiResolver: resolver,
    });
    assert.equal(findings.length, 2);
    for (const f of findings) {
      assert.equal(f.kind, 'broken-citation');
      assert.equal(f.severity, 'high');
      assert.equal(f.claimId, null);
      assert.notEqual(f.citationId, null);
    }
    const dead = findings.find((f) => f.citationId === 'cit:2')!;
    assert.equal((dead.details as { reason: string }).reason, 'http-404');
    const timeout = findings.find((f) => f.citationId === 'cit:3')!;
    assert.equal(
      (timeout.details as { reason: string }).reason,
      'timeout-8000ms',
    );
  });

  it('throws when broken-citation is requested but no doiResolver provided', async () => {
    const db = makeStubDb([{ table: 'citation', rows: [] }]);
    await assert.rejects(
      scanForFindings(db as never, {
        ...baseInput(),
        findingKinds: ['broken-citation'],
      }),
      /broken-citation requested but no doiResolver/,
    );
  });

  it('skips citations with null doi gracefully', async () => {
    // The SQL filter would exclude these, but if the stub returns one
    // anyway we still skip rather than crashing the resolver call.
    const db = makeStubDb([
      {
        table: 'citation',
        rows: [
          { citationId: 'cit:bad', doi: null, kind: 'article' },
          { citationId: 'cit:good', doi: '10.1/x', kind: 'article' },
        ],
      },
    ]);
    let resolveCalls = 0;
    const resolver: DoiResolver = {
      resolve: async () => {
        resolveCalls++;
        return { ok: true };
      },
    };
    const findings = await scanForFindings(db as never, {
      ...baseInput(),
      findingKinds: ['broken-citation'],
      doiResolver: resolver,
    });
    assert.equal(findings.length, 0);
    assert.equal(resolveCalls, 1, 'resolver only called for non-null DOI');
  });
});
