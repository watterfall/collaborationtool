// MyST AST → MyST Markdown source. Useful as an editor "view source"
// path and as input to mystmd CLI's other backends (Phase 1.5 swap-in
// to mystmd's `myst-to-md`).
//
// Phase 1 keeps the syntax minimal: paragraphs / headings / math /
// citation references / lists / code blocks. No directive blocks.

import type {
  MystInline,
  MystNode,
  MystRoot,
} from './types';

export function mystAstToMarkdown(ast: MystRoot): string {
  return ast.children.map(renderBlock).join('\n\n');
}

function renderBlock(node: MystNode): string {
  switch (node.type) {
    case 'paragraph':
      return renderInline(node.children);
    case 'heading':
      return `${'#'.repeat(node.depth)} ${renderInline(node.children)}`;
    case 'math':
      return `$$\n${node.value}\n$$`;
    case 'code':
      return `\`\`\`${node.lang ?? ''}\n${node.value}\n\`\`\``;
    case 'blockquote':
      return node.children
        .map(renderBlock)
        .map((line) =>
          line
            .split('\n')
            .map((l) => `> ${l}`)
            .join('\n'),
        )
        .join('\n>\n');
    case 'list': {
      const marker = node.ordered ? '1.' : '-';
      return node.children
        .map((li) =>
          li.children
            .map(renderBlock)
            .map((b) => `${marker} ${b}`)
            .join('\n'),
        )
        .join('\n');
    }
    case 'figure': {
      const image = node.children.find((c) => c.type === 'image');
      const caption = node.children.find((c) => c.type === 'caption');
      const url = image && image.type === 'image' ? image.url : '';
      const captionText =
        caption && caption.type === 'caption'
          ? renderInline(caption.children)
          : '';
      // MyST figure directive (long form):
      //   ```{figure} url
      //   :name: identifier
      //   caption
      //   ```
      const lines = ['```{figure} ' + url];
      if (node.identifier) lines.push(`:name: ${node.identifier}`);
      if (captionText) {
        lines.push('');
        lines.push(captionText);
      }
      lines.push('```');
      return lines.join('\n');
    }
    default:
      return '';
  }
}

function renderInline(children: MystInline[]): string {
  return children.map(renderInlineNode).join('');
}

function renderInlineNode(node: MystInline): string {
  switch (node.type) {
    case 'text': {
      let s = node.value;
      if (node.marks?.some((m) => m.type === 'italic')) s = `*${s}*`;
      if (node.marks?.some((m) => m.type === 'bold')) s = `**${s}**`;
      return s;
    }
    case 'emphasis':
      return `*${renderInline(node.children)}*`;
    case 'strong':
      return `**${renderInline(node.children)}**`;
    case 'inlineMath':
      return `$${node.value}$`;
    case 'cite':
      return `{cite}\`${node.citationId}\``;
    case 'crossReference':
      return `[](#${node.identifier})`;
    default:
      return '';
  }
}
