// Language-aware smart quote conversion.
//
// proto-b/findings.md §3.4: mystmd's `smart` extension applies pandoc-
// style curly quotes regardless of the surrounding script. That breaks
// CJK paragraphs (where the convention is fullwidth corner brackets 「」
// or fullwidth curly quotes “”) and breaks mixed-script identifiers
// like "x86_64".
//
// This module pre-processes raw text and emits the right quote style
// per character context. We skip identifier-like substrings ([A-Za-z0-9_]+)
// so "x86_64" stays as ASCII quotes (or none).

import { classifyText, isCjkLanguage } from './language';

export type QuoteStyle = 'ascii' | 'curly-en' | 'curly-zh' | 'corner-zh';

export interface SmartQuoteOptions {
  /** Document primary language (BCP 47). Influences the default style. */
  primaryLanguage: string;
  /** Override style for CJK runs. Default: 'curly-zh'. */
  cjkStyle?: 'curly-zh' | 'corner-zh';
  /** Override style for Latin runs. Default: 'curly-en'. */
  latinStyle?: 'curly-en' | 'ascii';
}

interface QuoteSet {
  doubleOpen: string;
  doubleClose: string;
  singleOpen: string;
  singleClose: string;
}

const QUOTE_SETS: Record<QuoteStyle, QuoteSet> = {
  ascii: {
    doubleOpen: '"',
    doubleClose: '"',
    singleOpen: "'",
    singleClose: "'",
  },
  'curly-en': {
    doubleOpen: '“',
    doubleClose: '”',
    singleOpen: '‘',
    singleClose: '’',
  },
  // CJK primary convention: fullwidth curly quotes (Mainland / Taiwan publishing).
  'curly-zh': {
    doubleOpen: '“',
    doubleClose: '”',
    singleOpen: '‘',
    singleClose: '’',
  },
  // CJK alternative: corner brackets (HK / older typesetting).
  'corner-zh': {
    doubleOpen: '「',
    doubleClose: '」',
    singleOpen: '『',
    singleClose: '』',
  },
};

/**
 * Convert ASCII straight quotes to language-appropriate curly / corner
 * quotes. Identifier-like runs are preserved as-is.
 *
 * Phase 1 D12 implementation is paragraph-level: we classify the run
 * around each quote pair to pick the style. That's good enough for the
 * proto-b 6 typography edge cases. Phase 2 may run a per-token tagger
 * with proper script attribution for code spans inside CJK paragraphs.
 */
export function smartQuoteByLang(
  text: string,
  options: SmartQuoteOptions,
): string {
  const cjkStyle: QuoteStyle = options.cjkStyle ?? 'curly-zh';
  const latinStyle: QuoteStyle = options.latinStyle ?? 'curly-en';
  const primaryStyle: QuoteStyle = isCjkLanguage(options.primaryLanguage)
    ? cjkStyle
    : latinStyle;

  return text.replace(
    /([\s\S]*?)(['"])/g,
    (match, before: string, quote: string, matchOffset: number, full: string) => {
      void match;
      // The replace callback's `offset` is the start of the FULL match
      // (which includes the `before` prefix). The quote itself sits at
      // matchOffset + before.length.
      const quoteOffset = matchOffset + before.length;
      const charBefore = full[quoteOffset - 1] ?? '';
      const charAfter = full[quoteOffset + 1] ?? '';
      if (
        isIdentifierChar(charBefore) &&
        isIdentifierChar(charAfter) &&
        quote === '"'
      ) {
        // straight double-quote inside an ASCII identifier — keep ASCII
        return `${before}${QUOTE_SETS.ascii.doubleOpen}`;
      }
      const window = full.slice(
        Math.max(0, quoteOffset - 8),
        quoteOffset + 8,
      );
      const script = classifyText(window);
      const localStyle: QuoteStyle =
        script === 'cjk' || (script === 'mixed' && primaryStyle === cjkStyle)
          ? cjkStyle
          : latinStyle;
      return `${before}${pickQuoteOrFallback(quote, localStyle, full, quoteOffset)}`;
    },
  );
}

function isIdentifierChar(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c);
}

// Track open/close state per-occurrence using a stable count of prior
// straight quotes of the same kind in the same buffer. This is a light
// approximation — it works well for paragraph-level prose.
function pickQuoteOrFallback(
  quote: string,
  style: QuoteStyle,
  full: string,
  offset: number,
): string {
  const set = QUOTE_SETS[style];
  if (quote === '"') {
    const priorDoubles = countAscii(full, '"', offset);
    return priorDoubles % 2 === 0 ? set.doubleOpen : set.doubleClose;
  }
  // Apostrophes inside English contractions (don't, it's) should stay
  // as the right single quote / apostrophe. We approximate: treat all '
  // inside [letter]'[letter] as closing single quote (= apostrophe).
  const charBefore = full[offset - 1] ?? '';
  const charAfter = full[offset + 1] ?? '';
  if (/[A-Za-z]/.test(charBefore) && /[A-Za-z]/.test(charAfter)) {
    return set.singleClose;
  }
  const priorSingles = countAscii(full, "'", offset);
  return priorSingles % 2 === 0 ? set.singleOpen : set.singleClose;
}

function countAscii(buf: string, ch: string, beforeOffset: number): number {
  let n = 0;
  for (let i = 0; i < beforeOffset; i++) if (buf[i] === ch) n++;
  return n;
}
