// Export endpoint: PM tree → format-specific bytes.
//
// GET /api/export/<docId>/<format>?template=default
//
// Phase 1 D12 supports html / jats / markdown / typst-source.
// The PDF path requires a `typst` binary on the server PATH; if absent
// we surface a 503 with a hint per proto-b's "install Typst" docs.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext, requireCapability } from '@collaborationtool/permissions';
import {
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
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

type ExportFormat = 'html' | 'jats' | 'markdown' | 'typst-source' | 'pdf';

const ALL_FORMATS: ReadonlySet<ExportFormat> = new Set([
  'html',
  'jats',
  'markdown',
  'typst-source',
  'pdf',
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
  // The render packages declare their own PmNode shape; cast here is
  // safe because we just confirmed `type === 'doc'`.
  const pmJson = decoded as PmDoc;

  const title = doc.title || doc.slug;
  const lang = doc.primaryLanguage;

  switch (format as ExportFormat) {
    case 'html': {
      const ast = pmToMystAst(pmJson);
      const html = mystAstToHtml(ast, { primaryLanguage: lang, title });
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
