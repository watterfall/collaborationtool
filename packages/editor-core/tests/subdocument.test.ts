// Phase 4 W5 ADR-0014 subdocument helper tests.
//
// Pure JSON walker: no Yjs / no DOM / no PM instance. Same fixtures
// the snapshot-worker auto-split path will use.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  detectSubdocBoundariesByH1,
  extractCrossRefs,
  type PmDocJson,
} from '../src/subdocument';

function h1(text: string, blockId = `block:${text}`): unknown {
  return {
    type: 'heading',
    attrs: { level: 1, blockId },
    content: [{ type: 'text', text }],
  };
}
function h2(text: string, blockId = `block:${text}`): unknown {
  return {
    type: 'heading',
    attrs: { level: 2, blockId },
    content: [{ type: 'text', text }],
  };
}
function p(text: string, blockId = `p:${text.slice(0, 8)}`): unknown {
  return {
    type: 'paragraph',
    attrs: { blockId },
    content: text ? [{ type: 'text', text }] : [],
  };
}

function doc(...children: unknown[]): PmDocJson {
  return { type: 'doc', content: children as PmDocJson['content'] };
}

describe('detectSubdocBoundariesByH1', () => {
  it('returns empty for empty doc', () => {
    assert.deepEqual(detectSubdocBoundariesByH1(doc()), []);
  });

  it('treats no-h1 doc as single Preamble subdoc', () => {
    const out = detectSubdocBoundariesByH1(
      doc(p('intro'), p('more'), h2('subhead'), p('end')),
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.title, 'Preamble');
    assert.equal(out[0]!.startBlockIndex, 0);
    assert.equal(out[0]!.endBlockIndex, 4);
  });

  it('splits on heading level=1 starting from first h1', () => {
    const out = detectSubdocBoundariesByH1(
      doc(h1('Introduction'), p('a'), h1('Methods'), p('b'), p('c')),
    );
    assert.equal(out.length, 2);
    assert.equal(out[0]!.title, 'Introduction');
    assert.equal(out[0]!.startBlockIndex, 0);
    assert.equal(out[0]!.endBlockIndex, 2);
    assert.equal(out[1]!.title, 'Methods');
    assert.equal(out[1]!.startBlockIndex, 2);
    assert.equal(out[1]!.endBlockIndex, 5);
  });

  it('preamble + multi-h1: emits Preamble (ord=0) + sections', () => {
    const out = detectSubdocBoundariesByH1(
      doc(p('abstract'), p('foreword'), h1('§1'), p('a'), h1('§2'), p('b')),
    );
    assert.equal(out.length, 3);
    assert.equal(out[0]!.title, 'Preamble');
    assert.equal(out[0]!.startBlockIndex, 0);
    assert.equal(out[0]!.endBlockIndex, 2);
    assert.equal(out[1]!.title, '§1');
    assert.equal(out[1]!.startBlockIndex, 2);
    assert.equal(out[1]!.endBlockIndex, 4);
    assert.equal(out[2]!.title, '§2');
    assert.equal(out[2]!.startBlockIndex, 4);
    assert.equal(out[2]!.endBlockIndex, 6);
  });

  it('falls back to "Section N" for empty heading', () => {
    const out = detectSubdocBoundariesByH1(
      doc({
        type: 'heading',
        attrs: { level: 1, blockId: 'b' },
        content: [],
      }),
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.title, 'Section 1');
  });

  it('does NOT split on heading level=2', () => {
    const out = detectSubdocBoundariesByH1(
      doc(h1('§1'), p('a'), h2('subsection'), p('b'), h1('§2'), p('c')),
    );
    assert.equal(out.length, 2);
    assert.equal(out[0]!.title, '§1');
    assert.equal(out[1]!.title, '§2');
  });

  it('ord values are sequential 0..N-1', () => {
    const out = detectSubdocBoundariesByH1(
      doc(p('preamble'), h1('§1'), h1('§2'), h1('§3')),
    );
    assert.deepEqual(
      out.map((b) => b.ord),
      [0, 1, 2, 3],
    );
  });
});

