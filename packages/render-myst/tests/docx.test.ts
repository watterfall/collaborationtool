import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inflateRawSync } from 'node:zlib';

import { pmToMystAst } from '../src/ast-from-pm';
import { mystAstToDocx } from '../src/docx';
import { bilingualSpecimen } from '../fixtures/bilingual-specimen';

// .docx is a zip; rather than pulling in jszip / unzipper, we just
// confirm the magic bytes and probe a few structural properties via the
// returned byte length. Round-trip parsing is left to integration tests
// that consume a real Word renderer.
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

describe('mystAstToDocx', () => {
  it('emits a non-trivial zip archive (.docx envelope)', async () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const bytes = await mystAstToDocx(ast, {
      primaryLanguage: 'zh-Hans',
      title: '协作论文平台',
    });
    assert.equal(bytes instanceof Uint8Array, true);
    assert.ok(bytes.byteLength > 1000, `expected >1 KB, got ${bytes.byteLength}`);
    const head = Buffer.from(bytes).subarray(0, 4);
    assert.deepEqual(head, ZIP_MAGIC, '.docx must start with zip PK\\x03\\x04');
  });

  it('renders the title at the top of the document XML', async () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const bytes = await mystAstToDocx(ast, {
      primaryLanguage: 'zh-Hans',
      title: 'TitleSentinel',
    });
    const xml = extractDocumentXml(bytes);
    assert.match(xml, /TitleSentinel/);
  });

  it('survives an empty body without throwing', async () => {
    const empty = pmToMystAst({ type: 'doc', content: [] });
    const bytes = await mystAstToDocx(empty, {
      primaryLanguage: 'en',
      title: 'empty',
    });
    assert.ok(bytes.byteLength > 500);
  });

  it('emits authors paragraph when provided', async () => {
    const ast = pmToMystAst(bilingualSpecimen);
    const bytes = await mystAstToDocx(ast, {
      primaryLanguage: 'en',
      title: 'doc',
      authors: [
        { givenName: 'Ada', familyName: 'Lovelace' },
        { givenName: 'Alan', familyName: 'Turing' },
      ],
    });
    const xml = extractDocumentXml(bytes);
    assert.match(xml, /Ada Lovelace, Alan Turing/);
  });

  it('CJK content survives the typography pre-pass round-trip', async () => {
    const ast = pmToMystAst({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '论文Hello world' }, // expect spacing inserted
          ],
        },
      ],
    });
    const bytes = await mystAstToDocx(ast, {
      primaryLanguage: 'zh-Hans',
      title: 'cjk',
    });
    const xml = extractDocumentXml(bytes);
    assert.match(xml, /论文 Hello/);
  });
});

/**
 * Minimal zip extractor — locates word/document.xml inside the .docx
 * archive and returns the inflated XML. We implement just enough of the
 * zip format to find a single named entry; this avoids a test-only
 * dependency on jszip.
 */
function extractDocumentXml(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  // Look for the EOCD record to find the central directory location.
  // PK\x05\x06 marks the End Of Central Directory; the central directory
  // entries each begin with PK\x01\x02. Each central directory entry
  // tells us where the local file header lives. We just scan local
  // headers (PK\x03\x04) directly and decode any entry whose name
  // matches "word/document.xml".
  const LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  let offset = 0;
  while (offset < buf.length) {
    const idx = buf.indexOf(LOCAL_HEADER, offset);
    if (idx < 0) break;
    const compressionMethod = buf.readUInt16LE(idx + 8);
    const compressedSize = buf.readUInt32LE(idx + 18);
    const fileNameLength = buf.readUInt16LE(idx + 26);
    const extraLength = buf.readUInt16LE(idx + 28);
    const nameStart = idx + 30;
    const nameEnd = nameStart + fileNameLength;
    const name = buf.subarray(nameStart, nameEnd).toString('utf8');
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === 'word/document.xml') {
      const compressed = buf.subarray(dataStart, dataEnd);
      if (compressionMethod === 0) {
        return compressed.toString('utf8');
      }
      if (compressionMethod === 8) {
        return inflateRawSync(compressed).toString('utf8');
      }
      throw new Error(`unsupported zip compression method ${compressionMethod}`);
    }
    offset = dataEnd;
  }
  throw new Error('word/document.xml not found in .docx archive');
}

