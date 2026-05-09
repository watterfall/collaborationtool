import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pmToMystAst } from '../src/ast-from-pm';
import { bilingualSpecimen } from '../fixtures/bilingual-specimen';

describe('pmToMystAst', () => {
  it('throws on non-doc root', () => {
    assert.throws(
      () => pmToMystAst({ type: 'paragraph' }),
      /expected root type 'doc'/,
    );
  });

  it('emits a root with the right children counts', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    assert.equal(ast.type, 'root');
    // 7 top-level blocks in the specimen
    assert.equal(ast.children.length, 7);
  });

  it('translates heading depth', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const heading = ast.children[0];
    assert.equal(heading?.type, 'heading');
    if (heading?.type === 'heading') assert.equal(heading.depth, 1);
  });

  it('translates citationRef into cite node with id + label', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const citeParagraph = ast.children[2];
    assert.equal(citeParagraph?.type, 'paragraph');
    if (citeParagraph?.type !== 'paragraph') return;
    const cite = citeParagraph.children.find((c) => c.type === 'cite');
    assert.ok(cite);
    if (cite?.type === 'cite') {
      assert.equal(cite.citationId, 'cite-doi-10.1145-3531146.3533104');
      assert.equal(cite.label, 'Bommasani 2022');
    }
  });

  it('translates display equation to math', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const math = ast.children[4];
    assert.equal(math?.type, 'math');
    if (math?.type === 'math') {
      assert.match(math.value, /rho/);
    }
  });

  it('translates inline equation to inlineMath', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const para = ast.children[3];
    assert.equal(para?.type, 'paragraph');
    if (para?.type !== 'paragraph') return;
    const im = para.children.find((c) => c.type === 'inlineMath');
    assert.ok(im);
  });

  it('translates computationalCell to code block', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const code = ast.children[6];
    assert.equal(code?.type, 'code');
    if (code?.type === 'code') {
      assert.equal(code.lang, 'molab');
      assert.match(code.value, /numpy/);
    }
  });

  it('preserves text marks (bold / italic)', () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const para = ast.children[5];
    assert.equal(para?.type, 'paragraph');
    if (para?.type !== 'paragraph') return;
    const boldText = para.children.find(
      (c) => c.type === 'text' && c.marks?.some((m) => m.type === 'bold'),
    );
    const italicText = para.children.find(
      (c) => c.type === 'text' && c.marks?.some((m) => m.type === 'italic'),
    );
    assert.ok(boldText);
    assert.ok(italicText);
  });
});
