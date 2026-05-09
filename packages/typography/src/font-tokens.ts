// Font fallback chains — the renderers consume these so a CJK paragraph
// always has the right glyph available even when the project ships a
// minimal local font set.
//
// Two fingerprints:
//   - CSS:   for HTML/Word output
//   - Typst: for the print PDF pipeline
//
// Phase 1 production: docker images install Source Han Serif/Sans + Noto
// Sans CJK so the FIRST entry in the chain always lands. Phase 1 dev
// boxes may only have system fonts, hence the fallback list.

import type { LanguageTag } from './language';

export interface FontTokens {
  /** Body / running text. */
  serif: string[];
  /** UI / sans-serif headings (when the design calls for it). */
  sans: string[];
  /** Monospace for code blocks + computational cells. */
  mono: string[];
}

const SERIF_BASE = ['ui-serif', 'Georgia', 'serif'];
const SANS_BASE = ['ui-sans-serif', 'system-ui', 'sans-serif'];
const MONO_BASE = ['ui-monospace', 'Menlo', 'Consolas', 'monospace'];

const ZH_SERIF = [
  'Source Han Serif SC',
  'Source Han Serif',
  'Songti SC',
  'STSong',
  'Noto Serif CJK SC',
];
const ZH_SANS = [
  'Source Han Sans SC',
  'Source Han Sans',
  'PingFang SC',
  'Hiragino Sans GB',
  'Microsoft YaHei',
  'Noto Sans CJK SC',
  'WenQuanYi Zen Hei',
];
const ZH_HANT_SERIF = [
  'Source Han Serif TC',
  'Source Han Serif',
  'Songti TC',
  'PMingLiU',
  'Noto Serif CJK TC',
];
const ZH_HANT_SANS = [
  'Source Han Sans TC',
  'Source Han Sans',
  'PingFang TC',
  'Heiti TC',
  'Microsoft JhengHei',
  'Noto Sans CJK TC',
];

/**
 * Build a font token bundle for a given primary language. CJK ones get
 * CJK fonts FIRST (so a Latin character in a CJK paragraph doesn't get
 * a Latin font with mismatched x-height). Latin-primary docs get
 * Latin-first chains so kerning + ligatures come from a Latin family.
 */
export function getFontTokens(primaryLanguage: LanguageTag): FontTokens {
  if (primaryLanguage === 'zh-Hant') {
    return {
      serif: [...ZH_HANT_SERIF, ...SERIF_BASE],
      sans: [...ZH_HANT_SANS, ...SANS_BASE],
      mono: [...MONO_BASE],
    };
  }
  if (primaryLanguage.startsWith('zh')) {
    return {
      serif: [...ZH_SERIF, ...SERIF_BASE],
      sans: [...ZH_SANS, ...SANS_BASE],
      mono: [...MONO_BASE],
    };
  }
  // Latin-first: keep CJK families on the chain so embedded CJK works.
  return {
    serif: [...SERIF_BASE.slice(0, 1), ...ZH_SERIF, ...SERIF_BASE.slice(1)],
    sans: [...SANS_BASE.slice(0, 1), ...ZH_SANS, ...SANS_BASE.slice(1)],
    mono: [...MONO_BASE],
  };
}

/** CSS `font-family` value — comma-separated, quoted where needed. */
export function fontTokensToCss(family: string[]): string {
  return family
    .map((name) => (name.includes(' ') ? `"${name}"` : name))
    .join(', ');
}

/** Typst `set text(font: ...)` value — array of strings. */
export function fontTokensToTypst(family: string[]): string {
  // Typst expects an array of quoted strings: `("a", "b", ...)`
  return `(${family.map((name) => JSON.stringify(name)).join(', ')})`;
}
