// Thought ↔ vault markdown file codec — ADR-0021 §2 vault-native 存储。
//
// Night artifact 是 `<vault>/night/<YYYY-MM-DD>-<slug>.md` 的人可读
// markdown 文件：`---` 围栏内是**约束文法** frontmatter（每行一条
// `key: value`，列表用逗号——不是完整 YAML，不引入解析依赖），正文即
// `bodyMarkdown`。codec 放在类型 SoT 旁边：NightArtifactBase 字段漂移时
// 这里 typecheck 直接报错。
//
// 切片范围（Wave A2）：仅 thought kind。其余 5 kind 同构复制（plan
// improvement-plan-2026-08 §三 A2.3）。

import type { PrincipalId, IsoDateTime, ProvenanceId } from './_shared';
import type { VisibilityTier, ArtifactStatus } from './_shared';
import { isModeTag, type ModeTag } from './mode-tag';
import type { Thought } from './thought';

export const NIGHT_DIR = 'night';

const VISIBILITIES: readonly string[] = [
  'private',
  'collaborator',
  'org',
  'public',
];
const STATUSES: readonly string[] = ['draft', 'active', 'archived', 'superseded'];

export interface ParsedThoughtFile {
  thought: Thought | null;
  errors: readonly string[];
}

/** `night/2026-07-18-<slug>.md` — CJK 保留，文件系统不安全字符剥离。 */
export function buildNightFileName(
  createdAt: IsoDateTime,
  title: string,
): string {
  const date = String(createdAt).slice(0, 10);
  const slug =
    title
      .toLowerCase()
      .replace(/[/\\:*?"<>|#%\s]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'thought';
  return `${NIGHT_DIR}/${date}-${slug}.md`;
}

/** Serialize a Thought to the on-disk vault file content. */
export function serializeThoughtVaultFile(thought: Thought): string {
  const lines: string[] = [
    '---',
    'night: thought',
    `id: ${thought.id}`,
    `author: ${thought.authorPrincipalId}`,
    `created: ${thought.createdAt}`,
    `updated: ${thought.updatedAt}`,
    `visibility: ${thought.visibility}`,
    `status: ${thought.status}`,
  ];
  if (thought.modeTags.length > 0) {
    lines.push(`mode-tags: ${thought.modeTags.join(', ')}`);
  }
  lines.push(`provenance: ${thought.provenanceId}`);
  lines.push(`title: ${thought.title}`);
  lines.push('---');
  const body = thought.bodyMarkdown;
  return `${lines.join('\n')}\n${body.length > 0 ? `\n${body}` : ''}`;
}

function parseFields(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split('\n')) {
    if (line.trim() === '' || line.trim() === '---') continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return fields;
}

/**
 * Parse vault file content back to a Thought. Strict on enums and
 * required fields; returns errors instead of throwing so callers can
 * surface"这个文件不是合法 thought"而不是崩。
 */
export function parseThoughtVaultFile(content: string): ParsedThoughtFile {
  const errors: string[] = [];
  if (!content.startsWith('---\n')) {
    return { thought: null, errors: ['missing frontmatter fence / 缺少 frontmatter 围栏'] };
  }
  const close = content.indexOf('\n---', 3);
  if (close < 0) {
    return { thought: null, errors: ['unterminated frontmatter / frontmatter 未闭合'] };
  }
  const block = content.slice(4, close);
  const afterFence = content.indexOf('\n', close + 4);
  const rawBody = afterFence >= 0 ? content.slice(afterFence + 1) : '';
  const body = rawBody.startsWith('\n') ? rawBody.slice(1) : rawBody;

  const f = parseFields(block);
  const required = (key: string): string => {
    const v = f.get(key);
    if (v === undefined || v === '') {
      errors.push(`missing field "${key}" / 缺少字段 "${key}"`);
      return '';
    }
    return v;
  };

  if (f.get('night') !== 'thought') {
    errors.push('not a thought file (night != thought) / 不是 thought 文件');
  }
  const id = required('id');
  const author = required('author');
  const created = required('created');
  const updated = required('updated');
  const visibility = required('visibility');
  const status = required('status');
  const title = required('title');
  const provenance = required('provenance');

  if (visibility && !VISIBILITIES.includes(visibility)) {
    errors.push(`invalid visibility "${visibility}" / 非法 visibility`);
  }
  if (status && !STATUSES.includes(status)) {
    errors.push(`invalid status "${status}" / 非法 status`);
  }
  const modeTags: ModeTag[] = [];
  const rawTags = f.get('mode-tags');
  if (rawTags) {
    for (const tag of rawTags.split(',').map((t) => t.trim()).filter(Boolean)) {
      if (isModeTag(tag)) modeTags.push(tag);
      else errors.push(`invalid mode tag "${tag}" / 非法 mode tag`);
    }
  }

  if (errors.length > 0) {
    return { thought: null, errors };
  }
  return {
    thought: {
      kind: 'thought',
      id,
      authorPrincipalId: author as PrincipalId,
      createdAt: created as IsoDateTime,
      updatedAt: updated as IsoDateTime,
      visibility: visibility as VisibilityTier,
      status: status as ArtifactStatus,
      provenanceId: provenance as ProvenanceId,
      modeTags,
      title,
      bodyMarkdown: body,
    },
    errors: [],
  };
}
