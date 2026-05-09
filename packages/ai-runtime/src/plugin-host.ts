// Phase 2 W3 dogfood gate (ADR-0010 §2.7 step 3) — host-side helper for
// invoking an agent plugin uniformly.
//
// The host owns lifecycle (capability check, skill loading, MCP set
// build, persistence, MCP close) so the plugin module stays minimal:
// just `runAgent(pre-resolved input)` returning an AgentProposal.
// See `packages/ai-runtime/src/plugins/types.ts` AgentPluginModule
// contract for the boundary.
//
// This is the function `apps/web/api/agent/invoke` calls after the
// W3 末 dogfood gate flip; until the gate flips, hardcoded
// `invokeCitationAgent` and this helper coexist (W2 commit `64849b8`
// added an equivalence test verifying both paths produce the same
// AgentProposal). After the flip, hardcoded `agents/citation.ts` is
// removed (per ADR-0010 §2.7 step 4 "no internal-only API").

import path from 'node:path';

import type Anthropic from '@anthropic-ai/sdk';

import type { DbExecutor } from '@collaborationtool/drizzle';
import {
  requireCapability,
  type Capability,
  type PrincipalContext,
} from '@collaborationtool/permissions';
import type {
  BlockId,
  DocumentId,
  PrincipalId,
} from '@collaborationtool/schema';

import { buildMcpServerSet, type McpServerSpec } from './mcp-client';
import { loadAgentPlugin } from './plugins';
import { loadSkill } from './skills-loader';
import {
  persistProposal,
  type PersistProposalResult,
} from './provenance-writer';
import type { AgentProposal } from './types';

export interface InvokeAgentViaPluginInput {
  /**
   * Filesystem path to the plugin root (the directory containing
   * plugin.yaml). Built-ins live in `<repo>/plugins/<id>/`; user
   * installs (Phase 3) live in `~/.platform/plugins/<id>/`.
   *
   * Host responsibility — the plugin loader does not know about
   * registries (per ADR-0006 §2.6, the MCP-specific registry stays
   * in the `mcp_server` PG table; agent-plugin registry mapping is
   * Phase 2 W4-W5 ADR-0010 review log).
   */
  pluginPath: string;

  /** Caller identity + capability bundle (loadPrincipalContext result). */
  principalContext: PrincipalContext;
  documentId: DocumentId;
  blockId: BlockId;
  passage: string;
  /**
   * Free-form structured hints. Citation: `{ flaggedDoiCandidates:
   * string[] }`. Inline-editor: `{ userInstruction: string }`. The
   * plugin module documents which keys it consumes; unknown keys
   * are ignored (forward-compat).
   */
  hints: Record<string, unknown>;

  /** Skill the host pre-loads. Phase 2 W3: caller still passes the
   * skill id; W4-W5 ADR-0010 §2.4 dispatch will pick automatically
   * from `trigger_patterns`. */
  skillId: string;
  /** Skills root override; defaults to `<cwd>/skills`. */
  skillsRoot?: string;

  /** MCP specs the host attaches to this invocation. The plugin
   * module sees them through `input.mcp` and the LLM tool-calls
   * route through them. Empty array is valid (some agents need none). */
  mcpSpecs?: McpServerSpec[];

  /** When set, ai-runtime uses Anthropic; when null, mock runner. */
  anthropic?: Anthropic | null;
  /** Model id (Phase 1 default `claude-sonnet-4-6`). */
  modelId?: string;
  /** Stable agent identity for provenance. Defaults from manifest.kind
   * + project default UUID; W4 will read from `agent` PG table. */
  agentId?: PrincipalId;
}

export interface InvokeAgentViaPluginOptions {
  /** Default true; set false in unit tests that don't have a DB. */
  persistToDb?: boolean;
  /** Required when persistToDb=true. */
  db?: DbExecutor;
}

export interface InvokeAgentViaPluginResult {
  proposal: AgentProposal;
  /** The plugin manifest + warnings — useful for the UI to display
   * "you invoked v0.1.0 of citation-agent" + ADR-0002 vocab warnings. */
  pluginManifestId: string;
  pluginManifestVersion: string;
  pluginWarnings: string[];
  persisted?: PersistProposalResult;
}

const DEFAULT_AGENT_ID =
  '00000000-0000-7000-8000-00000000a001' as PrincipalId;
const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Host-side orchestration for an agent plugin invocation. Produces an
 * AgentProposal and (optionally) persists it. Throws on capability
 * denial, missing skill, plugin manifest invalidity, or plugin
 * runtime error.
 */
export async function invokeAgentViaPlugin(
  input: InvokeAgentViaPluginInput,
  options: InvokeAgentViaPluginOptions = {},
): Promise<InvokeAgentViaPluginResult> {
  const loaded = await loadAgentPlugin(input.pluginPath);
  const kind = loaded.manifest.kind;

  // Capability gate. The verb mirrors ADR-0002's
  // `agent.invoke:<kind>` family — we synthesise it from the manifest
  // to avoid the host having to know each plugin individually.
  const verb = `agent.invoke:${kind}` as Capability;
  requireCapability(input.principalContext, {
    verb,
    resourceType: 'document',
    resourceId: input.documentId,
  });

  const skillsRoot =
    input.skillsRoot ?? path.resolve(process.cwd(), 'skills');
  const skill = await loadSkill(skillsRoot, input.skillId);

  const mcp = await buildMcpServerSet(input.mcpSpecs ?? []);

  try {
    const proposal = await loaded.module.runAgent({
      principalContext: input.principalContext,
      documentId: input.documentId,
      blockId: input.blockId,
      passage: input.passage,
      hints: input.hints,
      skill,
      mcp,
      anthropic: input.anthropic ?? null,
      modelId: input.modelId ?? DEFAULT_MODEL,
      agentId: input.agentId ?? DEFAULT_AGENT_ID,
    });

    let persisted: PersistProposalResult | undefined;
    if (options.persistToDb !== false) {
      if (!options.db) {
        throw new Error(
          'invokeAgentViaPlugin: persistToDb=true (default) requires options.db',
        );
      }
      persisted = await persistProposal(options.db, {
        proposal,
        skill,
        documentId: input.documentId,
      });
    }

    const result: InvokeAgentViaPluginResult = {
      proposal,
      pluginManifestId: loaded.manifest.id,
      pluginManifestVersion: loaded.manifest.version,
      pluginWarnings: loaded.warnings,
    };
    if (persisted) result.persisted = persisted;
    return result;
  } finally {
    await mcp.closeAll();
  }
}
