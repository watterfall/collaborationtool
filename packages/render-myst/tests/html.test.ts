import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pmToMystAst } from '../src/ast-from-pm';
import { mystAstToHtml } from '../src/html';
import { bilingualSpecimen } from '../fixtures/bilingual-specimen';

describe('mystAstToHtml', () => {
  it('emits a complete HTML5 document by default', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const html = mystAstToHtml(ast, {
      primaryLanguage: 'zh-Hans',
      title: '协作论文平台',
    });
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<html lang="zh-Hans">/);
    assert.match(html, /<title>协作论文平台<\/title>/);
    assert.match(html, /<h1>协作论文平台<\/h1>/);
  });

  it('emits a fragment when fragment=true', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const html = mystAstToHtml(ast, {
      primaryLanguage: 'zh-Hans',
      title: 'doc',
      fragment: true,
    });
    assert.doesNotMatch(html, /<!doctype/);
    assert.doesNotMatch(html, /<head>/);
  });

  it('renders citation as styled span with data-citation-id', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const html = mystAstToHtml(ast, { primaryLanguage: 'en', title: 'doc' });
    assert.match(
      html,
      /<span class="cite" data-citation-id="cite-doi-10\.1145-3531146\.3533104">Bommasani 2022<\/span>/,
    );
  });

  it('renders display + inline math with LaTeX preserved in attribute', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh-Hans', title: 'doc' });
    assert.match(html, /math-display.*data-latex=".*rho/s);
    assert.match(html, /math-inline.*data-latex=".*mathcal/);
  });

  it('CJK pre-pass: spaces between Han and Latin', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '我们用GPT写论文。' }],
        },
      ],
    };
    const ast = pmToMystAst(pmDoc);
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh-Hans' });
    // Spaces inserted around 'GPT' (between Han + Latin).
    assert.match(html, /我们用 GPT 写论文/);
  });

  it('smart-quote: CJK paragraph gets curly quotes', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '他说"你好"。' }],
        },
      ],
    };
    const ast = pmToMystAst(pmDoc);
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh-Hans' });
    assert.match(html, /他说“你好”/);
  });

  it('text marks: bold, italic, and bilingual mixed', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh-Hans', title: 'doc' });
    assert.match(html, /<strong>Bold mixed: <\/strong>/);
    assert.match(html, /<em>italic English<\/em>/);
  });

  it('escapes HTML entities in text', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A & B < C > "D"' }],
        },
      ],
    };
    const ast = pmToMystAst(pmDoc);
    const html = mystAstToHtml(ast, { primaryLanguage: 'en' });
    assert.match(html, /A &amp; B &lt; C &gt;/);
    // The straight quotes get smart-quoted then HTML-escaped.
    assert.doesNotMatch(html, /<script/);
  });

  it('emits font-family CSS with CJK + Latin chain', () => {
    const ast = pmToMystAst({ type: 'doc', content: [] });
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh-Hans' });
    assert.match(html, /Source Han Serif SC/);
    assert.match(html, /Songti SC/);
  });
});
