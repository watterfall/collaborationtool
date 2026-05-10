// Phase 4 W6.2 — 新建文档模板（3 个起手包）
//
// 任务来源：role-user.md §2 dogfood gap "创建文档 → 跳到 /editor/[docId]，
// 没有任何模板/示例正文 —— A '我从哪粘贴 abstract？'"
//
// 三个模板：
//   blank          —— 空 PM doc（仅一个空段落）
//   bilingual-paper —— 复用 specimen-bilingual.json（500 字双语 + 公式 + figure + cite）
//   lit-review     —— 文献综述骨架（3 节标题 + 2 claim node + 1 evidence node）
//
// 模板 JSON 文件位于 apps/web/public/templates/<id>.json，通过 Server
// Component 端 fs.readFile 读取，避免运行时 HTTP 自请求。新建文档时把
// `templateId` 写入 document 行，并把模板 PM JSON 转成 Y.Doc 二进制存入
// document.yjs_doc_binary —— 这样 sync-gateway 任意 backend 都能在 doc
// 第一次连接时拿到非空状态。

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const DOC_TEMPLATE_IDS = ['blank', 'bilingual-paper', 'lit-review'] as const;

export type DocTemplateId = (typeof DOC_TEMPLATE_IDS)[number];

export interface DocTemplate {
  id: DocTemplateId;
  /** UI label — Chinese followed by English (项目第一性原理 #4). */
  label: string;
  /** Short description shown under the radio. */
  description: string;
}

export const DOC_TEMPLATES: readonly DocTemplate[] = [
  {
    id: 'blank',
    label: '空白 / Blank',
    description: '从零开始，只有一个空段落 / Empty document, one paragraph.',
  },
  {
    id: 'bilingual-paper',
    label: '双语论文 / Bilingual paper',
    description:
      '示例双语论文（带公式、figure、citation 与 computational cell） / Demo bilingual paper with equations, figures and citations.',
  },
  {
    id: 'lit-review',
    label: '文献综述 / Literature review',
    description:
      '3 节骨架 + 2 个 claim 节点（一个已支持，一个故意留空让 maintenance scan 触发 finding） / 3-section skeleton with claim/evidence stubs.',
  },
] as const;

export function isDocTemplateId(value: unknown): value is DocTemplateId {
  return (
    typeof value === 'string' &&
    (DOC_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export interface PmDocJson {
  type: 'doc';
  content?: unknown[];
}

/**
 * Load the PM JSON for a template from disk. We resolve relative to the
 * Next.js process cwd because in dev/prod it is set to apps/web.
 */
export async function loadDocTemplate(id: DocTemplateId): Promise<PmDocJson> {
  const filename = `${id}.json`;
  const file = path.join(process.cwd(), 'public', 'templates', filename);
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { type?: unknown }).type !== 'doc'
  ) {
    throw new Error(`template ${id} is not a valid PM doc`);
  }
  return parsed as PmDocJson;
}
