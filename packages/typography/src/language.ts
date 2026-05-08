// BCP 47 language helpers used by the typography pre-pass.

export type LanguageTag = 'zh-Hans' | 'zh-Hant' | 'en' | string;

export type ScriptFamily = 'cjk' | 'latin' | 'mixed' | 'other';

export function isCjkLanguage(lang: LanguageTag): boolean {
  return (
    lang.startsWith('zh') ||
    lang.startsWith('ja') ||
    lang.startsWith('ko')
  );
}

export function isHanCharacter(codePoint: number): boolean {
  // Basic CJK Unified Ideographs + extension A. Phase 2 widens to
  // extensions B-F; Phase 1 only paper-text needs the basic blocks.
  return (
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK Unified Ideographs
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK Extension A
    (codePoint >= 0x3040 && codePoint <= 0x309f) || // Hiragana
    (codePoint >= 0x30a0 && codePoint <= 0x30ff) || // Katakana
    (codePoint >= 0xac00 && codePoint <= 0xd7af) // Hangul Syllables
  );
}

export function isCjkPunctuation(codePoint: number): boolean {
  return (
    (codePoint >= 0x3000 && codePoint <= 0x303f) || // CJK Symbols and Punctuation
    (codePoint >= 0xff00 && codePoint <= 0xffef) // Halfwidth and Fullwidth Forms
  );
}

export function isAsciiLetterOrDigit(codePoint: number): boolean {
  return (
    (codePoint >= 0x30 && codePoint <= 0x39) || // 0-9
    (codePoint >= 0x41 && codePoint <= 0x5a) || // A-Z
    (codePoint >= 0x61 && codePoint <= 0x7a) // a-z
  );
}

export function classifyText(text: string): ScriptFamily {
  let han = 0;
  let latin = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (isHanCharacter(cp)) han++;
    else if (isAsciiLetterOrDigit(cp)) latin++;
  }
  if (han > 0 && latin > 0) return 'mixed';
  if (han > 0) return 'cjk';
  if (latin > 0) return 'latin';
  return 'other';
}
