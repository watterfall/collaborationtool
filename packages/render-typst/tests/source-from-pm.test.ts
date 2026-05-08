import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pmToTypstSource } from '../src/source-from-pm';

const SPECIMEN = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: '协作论文平台' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '我们用GPT写论文。' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'See ' },
        {
          type: 'citationRef',
          attrs: {
            blockId: 'blk-1',
            citationId: 'cite-1',
            label: 'Bommasani 2022',
          },
        },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '损失 ' },
        {
          type: 'inlineEquation',
          attrs: { latex: '\\mathcal{L}' },
        },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'equation',
      attrs: { blockId: 'eq', latex: '\\rho(t) = e^{-t}' },
    },
  ],
};

describe('pmToTypstSource', () => {
  it('throws on non-doc root', () => {
    assert.throws(
      () => pmToTypstSource({ type: 'paragraph' }, { primaryLanguage: 'en', title: 't' }),
      /expected root type 'doc'/,
    );
  });

  it('emits a Typst preamble with title + lang + font tokens', () => {
    const out = pmToTypstSource(SPECIMEN, {
      primaryLanguage: 'zh-Hans',
      title: '协作论文平台',
    });
    assert.match(out, /#set document\(title: "协作论文平台"\)/);
    assert.match(out, /#set text\(lang: "zh", region: "hans"/);
    assert.match(out, /Source Han Serif SC/);
  });

  it('renders headings with `=` prefix', () => {
    const out = pmToTypstSource(SPECIMEN, {
      primaryLanguage: 'zh-Hans',
      title: 'doc',
    });
    // Two = headings: the title and the doc heading
    const matches = out.match(/^= /gm);
    assert.ok(matches);
    assert.ok(matches.length >= 2);
  });

  it('CJK pre-pass adds spaces around Latin runs', () => {
    const out = pmToTypstSource(SPECIMEN, {
      primaryLanguage: 'zh-Hans',
      title: '协作论文平台',
    });
    assert.match(out, /我们用 GPT 写论文/);
  });

  it('citations render as bracketed labels', () => {
    const out = pmToTypstSource(SPECIMEN, {
      primaryLanguage: 'en',
      title: 'doc',
    });
    assert.match(out, /\[Bommasani 2022\]/);
  });

  it('display equation goes into a center-aligned raw block tagged latex', () => {
    const out = pmToTypstSource(SPECIMEN, {
      primaryLanguage: 'en',
      title: 'doc',
    });
    assert.match(
      out,
      /#align\(center, raw\("\\\\rho\(t\) = e\^\{-t\}", lang: "latex", block: true\)\)/,
    );
  });

  it('inline equation uses raw with lang=latex', () => {
    const out = pmToTypstSource(SPECIMEN, {
      primaryLanguage: 'zh-Hans',
      title: 'doc',
    });
    assert.match(out, /#raw\("\\\\mathcal\{L\}", lang: "latex"\)/);
  });

  it('escapes markup metacharacters in body text', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'use *literal* markdown' }],
        },
      ],
    };
    const out = pmToTypstSource(pmDoc, {
      primaryLanguage: 'en',
      title: 'doc',
    });
    assert.match(out, /use \\\*literal\\\* markdown/);
  });

  it('marks: bold, italic, annotation-anchor', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Plain ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              text: 'noted',
              marks: [
                { type: 'annotationAnchor', attrs: { anchorId: 'a1' } },
              ],
            },
          ],
        },
      ],
    };
    const out = pmToTypstSource(pmDoc, {
      primaryLanguage: 'en',
      title: 'doc',
    });
    assert.match(out, /\*bold\*/);
    assert.match(out, /_italic_/);
    assert.match(out, /#highlight\[noted\]/);
  });

  it('figure renders #figure(image(...), caption: [..])', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'figure',
          attrs: { blockId: 'f1', src: '/uploads/x.png' },
          content: [
            {
              type: 'figureCaption',
              content: [{ type: 'text', text: '示意图 / illustration' }],
            },
          ],
        },
      ],
    };
    const out = pmToTypstSource(pmDoc, {
      primaryLanguage: 'zh-Hans',
      title: 'doc',
    });
    assert.match(out, /#figure\(\n  image\("\/uploads\/x\.png"\),/);
    // Markup `/` is escaped as `\/` (escape.ts), so the caption literal
    // shows the backslash escape — confirms the renderer ran the
    // typography pre-pass + escape on caption text.
    assert.match(out, /caption: \[示意图 \\\/ illustration\]/);
  });

  it('computational cell renders as fenced raw block', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'computationalCell',
          attrs: {
            blockId: 'cc1',
            kernel: 'molab',
            sourceCode: 'print("hi")',
          },
        },
      ],
    };
    const out = pmToTypstSource(pmDoc, {
      primaryLanguage: 'en',
      title: 'doc',
    });
    assert.match(out, /```molab\nprint\("hi"\)\n```/);
  });
});
