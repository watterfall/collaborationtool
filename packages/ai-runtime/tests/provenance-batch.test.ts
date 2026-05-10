// Phase 4 W7.4 unit tests for persistProposalBatch.
// No PG dependency — fakes the DbExecutor surface (transaction +
// chainable insert().values().onConflictDoNothing()) so we can
// observe transaction count and per-table row arrays.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  persistProposal,
  persistProposalBatch,
  type PersistProposalInput,
} from '../src/provenance-writer';
import type { SkillMeta } from '../src/skills-loader';
import type { AgentProposal } from '../src/types';

// --------- fake db ---------

interface FakeInsertCall {
  table: 'prompt_template' | 'provenance' | 'revision' | 'unknown';
  rowCount: number;
}

function makeFakeDb() {
  const insertCalls: FakeInsertCall[] = [];
  // captured rows per table, flat across all .values() calls
  const rowsByTable: Record<FakeInsertCall['table'], unknown[]> = {
    prompt_template: [],
    provenance: [],
    revision: [],
    unknown: [],
  };
  let txCount = 0;

  function classify(table: unknown): FakeInsertCall['table'] {
    // Drizzle's pgTable carries an internal Symbol with the table name
    // we don't have access to without infra/drizzle here. We tag via
    // an own-property `__name` set by the schema mock OR fall back to
    // Symbol(.Name). For the real schema imported via the source path,
    // each pgTable has a `[Symbol.for('drizzle:Name')]` entry.
    const t = table as Record<string | symbol, unknown>;
    const symName = Object.getOwnPropertySymbols(t).find(
      (s) => s.toString() === 'Symbol(drizzle:Name)',
    );
    const name =
      (symName && typeof t[symName] === 'string' ? (t[symName] as string) : '') ||
      ((t as { _?: { name?: string } })._?.name ?? '');
    if (name === 'prompt_template') return 'prompt_template';
    if (name === 'provenance') return 'provenance';
    if (name === 'revision') return 'revision';
    return 'unknown';
  }

  const tx = {
    insert(table: unknown) {
      const tableKind = classify(table);
      let storedRows: unknown[] = [];
      const builder: Record<string, unknown> = {
        values(rows: unknown) {
          storedRows = Array.isArray(rows) ? rows : [rows];
          insertCalls.push({ table: tableKind, rowCount: storedRows.length });
          rowsByTable[tableKind].push(...storedRows);
          // Return the same builder so .onConflictDoNothing chains.
          // Also serve as a thenable so `await tx.insert().values(...)`
          // resolves without a method chain.
          return builder;
        },
        onConflictDoNothing(_target?: unknown) {
          return builder;
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(storedRows).then(resolve);
        },
      };
      return builder;
    },
    // For accept/reject paths (not exercised here) — minimal stubs.
    select() {
      return {
        from() {
          return {
            where() {
              return { limit: async () => [] };
            },
          };
        },
      };
    },
    update() {
      return {
        set() {
          return { where: async () => undefined };
        },
      };
    },
    transaction<T>(cb: (innerTx: unknown) => Promise<T>): Promise<T> {
      txCount++;
      return cb(tx);
    },
  };

  return {
    db: tx as unknown as Parameters<typeof persistProposalBatch>[0],
    insertCalls,
    rowsByTable,
    get txCount() {
      return txCount;
    },
  };
}

// --------- fixtures ---------

function makeSkill(promptHash: string, skillId = 'reviewer-tone'): SkillMeta {
  return {
    skillId,
    name: skillId,
    description: 'fixture',
    allowedMcpServers: [],
    requiredCapabilities: [],
    bodyMarkdown: '# fixture body',
    promptHash,
    promptTemplateId: `${skillId}@${promptHash.slice(0, 12)}`,
    contentBytes: 64,
  };
}

function makeProposal(agentId = 'agent:reviewer-1'): AgentProposal {
  return {
    proposalRationale: 'tighten prose',
    revisedFragments: [
      {
        originalText: 'foo',
        replacementText: 'bar',
      },
    ],
    uncertainties: [],
    toolCalls: [],
    agentContext: {
      agentId: agentId.replace(/^agent:/, ''),
      skillId: 'reviewer-tone',
      promptTemplateId: 'reviewer-tone@abcdef012345',
      promptHash: 'abcdef012345',
      modelId: 'claude-sonnet-4',
    } as unknown as AgentProposal['agentContext'],
    startedAt: '2026-05-10T00:00:00.000Z' as AgentProposal['startedAt'],
    finishedAt: '2026-05-10T00:00:01.000Z' as AgentProposal['finishedAt'],
  };
}

