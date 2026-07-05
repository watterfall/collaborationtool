// Export endpoint: PM tree → format-specific bytes.
//
// GET /api/export/<docId>/<format>?template=default
//
// Phase 1 D12 supports html / jats / markdown / typst-source.
// The PDF path requires a `typst` binary on the server PATH; if absent
// we surface a 503 with a hint per proto-b's "install Typst" docs.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext, requireCapability } from '@collaborationtool/permissions';
import {
  mystAstToDocx,
  mystAstToHtml,
  mystAstToJats,
  mystAstToMarkdown,
  pmToMystAst,
} from '@collaborationtool/render-myst';
import {
  TypstCompileError,
  compileTypstToPdf,
  pmToTypstSource,
} from '@collaborationtool/render-typst';

import { auth } from '@/lib/auth';
import { buildAiContextPack } from '@/lib/ai-context-pack';
import { getDb } from '@/lib/db';
import {
  anonDistinctId,
  captureError,
  captureEvent,
  isSlow,
} from '@/lib/observability';
import { getPrincipalIdForUser } from '@/lib/principal';

type ExportFormat =
  | 'html'
  | 'jats'
  | 'markdown'
  | 'typst-source'
  | 'pdf'
  | 'docx'
  | 'ai-context-pack';

const ALL_FORMATS: ReadonlySet<ExportFormat> = new Set([
  'html',
  'jats',
  'markdown',
  'typst-source',
  'pdf',
  'docx',
  'ai-context-pack',
]);

