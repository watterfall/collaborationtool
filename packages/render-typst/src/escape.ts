// Typst content/string escaping. Typst has two contexts:
//   - markup (the body of the document): special chars are #*/_~`<>$@\
//     and brackets / braces / brackets at line starts.
//   - string literal (inside `"..."`): " and \ must be escaped.

const TYPST_MARKUP_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  '#': '\\#',
  '$': '\\$',
  '*': '\\*',
  '_': '\\_',
  '/': '\\/',
  '`': '\\`',
  '<': '\\<',
  '>': '\\>',
  '@': '\\@',
  '~': '\\~',
};

export function escapeTypstMarkup(text: string): string {
  // Replace single chars in one pass.
  let out = '';
  for (const ch of text) {
    out += TYPST_MARKUP_ESCAPES[ch] ?? ch;
  }
  return out;
}

export function escapeTypstString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