describe('extractCrossRefs', () => {
  it('emits citation refs from citationRef atoms', () => {
    const docJson = doc({
      type: 'paragraph',
      attrs: { blockId: 'p:1' },
      content: [
        { type: 'text', text: 'as shown in ' },
        {
          type: 'citationRef',
          attrs: { citationId: 'cit:abc', blockId: 'p:1' },
        },
        { type: 'text', text: '.' },
      ],
    });
    const refs = extractCrossRefs(docJson);
    assert.equal(refs.length, 1);
    assert.equal(refs[0]!.refKind, 'citation');
    assert.equal(refs[0]!.refTargetId, 'cit:abc');
    assert.equal(refs[0]!.sourceBlockId, 'p:1');
  });

  it('emits dataset refs as kind=citation (PG citation_kind unified)', () => {
    const refs = extractCrossRefs(
      doc({
        type: 'paragraph',
        attrs: { blockId: 'p:2' },
        content: [
          {
            type: 'datasetRef',
            attrs: { datasetId: 'ds:xyz', blockId: 'p:2' },
          },
        ],
      }),
    );
    assert.equal(refs.length, 1);
    assert.equal(refs[0]!.refKind, 'citation');
    assert.equal(refs[0]!.refTargetId, 'ds:xyz');
  });

  it('emits figure ref with target = blockId', () => {
    const refs = extractCrossRefs(
      doc({
        type: 'figure',
        attrs: { blockId: 'fig:1', src: 'a.png' },
        content: [],
      }),
    );
    assert.equal(refs.length, 1);
    assert.equal(refs[0]!.refKind, 'figure');
    assert.equal(refs[0]!.refTargetId, 'fig:1');
    assert.equal(refs[0]!.sourceBlockId, 'fig:1');
  });

  it('emits claim + evidence by their attr ids', () => {
    const refs = extractCrossRefs(
      doc(
        {
          type: 'claim',
          attrs: { blockId: 'cl:b', claimId: 'claim:42' },
          content: [p('claim text')],
        },
        {
          type: 'evidence',
          attrs: {
            blockId: 'ev:b',
            evidenceId: 'evidence:7',
            supportsClaimId: 'claim:42',
          },
          content: [p('evidence text')],
        },
      ),
    );
    const byKind = Object.fromEntries(refs.map((r) => [r.refKind, r]));
    assert.equal(byKind['claim']?.refTargetId, 'claim:42');
    assert.equal(byKind['evidence']?.refTargetId, 'evidence:7');
  });

  it('dedupes (kind, target, sourceBlockId)', () => {
    const refs = extractCrossRefs(
      doc({
        type: 'paragraph',
        attrs: { blockId: 'p:1' },
        content: [
          {
            type: 'citationRef',
            attrs: { citationId: 'cit:abc', blockId: 'p:1' },
          },
          {
            type: 'citationRef',
            attrs: { citationId: 'cit:abc', blockId: 'p:1' },
          },
        ],
      }),
    );
    assert.equal(refs.length, 1);
  });

  it('keeps multiple refs in same block when target differs', () => {
    const refs = extractCrossRefs(
      doc({
        type: 'paragraph',
        attrs: { blockId: 'p:1' },
        content: [
          {
            type: 'citationRef',
            attrs: { citationId: 'cit:1', blockId: 'p:1' },
          },
          {
            type: 'citationRef',
            attrs: { citationId: 'cit:2', blockId: 'p:1' },
          },
        ],
      }),
    );
    assert.equal(refs.length, 2);
  });

  it('skips citationRef without an enclosing block id', () => {
    const refs = extractCrossRefs(
      doc({
        type: 'paragraph',
        attrs: {}, // no blockId
        content: [
          {
            type: 'citationRef',
            attrs: { citationId: 'cit:lone' },
          },
        ],
      }),
    );
    assert.equal(refs.length, 0);
  });
});
