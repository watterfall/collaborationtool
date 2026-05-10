// Phase 2 W6 latex import stub tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { importLatexProject, LatexImportError } from '../src/index';

const SAMPLE = `\\documentclass{article}
\\begin{document}
\\section{Introduction}
Foundation models such as \\cite{bommasani2022opportunities} have grown rapidly.
\\subsection{Background}
We follow \\cite{nature2024,clark2024}.
\\end{document}
`;

describe('importLatexProject (W6 stub)', () => {
  it('parses sections + extracts \\cite{...} keys', async () => {
    const r = await importLatexProject(SAMPLE);
    assert.equal(r.pmDoc.content.length, 4); // 2 headings + 2 paragraphs
    assert.equal(r.pmDoc.content[0]?.type, 'heading');
    assert.equal(r.citationKeys.length, 3);
    assert.deepEqual(r.citationKeys.sort(), [
      'bommasani2022opportunities',
      'clark2024',
      'nature2024',
    ]);
  });

  it('flags non-standard documentclass as unsupported', async () => {
    const r = await importLatexProject(`\\documentclass{ieeeconf}
\\begin{document}
Body.
\\end{document}`);
    assert.ok(
      r.unsupported.some(
        (u) => u.kind === 'document-class' && /ieeeconf/.test(u.raw),
      ),
    );
  });

  it('flags unknown \\macro as unsupported', async () => {
    const r = await importLatexProject(`\\documentclass{article}
\\begin{document}
\\tikzpicture
\\end{document}`);
    assert.ok(r.unsupported.some((u) => u.kind === 'unknown-macro'));
  });

  it('LatexImportError class is exported and constructible', () => {
    const e = new LatexImportError('parse-error', 'oops');
    assert.equal(e.name, 'LatexImportError');
    assert.equal(e.reason, 'parse-error');
  });
});
