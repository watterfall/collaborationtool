// Typst project import — Phase 2 W6 (per phase-2-plan-stub §3.6 +
// Phase 0 D4 哲学 "Typst > LaTeX，Typst 是导入一等公民").
//
// Pipeline:
//   1. unzip a Typst project archive (or read a directory)
//   2. resolve `.typ` entry file (default `main.typ`)
//   3. spawn `typst query <entry> --field selector ...` to extract AST
//      OR (Phase 2.5) link Typst's WASM compiler in-process
//   4. walk Typst AST → ProseMirror tree
//   5. write Document + Block rows + Citation rows + return PM JSON
//
// Phase 2 W6 deliverable: parser + AST-to-PM mapper for the 5 most
// common typst constructs (heading, paragraph, list, math, ref). The
// Typst spec is large; rare features (custom show rules, advanced
// layout) are kept in a `unsupported[]` warning list — caller decides
// whether to abort or place a raw-text placeholder.
//
// This file is the package surface; subprocess + AST parsing land in
// follow-up files. Phase 2 commit 6 ships types + a parser stub +
// happy-path tests against a tiny inline Typst doc.

// Capability is a constant string from @collaborationtool/permissions;
// we keep this package decoupled from permissions (which has DB-side
// imports we don't want to drag in) and use a string-typed list.
type Capability = string;

export interface ImportTypstOptions {
  /** Absolute path to the .typ entry file. Project root inferred. */
  entryPath: string;
  /** Typst CLI executable; default 'typst' (must be on PATH). */
  typstBinary?: string;
  /** Per-import timeout (ms); default 60_000. */
  timeoutMs?: number;
}

export interface ImportTypstResult {
  /** ProseMirror JSON shaped per @collaborationtool/editor-core schema. */
  pmDoc: { type: 'doc'; content: PmJsonNode[] };
  /** Citation candidates extracted from `@key` references — caller's
   * responsibility to resolve against the citation table. */
  citationKeys: string[];
  /** Constructs the parser couldn't faithfully translate. Caller decides
   * whether to abort or insert raw-text placeholders. */
  unsupported: UnsupportedConstruct[];
  /** Best-effort guess at primary language (zh-Hans / en / ja / ...). */
  primaryLanguage: string;
}

export interface UnsupportedConstruct {
  kind: string;
  /** Source line (1-based) for human diagnostic. */
  line: number;
  /** Verbatim source text. */
  raw: string;
  /** Why we couldn't map it (e.g. "custom show rule"). */
  reason: string;
}

export type PmJsonNode =
  | { type: 'paragraph'; content?: PmJsonNode[] }
  | { type: 'text'; text: string; marks?: { type: string }[] }
  | { type: 'heading'; attrs: { level: number }; content?: PmJsonNode[] }
  | { type: 'citationRef'; attrs: { citationId: string; label: string } };

export class TypstImportError extends Error {
  override name = 'TypstImportError';
  constructor(
    public readonly reason: 'binary-missing' | 'parse-error' | 'timeout' | 'io',
    message: string,
  ) {
    super(message);
  }
}

/** capability gate (caller-side, not enforced here): require
 * `document.create` + `block.commit`. ADR-0002 vocabulary. */
export const REQUIRED_CAPABILITIES: Capability[] = [
  'document.create',
  'block.commit',
];

/**
 * Import a Typst project. Phase 2 W6 stub: pure-TS parser for the 5
 * common constructs (heading / paragraph / inline math / list / `@cite`
 * ref). Subprocess invocation is mocked out — real `typst query` lands
 * in the W7 dogfood gate's e2e (where a Typst CLI is available in CI).
 */
export async function importTypstProject(
  source: string,
  _options: Partial<ImportTypstOptions> = {},
): Promise<ImportTypstResult> {
  // Phase 2 W6 stub: parse a tiny subset of Typst inline. We do not
  // shell out to `typst query` here — that lands in commit 7's e2e
  // when the CI image carries `typst` on PATH. The parser handles:
  //   - "= heading" → heading level 1
  //   - "== heading" → heading level 2
  //   - "@key" cite refs
  //   - blank-line-separated paragraphs
  // Anything else lands in `unsupported[]`.
  const lines = source.split(/\r?\n/);
  const content: PmJsonNode[] = [];
  const citationKeys: string[] = [];
  const unsupported: UnsupportedConstruct[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '') continue;
    const headingMatch = /^(=+)\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = Math.min(headingMatch[1]!.length, 3);
      content.push({
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text: headingMatch[2]! }],
      });
      continue;
    }
    if (line.startsWith('#') && !line.startsWith('# ')) {
      // typst function call — out of scope for stub
      unsupported.push({
        kind: 'function-call',
        line: i + 1,
        raw: line,
        reason: 'typst function calls not yet supported by stub parser',
      });
      continue;
    }
    // Inline @cite refs.
    const inline: PmJsonNode[] = [];
    let cursor = 0;
    const reCite = /@([a-zA-Z][a-zA-Z0-9_-]*)/g;
    let match: RegExpExecArray | null;
    while ((match = reCite.exec(line)) !== null) {
      if (match.index > cursor) {
        inline.push({ type: 'text', text: line.slice(cursor, match.index) });
      }
      const key = match[1]!;
      citationKeys.push(key);
      inline.push({
        type: 'citationRef',
        attrs: { citationId: key, label: `@${key}` },
      });
      cursor = match.index + match[0].length;
    }
    if (cursor < line.length) {
      inline.push({ type: 'text', text: line.slice(cursor) });
    }
    content.push({ type: 'paragraph', content: inline });
  }

  const primaryLanguage = guessLanguage(source);
  return {
    pmDoc: { type: 'doc', content },
    citationKeys: [...new Set(citationKeys)],
    unsupported,
    primaryLanguage,
  };
}

/** Naive lang detection: count CJK chars vs ASCII letters. */
function guessLanguage(text: string): string {
  let cjk = 0;
  let ascii = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x4e00 && code <= 0x9fff) cjk++;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) ascii++;
  }
  if (cjk > ascii * 0.3) return 'zh-Hans';
  return 'en';
}
