// POST /api/agent/invoke
//
// Body:
//   {
//     kind: 'citation' | 'inline-editor',
//     documentId: string,
//     blockId: string,
//     passage: string,
//     // citation:
//     flaggedDoiCandidates?: string[],
//     // inline-editor:
//     userInstruction?: string,
//   }
//
// Capability check + ACL load happens up-front; the agent itself also
// re-asserts via requireCapability so any caller mistake fails the same
// way regardless of route.
//
// Phase 1: ANTHROPIC_API_KEY env activates the real Anthropic runner;
// otherwise the deterministic mock runner runs (CI / air-gapped dev).

import path from 'node:path';

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import {
  crossrefMockTransport,
  invokeAgentViaPlugin,
} from '@collaborationtool/ai-runtime';
import { loadPrincipalContext } from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import { crossrefMcpFromEnv } from '@/lib/crossref-mcp';
import { getDb } from '@/lib/db';
import {
  anonDistinctId,
  captureError,
  captureEvent,
  isSlow,
} from '@/lib/observability';
import { getPrincipalIdForUser } from '@/lib/principal';

interface InvokeBody {
  kind?: unknown;
  documentId?: unknown;
  blockId?: unknown;
  passage?: unknown;
  flaggedDoiCandidates?: unknown;
  userInstruction?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: InvokeBody;
  try {
    body = (await request.json()) as InvokeBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== 'citation' && kind !== 'inline-editor') {
    return NextResponse.json(
      { error: 'unsupported-kind', supported: ['citation', 'inline-editor'] },
      { status: 400 },
    );
  }
  if (
    typeof body.documentId !== 'string' ||
    typeof body.blockId !== 'string' ||
    typeof body.passage !== 'string'
  ) {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const ctx = await loadPrincipalContext(db, principalId, body.documentId);
  if (!ctx) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }

  // The actorPrincipalId on the proposal should reflect the agent's
  // identity (per ADR-0001 §2.3.7) — invokeXxxAgent constructs that
  // internally based on agentId. The caller's principalId is captured
  // separately as the trigger but we surface only the agent identity in
  // Provenance.actorPrincipalId by design (the agent acts on its own
  // behalf, scoped by the user's capability grant).
  // Since requireCapability at the agent level uses ctx.principalId for
  // its capability check, we MUST pass the user's PrincipalContext.
  const userCtx = { ...ctx, principalId };

  // Anthropic key is server-only env var; absence triggers mock runner.
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

  // skills root: monorepo root. Phase 1.5 will read from
  // packages/skills (when we move skills under a package).
  const skillsRoot = path.resolve(process.cwd(), '..', '..', 'skills');

  // Plugin roots — Phase 2 W3+W5 dogfood. ADR-0006 §2.7 (registry
  // table) currently catalogs MCP servers only; agent-plugin id → path
  // lookup is the Phase 2 W7 + ADR-0010 review log follow-up. For now
  // the route knows there are exactly two agent plugins (citation +
  // inline-editor) and can hardcode their locations.
  const citationPluginRoot = path.resolve(
    process.cwd(),
    '..',
    '..',
    'plugins',
    'citation-agent',
  );
  const inlineEditorPluginRoot = path.resolve(
    process.cwd(),
    '..',
    '..',
    'plugins',
    'inline-editor-agent',
  );

  const distinctId = anonDistinctId(principalId);
  const startedAt = Date.now();
  const observe = (status: string, extra: Record<string, unknown> = {}) => {
    const durationMs = Date.now() - startedAt;
    captureEvent({
      event: `agent.invoke.${status}`,
      distinctId,
      properties: {
        kind,
        durationMs,
        slow: isSlow(durationMs),
        runner: anthropic ? 'anthropic' : 'mock',
        ...extra,
      },
    });
  };

  try {
    if (kind === 'citation') {
      const flagged = Array.isArray(body.flaggedDoiCandidates)
        ? (body.flaggedDoiCandidates as unknown[]).filter(
            (x): x is string => typeof x === 'string',
          )
        : [];
      // Build MCP spec list. Mock fallback is created inline because
      // Phase 1.5 #6 wired the env-var path; W3 keeps that in place
      // until ADR-0006 mcp_server registry resolution lands W4.
      const crossrefSpec = crossrefMcpFromEnv() ?? {
        id: 'crossref-mock',
        buildTransport: crossrefMockTransport().buildTransport,
      };
      const result = await invokeAgentViaPlugin(
        {
          pluginPath: citationPluginRoot,
          principalContext: userCtx,
          documentId: body.documentId,
          blockId: body.blockId,
          passage: body.passage,
          hints: { flaggedDoiCandidates: flagged },
          skillId: 'citation-lookup',
          skillsRoot,
          mcpSpecs: [crossrefSpec],
          anthropic,
        },
        { db, persistToDb: true },
      );
      observe('ok', {
        hasRevision: !!result.persisted?.revisionId,
        pluginId: result.pluginManifestId,
        pluginVersion: result.pluginManifestVersion,
        // surfaces ADR-0002 vocab warnings + Phase 3 transport notes
        // up the analytics pipe (PostHog properties capture).
        pluginWarnings: result.pluginWarnings.length,
      });
      return NextResponse.json({
        proposal: result.proposal,
        revisionId: result.persisted?.revisionId,
        provenanceId: result.persisted?.provenanceId,
      });
    }

    // kind === 'inline-editor' (W5 dogfood: through plugin path)
    const userInstruction =
      typeof body.userInstruction === 'string' ? body.userInstruction : '';
    if (!userInstruction.trim()) {
      observe('bad-request', { reason: 'missing-userInstruction' });
      return NextResponse.json(
        { error: 'inline-editor requires a userInstruction' },
        { status: 400 },
      );
    }
    const result = await invokeAgentViaPlugin(
      {
        pluginPath: inlineEditorPluginRoot,
        principalContext: userCtx,
        documentId: body.documentId,
        blockId: body.blockId,
        passage: body.passage,
        hints: { userInstruction },
        skillId: 'inline-editor',
        skillsRoot,
        mcpSpecs: [], // inline-editor uses no MCP tools
        anthropic,
      },
      { db, persistToDb: true },
    );
    observe('ok', {
      hasRevision: !!result.persisted?.revisionId,
      pluginId: result.pluginManifestId,
      pluginVersion: result.pluginManifestVersion,
      pluginWarnings: result.pluginWarnings.length,
    });
    return NextResponse.json({
      proposal: result.proposal,
      revisionId: result.persisted?.revisionId,
      provenanceId: result.persisted?.provenanceId,
    });
  } catch (err) {
    if (err instanceof Error && /denied/.test(err.message)) {
      observe('denied');
      return NextResponse.json(
        { error: 'capability-denied', detail: err.message },
        { status: 403 },
      );
    }
    captureError(err, {
      route: 'api.agent.invoke',
      principalId: distinctId,
      tags: { kind: String(kind), runner: anthropic ? 'anthropic' : 'mock' },
    });
    observe('error', {
      errorClass: err instanceof Error ? err.name : 'Unknown',
    });
    return NextResponse.json(
      {
        error: 'agent-failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
