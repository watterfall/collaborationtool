// pangu-style CJK ↔ Latin spacing.
//
// Inserts a thin space (or regular space when targets prefer ASCII)
// between adjacent CJK and Latin runs. Skips when whitespace already
// separates them, so it's idempotent.
//
// Phase 1 D12 uses a regular U+0020 space — works in HTML/Word and
// matches what mystmd's smart-typography expects. Typst rendering can
// substitute a thin space (U+2009) at output time via `set text` if the
// journal house style demands it.

import {
  isAsciiLetterOrDigit,
  isCjkPunctuation,
  isHanCharacter,
} from './language';

export interface CjkSpacingOptions {
  /** Glyph used between CJK and Latin runs. Default: ' ' (U+0020). */
  separator?: string;
}

/**
 * Insert a space between adjacent CJK / Latin runs in `text`. Idempotent:
 * if a separator is already present, nothing changes.
 */
export function applyCjkSpacing(
  text: string,
  options: CjkSpacingOptions = {},
): string {
  if (text.length < 2) return text;

  const sep = options.separator ?? ' ';
  const codepoints = Array.from(text);

  let out = codepoints[0]!;
  for (let i = 1; i < codepoints.length; i++) {
    const prev = codepoints[i - 1]!;
    const cur = codepoints[i]!;
    const prevCp = prev.codePointAt(0)!;
    const curCp = cur.codePointAt(0)!;

    const prevHan = isHanCharacter(prevCp);
    const curHan = isHanCharacter(curCp);
    const prevLatin = isAsciiLetterOrDigit(prevCp);
    const curLatin = isAsciiLetterOrDigit(curCp);
    // CJK 全宽标点（如 。、，：；！？）紧贴 Latin 时也要插空格，
    // 否则 ".brainstorm/role-design.md §3" 实测的 "。Phase" 视觉黏连。
    // 标点本身已带视觉间距，但 pangu 风格仍要求显式分隔以稳定排版。
    const prevCjkPunct = isCjkPunctuation(prevCp);
    const curCjkPunct = isCjkPunctuation(curCp);

    const boundary =
      (prevHan && curLatin) ||
      (prevLatin && curHan) ||
      (prevCjkPunct && curLatin) ||
      (prevLatin && curCjkPunct);
    if (boundary) out += sep;
    out += cur;
  }
  return out;
}
