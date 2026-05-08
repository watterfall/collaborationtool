// proto-c CLI entry. End-to-end demonstration:
//   1. Load skills/citation-lookup/SKILL.md (Anthropic-skills format)
//   2. Start crossref-mock MCP server (in-memory transport)
//   3. Either:
//        a) call Claude (real API)  if ANTHROPIC_API_KEY is set
//        b) deterministic mock      otherwise
//   4. Encode the proposal as a Revision, write Provenance + Revision rows
//   5. Auto-accept (demo simplification) → Contribution row + provenance link
//   6. Dump every Provenance JSON field for verification

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v7 as uuidv7 } from 'uuid';

import { startCrossrefMockBridge } from './mcp-bridge';
import { loadSkill } from './load-skill';
import { buildDemoPassage } from './document-fragment';
import { openStorage } from './storage';
import { runWithMock } from './mock-runner';
import { runWithAnthropic } from './anthropic-runner';
import type { AgentProposal } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const SKILLS_ROOT = resolve(REPO_ROOT, 'skills');
const DB_PATH = resolve(REPO_ROOT, 'apps/prototypes/proto-c-mcp-skill/proto-c.sqlite');
const DEFAULT_MODEL = 'claude-opus-4-7';
const AGENT_PRINCIPAL_ID = 'agent:citation-demo';
const REVIEWER_PRINCIPAL_ID = 'user:demo-reviewer';

function parseArgs(): { dumpProvenance: boolean; modelId: string } {
  const args = process.argv.slice(2);
  return {
    dumpProvenance: args.includes('--dump-provenance'),
    modelId: argValue('--model') ?? DEFAULT_MODEL,
  };
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const { dumpProvenance, modelId } = parseArgs();
  const passage = buildDemoPassage();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('proto-c · MCP + Skill end-to-end demo');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Document : ${passage.documentId}`);
  console.log(`Block    : ${passage.blockId}`);
  console.log(`Passage  :`);
  console.log(`  ${passage.prose}`);
  console.log();

  const skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
  console.log(`✓ Loaded skill : ${skill.skillId}`);
  console.log(`  promptHash    : ${skill.promptHash.slice(0, 16)}…`);
  console.log(`  description   : ${skill.description.slice(0, 80).replace(/\n/g, ' ')}…`);
  console.log(`  allowed MCP   : ${skill.allowedMcpServers.join(', ') || '(none)'}`);
  console.log();

  const bridge = await startCrossrefMockBridge();
  console.log(`✓ MCP bridge online · tools: ${bridge.tools.map((t) => t.name).join(', ')}`);
  console.log();

  const hasApiKey = !!process.env['ANTHROPIC_API_KEY'];
  const mode = hasApiKey ? 'anthropic' : 'mock';
  console.log(`▶ Running agent in mode: ${mode}` + (hasApiKey ? ` (model=${modelId})` : ' (set ANTHROPIC_API_KEY for real API)'));

  let proposal: AgentProposal;
  try {
    proposal = hasApiKey
      ? await runWithAnthropic({ passage, skill, bridge, modelId })
      : await runWithMock({ passage, skill, bridge });
  } finally {
    await bridge.shutdown();
  }

  console.log();
  console.log('▶ Agent proposal');
  console.log(`  Rationale: ${proposal.proposalRationale}`);
  console.log(`  Revised fragments: ${proposal.revisedFragments.length}`);
  for (const f of proposal.revisedFragments) {
    console.log(`    - "${f.originalText}" → "${f.replacementText}" (citationId=${f.citationId})`);
  }
  console.log(`  Uncertainties (${proposal.uncertainties.length}):`);
  for (const u of proposal.uncertainties) console.log(`    · ${u}`);
  console.log();

  // Persist Provenance + Revision + Contribution
  await mkdir(dirname(DB_PATH), { recursive: true });
  const storage = openStorage(DB_PATH);
  try {
    const provenanceId = storage.insertProvenance({
      actorPrincipalId: AGENT_PRINCIPAL_ID,
      actorKind: 'agent',
      agentContext: proposal.agentContext,
      inputBlockIds: [passage.blockId],
      inputDocumentIds: [passage.documentId],
      toolCalls: proposal.toolCalls,
    });
    console.log(`✓ Wrote Provenance row : ${provenanceId}`);

    // For demo, the PM steps / Yjs update payload is a placeholder JSON
    // (Phase 1 will compute a real diff via packages/editor-core).
    const placeholderPm = new TextEncoder().encode(JSON.stringify({
      stub: 'pm-steps-placeholder',
      revisedFragments: proposal.revisedFragments,
    }));

    const revisionId = storage.insertRevision({
      documentId: passage.documentId,
      proposedBy: AGENT_PRINCIPAL_ID,
      pmStepsBinary: placeholderPm,
      yjsUpdateBinary: placeholderPm,
      baseStateVector: new Uint8Array([0]),
      rationale: proposal.proposalRationale,
      provenanceId,
    });
    console.log(`✓ Wrote Revision row   : ${revisionId} (status=proposed)`);

    const { contributionId } = storage.acceptRevisionToContribution({
      revisionId,
      reviewerPrincipalId: REVIEWER_PRINCIPAL_ID,
      approvalNotes: 'Demo auto-accept; in production a human author reviews.',
    });
    console.log(`✓ Wrote Contribution   : ${contributionId} (revision now status=accepted)`);

    if (dumpProvenance) {
      console.log();
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Full Provenance row (JSON):');
      console.log('═══════════════════════════════════════════════════════════');
      const loaded = storage.loadProvenance(provenanceId);
      console.log(JSON.stringify(loaded, null, 2));
      console.log();
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Full Revision row (JSON, binaries elided):');
      console.log('═══════════════════════════════════════════════════════════');
      const rev = storage.loadRevision(revisionId);
      if (rev) {
        const printable = {
          ...rev,
          pmStepsBinary: `<${rev.pmStepsBinary.byteLength} bytes>`,
          yjsUpdateBinary: `<${rev.yjsUpdateBinary.byteLength} bytes>`,
          baseStateVector: `<${rev.baseStateVector.byteLength} bytes>`,
        };
        console.log(JSON.stringify(printable, null, 2));
      }
    }
  } finally {
    storage.close();
  }

  console.log();
  console.log(`SQLite DB at: ${DB_PATH} (kept for inspection; delete to reset)`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('proto-c demo failed:', err);
  process.exit(1);
});

// Suppress unused import warning under strict TS (uuidv7 is used by storage.ts).
void uuidv7;
