// Load skill metadata from skills/<id>/SKILL.md.
// Parses YAML frontmatter (between leading --- markers) without yanking
// in a YAML dependency — the schema is small and deterministic.

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export interface SkillMeta {
  skillId: string;
  name: string;
  description: string;
  allowedMcpServers: string[];
  requiredCapabilities: string[];
  bodyMarkdown: string;
  promptHash: string;     // sha256 of the skill body — used as promptTemplateId
  contentBytes: number;
}

export async function loadSkill(skillsRoot: string, skillId: string): Promise<SkillMeta> {
  const filePath = path.join(skillsRoot, skillId, 'SKILL.md');
  const raw = await readFile(filePath, 'utf-8');

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error(`SKILL.md missing YAML frontmatter at ${filePath}`);
  }
  const [, frontmatterRaw, body] = fmMatch as unknown as [string, string, string];

  const fm = parseSimpleYaml(frontmatterRaw);
  const name = stringField(fm, 'name', skillId);
  const description = stringField(fm, 'description', '');
  const allowedMcpServers = stringArrayField(fm, 'allowed_mcp_servers');
  const requiredCapabilities = stringArrayField(fm, 'required_capabilities');

  const promptHash = createHash('sha256').update(raw).digest('hex');

  return {
    skillId,
    name,
    description,
    allowedMcpServers,
    requiredCapabilities,
    bodyMarkdown: body,
    promptHash,
    contentBytes: raw.length,
  };
}

// A deliberately minimal YAML parser:
// - keys at column 0 with `:` separator
// - values can be scalars (string), block scalars `key: |`, or `- item` lists
// - sufficient for SKILL.md frontmatter; not a general YAML
type YamlValue = string | string[];
type YamlMap = Record<string, YamlValue>;

function parseSimpleYaml(text: string): YamlMap {
  const out: YamlMap = {};
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1] as string;
    const after = (m[2] ?? '').trim();
    if (after === '|' || after === '|-') {
      // Block scalar; read indented continuation
      const buf: string[] = [];
      i++;
      while (i < lines.length && (lines[i] === '' || /^\s+/.test(lines[i] ?? ''))) {
        const stripped = (lines[i] ?? '').replace(/^\s\s/, '');
        buf.push(stripped);
        i++;
      }
      out[key] = buf.join('\n').trim();
      continue;
    }
    if (after === '') {
      // Block: either a list of `- item` lines or nested map (we only handle list)
      const items: string[] = [];
      i++;
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const lm = cur.match(/^\s+-\s+(.*)$/);
        if (!lm) break;
        items.push((lm[1] as string).trim());
        i++;
      }
      out[key] = items;
      continue;
    }
    // Scalar value
    out[key] = unquote(after);
    i++;
  }
  return out;
}

function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

function stringField(m: YamlMap, key: string, dflt: string): string {
  const v = m[key];
  if (typeof v === 'string') return v;
  return dflt;
}

function stringArrayField(m: YamlMap, key: string): string[] {
  const v = m[key];
  if (Array.isArray(v)) return v;
  return [];
}
