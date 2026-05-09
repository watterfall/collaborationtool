import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pmToMystAst } from '../src/ast-from-pm';
import { mystAstToJats } from '../src/jats';
import { bilingualSpecimen } from '../fixtures/bilingual-specimen';

describe('mystAstToJats', () => {
  it('emits a JATS document with xml:lang from primaryLanguage', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const xml = mystAstToJats(ast, {
      primaryLanguage: 'zh-Hans',
      title: '协作论文平台',
    });
    assert.match(xml, /^<\?xml version="1\.0"/);
    assert.match(xml, /xml:lang="zh_Hans"/);
    assert.match(
      xml,
      /<article-title>协作论文平台<\/article-title>/,
    );
  });

  it('translates display equation with tex-math CDATA', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const xml = mystAstToJats(ast, {
      primaryLanguage: 'zh-Hans',
      title: 'demo',
    });
    assert.match(
      xml,
      /<disp-formula><tex-math><!\[CDATA\[\\rho\(t\) = \\frac\{1\}\{Z\}/,
    );
  });

  it('translates inline equation with inline-formula', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const xml = mystAstToJats(ast, {
      primaryLanguage: 'zh-Hans',
      title: 'demo',
    });
    assert.match(xml, /<inline-formula><tex-math><!\[CDATA\[\\mathcal\{L\}/);
  });

  it('translates citationRef to xref ref-type=bibr', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const xml = mystAstToJats(ast, {
      primaryLanguage: 'zh-Hans',
      title: 'demo',
    });
    assert.match(
      xml,
      /<xref ref-type="bibr" rid="cite-doi-10\.1145-3531146\.3533104">Bommasani 2022<\/xref>/,
    );
  });

  it('emits authors as contrib-group when provided', () => {
    const ast = pmToMystAst({ type: 'doc', content: [] });
    const xml = mystAstToJats(ast, {
      primaryLanguage: 'en',
      title: 't',
      authors: [{ givenName: 'Ada', familyName: 'Lovelace' }],
    });
    assert.match(xml, /<contrib contrib-type="author">/);
    assert.match(xml, /<surname>Lovelace<\/surname>/);
    assert.match(xml, /<given-names>Ada<\/given-names>/);
  });

  it('escapes XML reserved chars in text', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A & B <C> &"' }],
        },
      ],
    };
    const ast = pmToMystAst(pmDoc);
    const xml = mystAstToJats(ast, { primaryLanguage: 'en', title: 't' });
    assert.match(xml, /A &amp; B &lt;C&gt;/);
  });

  it('CJK content survives the pre-pass without breaking XML', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '中文内容包含 "quoted" 短语。' }],
        },
      ],
    };
    const ast = pmToMystAst(pmDoc);
    const xml = mystAstToJats(ast, {
      primaryLanguage: 'zh-Hans',
      title: 't',
    });
    assert.match(xml, /中文内容包含/);
    // confirm output is well-formed-ish: balanced angle brackets count
    const opens = (xml.match(/</g) ?? []).length;
    const closes = (xml.match(/>/g) ?? []).length;
    assert.equal(opens, closes);
  });
});
