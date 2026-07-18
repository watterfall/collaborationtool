// Frontmatter split/join — ADR-0021 §3 保全原语。
//
// vault-fs 的 markdown ↔ Y.Doc 往返不理解 frontmatter：parse 会把它当正文
// 文本吞进 PM tree，emit 再按 PM 序列化重写——类型化头部在一次编辑往返后
// 就损毁了。本模块提供最小纯函数：把 `---` 围栏块原样剥离 / 原样回贴，
// vault-host 的 per-doc hooks 在 parse 前 split、emit 后 join。
//
// Round-trip invariant（tests 锁死）：对任意输入
//   joinFrontmatter(...splitFrontmatter(content)) === content
// —— frontmatter 存的是包含两条围栏线与其后换行的**原始字节段**，join 是
// 纯拼接，不做任何再序列化。

export interface FrontmatterSplit {
  /**
   * The raw frontmatter block INCLUDING both `---` fence lines and the
   * newline after the closing fence; null when the content has none.
   */
  frontmatter: string | null;
  body: string;
}

const OPEN_FENCE = '---\n';

/**
 * Split a leading frontmatter block off `content`. A block only counts
 * when the content STARTS with `---\n` and a closing `---` line exists
 * (either `\n---\n` or a trailing `\n---` at EOF). Anything else — e.g.
 * a thematic break mid-document — is left untouched in the body.
 */
export function splitFrontmatter(content: string): FrontmatterSplit {
  if (!content.startsWith(OPEN_FENCE)) {
    return { frontmatter: null, body: content };
  }
  const afterOpen = OPEN_FENCE.length;
  const closeWithNewline = content.indexOf('\n---\n', afterOpen - 1);
  if (closeWithNewline >= 0) {
    const end = closeWithNewline + '\n---\n'.length;
    return {
      frontmatter: content.slice(0, end),
      body: content.slice(end),
    };
  }
  // Closing fence at EOF without trailing newline.
  if (content.endsWith('\n---') && content.length > afterOpen + 3) {
    return { frontmatter: content, body: '' };
  }
  return { frontmatter: null, body: content };
}

/** Pure concatenation — see round-trip invariant above. */
export function joinFrontmatter(
  frontmatter: string | null,
  body: string,
): string {
  return frontmatter === null ? body : frontmatter + body;
}
