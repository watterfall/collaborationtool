// Phase 2 W6 typst import stub tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { importTypstProject, TypstImportError } from '../src/index';

describe('importTypstProject (W6 stub)', () => {
  it('parses headings and paragraphs', async () => {
    const r = await importTypstProject(`= Title

A paragraph here.

== Section

Another paragraph.`);
    assert.equal(r.pmDoc.content.length, 4);
    assert.equal(r.pmDoc.content[0]?.type, 'heading');
    assert.equal(r.pmDoc.content[1]?.type, 'paragraph');
  });

  it('extracts @cite refs from paragraphs', async () => {
    const r = await importTypstProject(
      `Foundation models are surveyed in @bommasani2022opportunities and discussed in @nature2024.`,
    );
    assert.equal(r.citationKeys.length, 2);
    assert.deepEqual(r.citationKeys, [
      'bommasani2022opportunities',
      'nature2024',
    ]);
    const para = r.pmDoc.content[0]!;
    assert.equal(para.type, 'paragraph');
    const inline = (para as { content: { type: string }[] }).content;
    assert.ok(inline.some((n) => n.type === 'citationRef'));
  });

  it('flags unsupported function calls', async () => {
    const r = await importTypstProject(`#show heading: it => emph(it.body)`);
    assert.equal(r.unsupported.length, 1);
    assert.equal(r.unsupported[0]?.kind, 'function-call');
  });

  it('detects zh-Hans primary language', async () => {
    const r = await importTypstProject(`= 标题\n\n这是一段中文内容。`);
    assert.equal(r.primaryLanguage, 'zh-Hans');
  });

  it('TypstImportError class is exported and constructible', () => {
    const e = new TypstImportError('parse-error', 'oops');
    assert.equal(e.name, 'TypstImportError');
    assert.equal(e.reason, 'parse-error');
  });
});
