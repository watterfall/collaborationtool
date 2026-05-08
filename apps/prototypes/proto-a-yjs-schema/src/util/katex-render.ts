import katex from 'katex';

export function renderKatexInto(
  el: HTMLElement,
  latex: string,
  displayMode: boolean
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
