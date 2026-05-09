// MyST AST → .docx (Microsoft Word) bytes.
//
// Phase 1.5 emitter. Mirrors the html.ts / jats.ts / markdown.ts pattern:
// walk our internal MystRoot AST and build the target document.
//
// Phase 1.5 scope:
//   - paragraph / heading (1-6) / blockquote / list / list-item / code
//   - text + bold / italic / annotation-anchor marks
//   - math / inlineMath emit as LaTeX in monospace (no native OMML yet)
//   - cite emits [<label>] text run; bibliography join is Phase 2
//   - figure emits caption-only (no image binary fetch yet)
//
// We DO apply the typography pre-pass (CJK spacing + smart quotes)
// just like html.ts / typst source — keeps "same PM tree → same text"
// across formats.

import {
  AlignmentType,
  Document,
  HeadingLevel,
  type ILevelsOptions,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

import {
  applyCjkSpacing,
  smartQuoteByLang,
  type LanguageTag,
} from '@collaborationtool/typography';

import type {
  MystInline,
  MystListItem,
  MystMark,
  MystNode,
  MystRoot,
} from './types';

export interface DocxRenderOptions {
  primaryLanguage: LanguageTag;
  /** Document title — emitted as a TITLE-style paragraph at top. */
  title: string;
  /** Optional authors — emitted as a contributor paragraph below title. */
  authors?: { givenName: string; familyName: string }[];
}

/** Inline run style accumulated as we walk emphasis/strong wrappers. */
interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  font?: string;
  highlight?: 'yellow';
}

export async function mystAstToDocx(
  ast: MystRoot,
  options: DocxRenderOptions,
): Promise<Uint8Array> {
  const children: Paragraph[] = [];

  if (options.title) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: options.title, bold: true, size: 36 })],
      }),
    );
  }
  if (options.authors && options.authors.length > 0) {
    const text = options.authors
      .map((a) => `${a.givenName} ${a.familyName}`)
      .join(', ');
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, italics: true })],
      }),
    );
  }

  for (const node of ast.children) {
    children.push(...renderBlock(node, options, 0));
  }

  const doc = new Document({
    creator: '@collaborationtool/render-myst',
    title: options.title,
    description: 'Exported by collaborationtool Phase 1.5',
    numbering: {
      config: [
        {
          reference: 'collab-bullets',
          levels: BULLET_LEVELS,
        },
      ],
    },
    sections: [{ children }],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

const BULLET_LEVELS: ILevelsOptions[] = [
  {
    level: 0,
    format: 'bullet',
    text: '•',
    alignment: AlignmentType.LEFT,
  },
  {
    level: 1,
    format: 'bullet',
    text: '◦',
    alignment: AlignmentType.LEFT,
  },
];

function renderBlock(
  node: MystNode,
  opts: DocxRenderOptions,
  depth: number,
): Paragraph[] {
  switch (node.type) {
    case 'paragraph':
      return [
        new Paragraph({ children: renderInline(node.children, opts, {}) }),
      ];
    case 'heading':
      return [
        new Paragraph({
          heading: headingLevel(node.depth),
          children: renderInline(node.children, opts, {}),
        }),
      ];
    case 'math':
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `$$${node.value}$$`,
              font: 'Cambria Math',
            }),
          ],
        }),
      ];
    case 'code':
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: node.value,
              font: 'Consolas',
            }),
          ],
        }),
      ];
    case 'blockquote':
      // Word has no native blockquote — emit children as left-indented
      // paragraphs. We re-render rather than mutate (docx Paragraphs are
      // built immutably).
      return node.children.flatMap((c) => indentBlock(c, opts, depth));
    case 'list':
      return node.children.flatMap((li) => renderListItem(li, opts, depth));
    case 'figure': {
      const out: Paragraph[] = [];
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '[Figure]', italics: true })],
        }),
      );
      for (const c of node.children) {
        if (c.type === 'caption') {
          out.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: renderInline(c.children, opts, {}),
            }),
          );
        }
      }
      return out;
    }
    default:
      return [];
  }
}

function indentBlock(
  node: MystNode,
  opts: DocxRenderOptions,
  depth: number,
): Paragraph[] {
  switch (node.type) {
    case 'paragraph':
      return [
        new Paragraph({
          indent: { left: 720 },
          children: renderInline(node.children, opts, {}),
        }),
      ];
    default:
      return renderBlock(node, opts, depth);
  }
}

function renderListItem(
  li: MystListItem,
  opts: DocxRenderOptions,
  depth: number,
): Paragraph[] {
  const out: Paragraph[] = [];
  const [first, ...rest] = li.children;
  if (first && first.type === 'paragraph') {
    out.push(
      new Paragraph({
        numbering: {
          reference: 'collab-bullets',
          level: Math.min(depth, 1),
        },
        children: renderInline(first.children, opts, {}),
      }),
    );
  }
  for (const c of rest) {
    out.push(...renderBlock(c, opts, depth + 1));
  }
  return out;
}

function renderInline(
  children: MystInline[],
  opts: DocxRenderOptions,
  style: RunStyle,
): TextRun[] {
  return children.flatMap((c) => renderInlineNode(c, opts, style));
}

function renderInlineNode(
  node: MystInline,
  opts: DocxRenderOptions,
  style: RunStyle,
): TextRun[] {
  switch (node.type) {
    case 'text': {
      const text = applyTextPrePass(node.value, opts);
      const merged: RunStyle = { ...style };
      if (hasMark(node.marks, 'bold')) merged.bold = true;
      if (hasMark(node.marks, 'italic')) merged.italics = true;
      if (hasAnnotationAnchor(node.marks)) merged.highlight = 'yellow';
      return [new TextRun({ text, ...merged })];
    }
    case 'emphasis':
      return renderInline(node.children, opts, { ...style, italics: true });
    case 'strong':
      return renderInline(node.children, opts, { ...style, bold: true });
    case 'inlineMath':
      return [
        new TextRun({
          text: `$${node.value}$`,
          font: 'Cambria Math',
          ...style,
        }),
      ];
    case 'cite': {
      const label = node.label ?? node.citationId.slice(0, 8);
      return [new TextRun({ text: `[${label}]`, ...style })];
    }
    case 'crossReference':
      return [
        new TextRun({
          text: `↗${node.identifier}`,
          italics: true,
          ...style,
        }),
      ];
    default:
      return [];
  }
}

function applyTextPrePass(value: string, opts: DocxRenderOptions): string {
  const spaced = applyCjkSpacing(value);
  return smartQuoteByLang(spaced, { primaryLanguage: opts.primaryLanguage });
}

function hasMark(marks: MystMark[] | undefined, type: string): boolean {
  return !!marks?.some((m) => m.type === type);
}

function hasAnnotationAnchor(marks: MystMark[] | undefined): boolean {
  return !!marks?.some((m) => m.type === 'annotation-anchor');
}

function headingLevel(
  depth: number,
): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  switch (depth) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 2:
      return HeadingLevel.HEADING_2;
    case 3:
      return HeadingLevel.HEADING_3;
    case 4:
      return HeadingLevel.HEADING_4;
    case 5:
      return HeadingLevel.HEADING_5;
    default:
      return HeadingLevel.HEADING_6;
  }
}
