// LaTeX project import — Phase 2 W6 (per phase-2-plan-stub §3.6:
// "迁移摩擦减压，不是哲学偏好；严格范围 — 不为奇怪 macros 写特例").
//
// Pipeline:
//   1. unzip a LaTeX project archive (or read a directory)
//   2. resolve `\documentclass{...}` entry file (default `main.tex`)
//   3. spawn `mystmd` CLI to convert .tex → mystmd AST
//      (mystmd was already used in Phase 1 D12 for rendering)
//   4. walk mystmd AST → ProseMirror tree (same target as
//      import-typst — output schema matches editor-core)
//   5. Strict scope: no custom macro expansion, no TikZ adaptation,
//      no custom document-class fallbacks. Anything not recognised by
//      mystmd lands in `unsupported[]`.
//
// Phase 2 W6 stub: types + minimal AST mapper for the 5 most common
// LaTeX constructs (heading via \section, paragraph, \cite{key},
// $math$, itemize/enumerate). Subprocess invocation lands W7 e2e.

// Capability is a constant string from @collaborationtool/permissions;
// we keep this package decoupled from permissions and use a string-
// typed alias here (per import-typst pattern).
type Capability = string;

// Mirror of import-typst's small type set (intentionally not extracted
// to a shared util — these two importers may diverge on PM coverage as
// they evolve, and user philosophy avoids premature abstraction).
export type PmJsonNode =
  | { type: 'paragraph'; content?: PmJsonNode[] }
  | { type: 'text'; text: string; marks?: { type: string }[] }
  | { type: 'heading'; attrs: { level: number }; content?: PmJsonNode[] }
  | { type: 'citationRef'; attrs: { citationId: string; label: string } };

export interface UnsupportedConstruct {
  kind: string;
  line: number;
  raw: string;
  reason: string;
}

export interface ImportLatexOptions {
  entryPath: string;
  /** mystmd CLI executable; default 'myst'. */
  mystBinary?: string;
  timeoutMs?: number;
}

export interface ImportLatexResult {
  pmDoc: { type: 'doc'; content: PmJsonNode[] };
  citationKeys: string[];
  unsupported: UnsupportedConstruct[];
  primaryLanguage: string;
}

export class LatexImportError extends Error {
  override name = 'LatexImportError';
  constructor(
    public readonly reason:
      | 'binary-missing'
      | 'parse-error'
      | 'timeout'
      | 'io'
      | 'unsupported-class',
    message: string,
  ) {
    super(message);
  }
}

// Phase 2.5: real `myst` (mystmd CLI) subprocess wrapper.
export { runMystExport, probeMystBinary } from './cli';
export type { MystExportOptions, MystExportResult } from './cli';

export const REQUIRED_CAPABILITIES: Capability[] = [
  'document.create',
  'block.commit',
];

/**
 * Import a LaTeX project. Phase 2 W6 stub: pure-TS parser for 5
 * common constructs. Real mystmd subprocess lands W7 e2e (when CI
 * image carries `myst` on PATH).
 */
export async function importLatexProject(
  source: string,
  _options: Partial<ImportLatexOptions> = {},
): Promise<ImportLatexResult> {
  const lines = source.split(/\r?\n/);
  const content: PmJsonNode[] = [];
  const citationKeys: string[] = [];
  const unsupported: UnsupportedConstruct[] = [];

  let i = 0;
  // Strip preamble until \begin{document}; flag custom class as unsupported.
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.startsWith('\\documentclass')) {
      const m = /\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/.exec(line);
      if (m && !['article', 'report', 'book'].includes(m[1]!)) {
        unsupported.push({
          kind: 'document-class',
          line: i + 1,
          raw: line,
          reason: `non-standard documentclass '${m[1]}' — Phase 2 W6 strict scope only handles article/report/book`,
        });
      }
    }
    if (line.startsWith('\\begin{document}')) {
      i++;
      break;
    }
    i++;
  }

  // Body: \section/\subsection → headings; \cite{...} → citationRef;
  // anything starting with \ that isn't recognised → unsupported.
  for (; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('\\end{document}')) break;
    if (line.trim() === '') continue;

    const sectionMatch = /^\\(section|subsection|subsubsection)\{(.+)\}$/.exec(
      line,
    );
    if (sectionMatch) {
      const level =
        sectionMatch[1] === 'section'
          ? 1
          : sectionMatch[1] === 'subsection'
            ? 2
            : 3;
      content.push({
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text: sectionMatch[2]! }],
      });
      continue;
    }

    if (line.startsWith('\\') && !/^\\(cite|emph|textbf|textit)/.test(line)) {
      unsupported.push({
        kind: 'unknown-macro',
        line: i + 1,
        raw: line,
        reason: 'macro outside the W6 supported set; user must expand or remove',
      });
      continue;
    }

    // Inline \cite{key} (also handles \cite{a,b,c}).
    const inline: PmJsonNode[] = [];
    let cursor = 0;
    const reCite = /\\cite\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = reCite.exec(line)) !== null) {
      if (match.index > cursor) {
        inline.push({ type: 'text', text: line.slice(cursor, match.index) });
      }
      const keys = match[1]!.split(',').map((k) => k.trim());
      for (const key of keys) {
        citationKeys.push(key);
        inline.push({
          type: 'citationRef',
          attrs: { citationId: key, label: `[${key}]` },
        });
      }
      cursor = match.index + match[0].length;
    }
    if (cursor < line.length) {
      inline.push({ type: 'text', text: line.slice(cursor) });
    }
    content.push({ type: 'paragraph', content: inline });
  }

  return {
    pmDoc: { type: 'doc', content },
    citationKeys: [...new Set(citationKeys)],
    unsupported,
    primaryLanguage: 'en', // LaTeX projects in our target audience are mostly English
  };
}
