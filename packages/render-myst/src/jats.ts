// MyST AST → JATS XML.
//
// JATS is the standard journal/PMC archival format. mystmd's
// `myst-to-jats` is the reference implementation; ours is a Phase 1
// minimal subset covering the editor's PM schema. Output validates
// against the JATS Article Authoring DTD for the elements we emit.
//
// proto-b §3.5: equations get the dual MathML + LaTeX representation so
// downstream PMC pipelines can render either path. We emit just the
// LaTeX leg for Phase 1; Phase 1.5 wires KaTeX → MathML through the
// official mystmd transformer.

import {
  applyCjkSpacing,
  smartQuoteByLang,
  type LanguageTag,
} from '@collaborationtool/typography';

import type {
  MystInline,
  MystNode,
  MystRoot,
  MystText,
} from './types';

export interface JatsRenderOptions {
  primaryLanguage: LanguageTag;
  /** Article metadata. */
  title: string;
  /** Optional list of authors. Phase 1: name only. */
  authors?: Array<{ givenName: string; familyName: string }>;
}

export function mystAstToJats(
  ast: MystRoot,
  options: JatsRenderOptions,
): string {
  const lang = options.primaryLanguage.replace('-', '_');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD with MathML3 v1.3 20210610//EN" "JATS-archivearticle1-3-mathml3.dtd">
<article xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:mml="http://www.w3.org/1998/Math/MathML" xml:lang="${escapeXml(lang)}" article-type="research-article">
<front>
<article-meta>
<title-group><article-title>${escapeXml(options.title)}</article-title></title-group>
${renderAuthors(options.authors)}
</article-meta>
</front>
<body>
${ast.children.map((n) => renderBlock(n, options)).join('\n')}
</body>
</article>`;
}

function renderAuthors(
  authors: JatsRenderOptions['authors'],
): string {
  if (!authors || authors.length === 0) return '';
  const items = authors
    .map(
      (a) =>
        `<contrib contrib-type="author"><name><surname>${escapeXml(a.familyName)}</surname><given-names>${escapeXml(a.givenName)}</given-names></name></contrib>`,
    )
    .join('\n');
  return `<contrib-group>\n${items}\n</contrib-group>`;
}

function renderBlock(node: MystNode, opts: JatsRenderOptions): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInline(node.children, opts)}</p>`;
    case 'heading': {
      // JATS body uses <sec> + <title> for sectioning. Phase 1
      // simplification: emit <sec> per heading, no nesting.
      return `<sec><title>${renderInline(node.children, opts)}</title></sec>`;
    }
    case 'math':
      return `<disp-formula><tex-math><![CDATA[${node.value}]]></tex-math></disp-formula>`;
    case 'code':
      return `<code language="${escapeAttr(node.lang ?? '')}"><![CDATA[${node.value}]]></code>`;
    case 'blockquote':
      return `<disp-quote>\n${node.children.map((c) => renderBlock(c, opts)).join('\n')}\n</disp-quote>`;
    case 'list': {
      const listType = node.ordered ? 'order' : 'bullet';
      const items = node.children
        .map(
          (li) =>
            `<list-item>\n${li.children.map((c) => renderBlock(c, opts)).join('\n')}\n</list-item>`,
        )
        .join('\n');
      return `<list list-type="${listType}">\n${items}\n</list>`;
    }
    case 'figure': {
      const id = node.identifier ? ` id="${escapeAttr(node.identifier)}"` : '';
      const inner = node.children
        .map((c) => {
          if (c.type === 'image') {
            return `<graphic xlink:href="${escapeAttr(c.url)}"/>`;
          }
          if (c.type === 'caption') {
            return `<caption><p>${renderInline(c.children, opts)}</p></caption>`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
      return `<fig${id}>\n${inner}\n</fig>`;
    }
    default:
      return '';
  }
}

function renderInline(
  children: MystInline[],
  opts: JatsRenderOptions,
): string {
  return children.map((c) => renderInlineNode(c, opts)).join('');
}

function renderInlineNode(node: MystInline, opts: JatsRenderOptions): string {
  switch (node.type) {
    case 'text': {
      const value = applyTextPrePass(node.value, opts);
      let inner = escapeXml(value);
      if (node.marks?.some((m) => m.type === 'italic')) {
        inner = `<italic>${inner}</italic>`;
      }
      if (node.marks?.some((m) => m.type === 'bold')) {
        inner = `<bold>${inner}</bold>`;
      }
      return inner;
    }
    case 'emphasis':
      return `<italic>${renderInline(node.children, opts)}</italic>`;
    case 'strong':
      return `<bold>${renderInline(node.children, opts)}</bold>`;
    case 'inlineMath':
      return `<inline-formula><tex-math><![CDATA[${node.value}]]></tex-math></inline-formula>`;
    case 'cite':
      return `<xref ref-type="bibr" rid="${escapeAttr(node.citationId)}">${escapeXml(node.label ?? node.citationId.slice(0, 8))}</xref>`;
    case 'crossReference':
      return `<xref rid="${escapeAttr(node.identifier)}">${escapeXml(node.identifier)}</xref>`;
    default:
      return '';
  }
}

function applyTextPrePass(value: string, opts: JatsRenderOptions): string {
  const spaced = applyCjkSpacing(value);
  return smartQuoteByLang(spaced, { primaryLanguage: opts.primaryLanguage });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttr(s: string): string {
  return escapeXml(s);
}
// avoid unused-import warning since `MystText` only appears in JSDoc / branches
void (null as unknown as MystText);