function makeInput(
  i: number,
  opts: { sharedHash?: string } = {},
): PersistProposalInput {
  const hash = opts.sharedHash ?? `hash-${i.toString().padStart(8, '0')}aaaaaaaaaaaa`;
  return {
    proposal: makeProposal(`agent:reviewer-${i}`),
    skill: makeSkill(hash),
    documentId: `doc:phase4-w74-${i}`,
  };
}

// --------- tests ---------

describe('persistProposalBatch', () => {
  it('runs in a single transaction for 20 inputs', async () => {
    const fake = makeFakeDb();
    const inputs = Array.from({ length: 20 }, (_, i) => makeInput(i));

    const results = await persistProposalBatch(fake.db, inputs);

    assert.equal(results.length, 20);
    assert.equal(
      fake.txCount,
      1,
      `expected 1 transaction, got ${fake.txCount}`,
    );
    // 1 prompt_template insert (deduped per skill — each input has a
    // distinct hash here, so 20 rows in ONE INSERT) + 1 provenance
    // insert + 1 revision insert = 3 statements total.
    const insertsByTable = fake.insertCalls.reduce<Record<string, number>>(
      (acc, c) => {
        acc[c.table] = (acc[c.table] ?? 0) + 1;
        return acc;
      },
      {},
    );
    assert.equal(insertsByTable['prompt_template'], 1);
    assert.equal(insertsByTable['provenance'], 1);
    assert.equal(insertsByTable['revision'], 1);
    assert.equal(fake.rowsByTable.provenance.length, 20);
    assert.equal(fake.rowsByTable.revision.length, 20);
  });

  it('dedupes prompt_template by promptTemplateId', async () => {
    const fake = makeFakeDb();
    const sharedHash = 'sharedhash01' + 'a'.repeat(52);
    const inputs = Array.from({ length: 5 }, (_, i) =>
      makeInput(i, { sharedHash }),
    );

    await persistProposalBatch(fake.db, inputs);

    assert.equal(
      fake.rowsByTable.prompt_template.length,
      1,
      '5 inputs sharing the same skill should collapse to 1 prompt_template row',
    );
    assert.equal(fake.rowsByTable.provenance.length, 5);
    assert.equal(fake.rowsByTable.revision.length, 5);
  });

  it('returns results aligned 1:1 with input order', async () => {
    const fake = makeFakeDb();
    const inputs = [makeInput(0), makeInput(1), makeInput(2)];

    const results = await persistProposalBatch(fake.db, inputs);

    assert.equal(results.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.ok(results[i]!.revisionId, `result[${i}].revisionId set`);
      assert.ok(results[i]!.provenanceId, `result[${i}].provenanceId set`);
      assert.equal(
        results[i]!.promptTemplateId,
        inputs[i]!.skill.promptTemplateId,
        `result[${i}].promptTemplateId matches input[${i}]`,
      );
      // revisionId / provenanceId in the returned slot must match the
      // row written for that exact input. Cross-check via documentId.
      const writtenRev = fake.rowsByTable.revision[i] as {
        documentId: string;
        id: string;
      };
      assert.equal(writtenRev.documentId, inputs[i]!.documentId);
      assert.equal(writtenRev.id, results[i]!.revisionId);
    }
  });

  it('persistProposal single-input wrapper still works (backward compat)', async () => {
    const fake = makeFakeDb();
    const r = await persistProposal(fake.db, makeInput(42));
    assert.ok(r.revisionId);
    assert.ok(r.provenanceId);
    assert.equal(fake.txCount, 1);
    assert.equal(fake.rowsByTable.revision.length, 1);
  });

  it('empty input list short-circuits without opening a transaction', async () => {
    const fake = makeFakeDb();
    const r = await persistProposalBatch(fake.db, []);
    assert.equal(r.length, 0);
    assert.equal(fake.txCount, 0);
  });
});
