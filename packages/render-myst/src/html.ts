// MyST AST → HTML.
//
// Phase 1 D12 ships a minimal, dependency-free HTML emitter. Phase 1.5
// will swap to mystmd's official `myst-to-html` once the editor's PM
// schema fully matches the official myst-spec node set (footnotes,
// admonitions, cross-references, etc.). The signature stays so callers
// — especially apps/web export — don't have to change.
//
// We DO apply the typography pre-pass (CJK spacing + smart quotes)
// because the official mystmd transformer does not.

import {
  applyCjkSpacing,
  fontTokensToCss,
  getFontTokens,
  smartQuoteByLang,
  type LanguageTag,
} from '@collaborationtool/typography';

import type {
  MystInline,
  MystListItem,
  MystMark,
  MystNode,
  MystRoot,
  MystText,
} from './types';

export interface HtmlRenderOptions {
  primaryLanguage: LanguageTag;
  /** Document title — wraps in <h1> at top of <body>. */
  title?: string;
  /** When true, emit a complete HTML5 document; otherwise just <body> innards. */
  fragment?: boolean;
}

export function mystAstToHtml(
  ast: MystRoot,
  options: HtmlRenderOptions,
): string {
  const inner = ast.children.map((n) => renderBlock(n, options)).join('\n');
  if (options.fragment) return inner;

  const fonts = getFontTokens(options.primaryLanguage);
  const titleEsc = escapeHtml(options.title ?? '');
  return `<!doctype html>
<html lang="${escapeHtml(options.primaryLanguage)}">
<head>
<meta charset="utf-8">
<title>${titleEsc}</title>
<style>
body { font-family: ${fontTokensToCss(fonts.serif)}; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; }
h1, h2, h3 { font-family: ${fontTokensToCss(fonts.serif)}; line-height: 1.3; }
code, pre { font-family: ${fontTokensToCss(fonts.mono)}; }
.cite { color: #1c1917; }
.cite::before { content: "["; }
.cite::after { content: "]"; }
.math-display { display: block; text-align: center; margin: 1rem 0; }
.math-inline { padding: 0 .15em; }
mark.annotation-anchor { background: #fff7d6; }
figure { margin: 1.5rem 0; text-align: center; }
figcaption { font-size: 0.9rem; color: #71717a; }
</style>
</head>
<body>
${options.title ? `<h1>${titleEsc}</h1>\n` : ''}${inner}
</body>
</html>`;
}

function renderBlock(node: MystNode, opts: HtmlRenderOptions): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInline(node.children, opts)}</p>`;
    case 'heading':
      return `<h${node.depth}>${renderInline(node.children, opts)}</h${node.depth}>`;
    case 'math':
      // Phase 1: emit raw LaTeX in a marked block; client-side KaTeX in
      // apps/web can render. mystmd-to-html would emit MathML here.
      return `<div class="math-display" data-latex="${escapeAttr(node.value)}">$$${escapeHtml(node.value)}$$</div>`;
    case 'code':
      return `<pre><code class="language-${escapeAttr(node.lang ?? '')}">${escapeHtml(node.value)}</code></pre>`;
    case 'blockquote':
      return `<blockquote>\n${node.children.map((c) => renderBlock(c, opts)).join('\n')}\n</blockquote>`;
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const items = node.children
        .map((li) => renderListItem(li, opts))
        .join('\n');
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case 'figure': {
      return `<figure>\n${node.children
        .map((c) => {
          if (c.type === 'image') {
            return `<img src="${escapeAttr(c.url)}" alt="${escapeAttr(c.alt ?? '')}">`;
          }
          if (c.type === 'caption') {
            return `<figcaption>${renderInline(c.children, opts)}</figcaption>`;
          }
          return renderBlock(c, opts);
        })
        .join('\n')}\n</figure>`;
    }
    default:
      return '';
  }
}

function renderListItem(li: MystListItem, opts: HtmlRenderOptions): string {
  return `<li>${li.children.map((c) => renderBlock(c, opts)).join('\n')}</li>`;
}

function renderInline(
  children: MystInline[],
  opts: HtmlRenderOptions,
): string {
  return children.map((c) => renderInlineNode(c, opts)).join('');
}

function renderInlineNode(node: MystInline, opts: HtmlRenderOptions): string {
  switch (node.type) {
    case 'text':
      return wrapMarks(applyTextPrePass(node.value, opts), node.marks);
    case 'emphasis':
      return `<em>${renderInline(node.children, opts)}</em>`;
    case 'strong':
      return `<strong>${renderInline(node.children, opts)}</strong>`;
    case 'inlineMath':
      return `<span class="math-inline" data-latex="${escapeAttr(node.value)}">$${escapeHtml(node.value)}$</span>`;
    case 'cite': {
      const label = node.label ?? node.citationId.slice(0, 8);
      return `<span class="cite" data-citation-id="${escapeAttr(node.citationId)}">${escapeHtml(label)}</span>`;
    }
    case 'crossReference':
      return `<a class="xref" href="#${escapeAttr(node.identifier)}">${escapeHtml(node.identifier)}</a>`;
    default:
      return '';
  }
}

function applyTextPrePass(value: string, opts: HtmlRenderOptions): string {
  const spaced = applyCjkSpacing(value);
  return smartQuoteByLang(spaced, { primaryLanguage: opts.primaryLanguage });
}

function wrapMarks(html: string, marks: MystText['marks']): string {
  if (!marks || marks.length === 0) return escapeHtml(html);
  // Apply marks outside-in: bold > italic > annotation-anchor.
  let inner = escapeHtml(html);
  if (hasMark(marks, 'italic')) inner = `<em>${inner}</em>`;
  if (hasMark(marks, 'bold')) inner = `<strong>${inner}</strong>`;
  const anchor = marks.find(
    (m): m is Extract<MystMark, { type: 'annotation-anchor' }> =>
      m.type === 'annotation-anchor',
  );
  if (anchor) {
    inner = `<mark class="annotation-anchor" data-anchor-id="${escapeAttr(anchor.anchorId)}">${inner}</mark>`;
  }
  return inner;
}

function hasMark(marks: MystMark[] | undefined, type: string): boolean {
  return !!marks?.some((m) => m.type === type);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