// Minimal PM doc shape — render packages accept a wider input shape but
// we narrow at the route boundary so the rest of the function gets type
// inference instead of `any`.
interface PmDoc {
  type: 'doc';
  content?: unknown[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string; format: string }> },
): Promise<Response> {
  const { docId, format } = await params;

  if (!ALL_FORMATS.has(format as ExportFormat)) {
    return NextResponse.json(
      { error: 'unsupported-format', supported: [...ALL_FORMATS] },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const docRows = await db
    .select()
    .from(schema.document)
    .where(and(eq(schema.document.id, docId), isNull(schema.document.deletedAt)))
    .limit(1);
  if (docRows.length === 0) {
    return NextResponse.json({ error: 'document-not-found' }, { status: 404 });
  }
  const doc = docRows[0]!;

  const ctx = await loadPrincipalContext(db, principalId, doc.id);
  if (!ctx) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }
  try {
    requireCapability(ctx, {
      verb: 'document.export',
      resourceType: 'document',
      resourceId: doc.id,
    });
  } catch {
    return NextResponse.json({ error: 'no-export-capability' }, { status: 403 });
  }

  // Phase 1 D12 source: read the PG snapshot if present, else emit an
  // empty doc placeholder so the export still succeeds (useful for the
  // smoke path before the editor has produced any content).
  // D11 snapshot worker populates `yjs_doc_binary`; once D14 commits PM
  // contributions to PG we'll reconstruct the PM tree from there.
  // For Phase 1 D12 we ALSO accept a `?content=<base64-pm-json>` query
  // override so manual / test invocations don't need a real document.
  const url = new URL(request.url);
  const inlineContent = url.searchParams.get('content');
  const decoded = inlineContent
    ? safeBase64DecodeJson(inlineContent)
    : ({ type: 'doc', content: [] } satisfies PmDoc);
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    (decoded as { type?: unknown }).type !== 'doc'
  ) {
    return NextResponse.json(
      { error: 'invalid-content-param' },
      { status: 400 },
    );
  }
  // PmDocInput shape lives in @collaborationtool/schema (re-exported by
  // both render packages). Cast is safe because we just confirmed
  // `type === 'doc'`.
  const pmJson = decoded as PmDoc;

  const title = doc.title || doc.slug;
  const lang = doc.primaryLanguage;

  const distinctId = anonDistinctId(principalId);
  const startedAt = Date.now();
  const observeOk = (extra: Record<string, unknown> = {}) => {
    const durationMs = Date.now() - startedAt;
    captureEvent({
      event: 'document.export.ok',
      distinctId,
      properties: {
        format,
        durationMs,
        slow: isSlow(durationMs),
        ...extra,
      },
    });
  };

  try {
  switch (format as ExportFormat) {
    case 'html': {
      const ast = pmToMystAst(pmJson);
      const html = mystAstToHtml(ast, { primaryLanguage: lang, title });
      observeOk();
      return new Response(html, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-disposition': `attachment; filename="${slugify(title)}.html"`,
        },
      });
    }
    case 'jats': {
      const ast = pmToMystAst(pmJson);
      const xml = mystAstToJats(ast, { primaryLanguage: lang, title });
      observeOk();
      return new Response(xml, {
        status: 200,
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'content-disposition': `attachment; filename="${slugify(title)}.jats.xml"`,
        },
      });
    }
    case 'markdown': {
      const ast = pmToMystAst(pmJson);
      const md = mystAstToMarkdown(ast);
      observeOk();
      return new Response(md, {
        status: 200,
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="${slugify(title)}.md"`,
        },
      });
    }
    case 'typst-source': {
      const source = pmToTypstSource(pmJson, { primaryLanguage: lang, title });
      observeOk();
      return new Response(source, {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'content-disposition': `attachment; filename="${slugify(title)}.typ"`,
        },
      });
    }
    case 'pdf': {
      const source = pmToTypstSource(pmJson, { primaryLanguage: lang, title });
      try {
        const result = await compileTypstToPdf(source);
        observeOk({ typstDurationMs: result.durationMs });
        // Wrap in Buffer so the Response BodyInit type accepts it
        // across Node 22 / Edge fetch typings.
        return new Response(Buffer.from(result.pdfBytes), {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-disposition': `attachment; filename="${slugify(title)}.pdf"`,
            'x-typst-duration-ms': String(result.durationMs),
          },
        });
      } catch (err) {
        const detail =
          err instanceof TypstCompileError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        captureEvent({
          event: 'document.export.unavailable',
          distinctId,
          properties: { format, reason: 'typst-binary-unavailable' },
        });
        return NextResponse.json(
          {
            error: 'typst-binary-unavailable',
            hint:
              'Install typst >= 0.14 on the server PATH (proto-b §6 install steps).',
            detail,
          },
          { status: 503 },
        );
      }
    }
    case 'docx': {
      const ast = pmToMystAst(pmJson);
      const bytes = await mystAstToDocx(ast, {
        primaryLanguage: lang,
        title,
      });
      observeOk();
      return new Response(Buffer.from(bytes), {
        status: 200,
        headers: {
          'content-type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'content-disposition': `attachment; filename="${slugify(title)}.docx"`,
        },
      });
    }
    case 'ai-context-pack': {
      // Phase 2 W7 ADR-0011 §2.7: machine-facing knowledge pack.
      // Bundles claims + evidences + claim_links + sources + provenance
      // metadata as a single JSON document. Downstream agents (third-
      // party plugins, external researchers) import this directly into
      // their context window.
      const claims = await db
        .select()
        .from(schema.claim)
        .where(eq(schema.claim.documentOriginId, doc.id));
      const claimIds = claims.map((c) => c.id);
      const evidences = claimIds.length
        ? await db
            .select()
            .from(schema.evidence)
            .where(inArray(schema.evidence.supportsClaimId, claimIds))
        : [];
      const claimLinks = claimIds.length
        ? await db
            .select()
            .from(schema.claimLink)
            .where(inArray(schema.claimLink.fromClaimId, claimIds))
        : [];
      const citationIds = [
        ...new Set(
          evidences
            .map((e) => e.citationId)
            .filter((id): id is string => id !== null),
        ),
      ];
      const sources = citationIds.length
        ? await db
            .select()
            .from(schema.citation)
            .where(inArray(schema.citation.id, citationIds))
        : [];
      const reviews = claimIds.length
        ? await db
            .select()
            .from(schema.claimReview)
            .where(inArray(schema.claimReview.claimId, claimIds))
        : [];
      const maintenanceFindings = await db
        .select()
        .from(schema.maintenanceFinding)
        .where(
          and(
            eq(schema.maintenanceFinding.documentId, doc.id),
            eq(schema.maintenanceFinding.vaultPrincipalId, principalId),
          ),
        );
      const pack = buildAiContextPack({
        doc: {
          id: doc.id,
          title,
          slug: doc.slug,
          primaryLanguage: lang,
          bilingualMode: doc.bilingualMode,
        },
        claims,
        evidences,
        claimLinks,
        sources,
        reviews,
        maintenanceFindings,
      });
      observeOk({
        claimCount: claims.length,
        evidenceCount: evidences.length,
        sourceCount: sources.length,
        reviewCount: reviews.length,
        readinessStatus: pack.readiness.status,
      });
      return new Response(JSON.stringify(pack, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="${slugify(title)}.ai-context-pack.json"`,
        },
      });
    }
  }
  } catch (err) {
    captureError(err, {
      route: 'api.export',
      principalId: distinctId,
      tags: { format: String(format) },
    });
    return NextResponse.json(
      {
        error: 'export-failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

function safeBase64DecodeJson(b64: string): unknown | null {
  try {
    const raw = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function slugify(s: string): string {
  // ASCII-only — `content-disposition: filename="..."` header value must
  // be a ByteString (RFC 7230). Strip CJK and other non-ASCII chars
  // here. Phase 1.5 may add `filename*=UTF-8''...` encoding to preserve
  // CJK names in the download.
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'document'
  );
}
