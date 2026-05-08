// KaTeX rendering helper. Display vs inline determined by caller.
// Phase 2 will add MathLive input + LaTeX -> MathML transformer for JATS;
// this file remains the renderer-side abstraction.

import katex from 'katex';

export function renderKatexInto(
  el: HTMLElement,
  latex: string,
  displayMode: boolean,
): void {
  try {
    katex.render(latex, el, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
  } catch (err) {
    el.textContent = `[KaTeX error: ${(err as Error).message}]`;
  }
}
