// Load skill metadata from skills/<id>/SKILL.md.
//
// SKILL.md format = YAML frontmatter + Markdown body. The frontmatter
// declares allowed MCP servers, required capabilities, and human-readable
// metadata. The whole file (frontmatter + body) is sha256'd and the digest
// becomes the immutable promptTemplate identifier — that's what
// Provenance writes (ADR-0001 §2.3.7 promptHash + promptTemplateId).
//
// Phase 1 D13 promotes this from proto-c verbatim and adds:
//   - in-memory cache keyed by absolute path + mtime hint
//   - structured error type so the agent runner can degrade gracefully

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export interface SkillMeta {
  skillId: string;
  name: string;
  description: string;
  allowedMcpServers: string[];
  requiredCapabilities: string[];
  bodyMarkdown: string;
  /** sha256 of the full SKILL.md (frontmatter + body) */
  promptHash: string;
  /** Stable id used in Provenance.agentContext.promptTemplateId */
  promptTemplateId: string;
  contentBytes: number;
}

export class SkillLoadError extends Error {
  override name = 'SkillLoadError';
  constructor(
    public readonly skillId: string,
    public readonly cause_: 'not-found' | 'malformed' | 'io',
    message: string,
  ) {
    super(message);
  }
}

interface CacheEntry {
  meta: SkillMeta;
  mtimeMs: number;
  contentBytes: number;
}

const cache = new Map<string, CacheEntry>();

export interface LoadSkillOptions {
  /** Disable in-process cache. Phase 1 default: enabled. */
  noCache?: boolean;
}

export async function loadSkill(
  skillsRoot: string,
  skillId: string,
  options: LoadSkillOptions = {},
): Promise<SkillMeta> {
  const filePath = path.resolve(skillsRoot, skillId, 'SKILL.md');
  const cacheKey = filePath;

  if (!options.noCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        const s = await stat(filePath);
        if (
          s.mtimeMs === cached.mtimeMs &&
          s.size === cached.contentBytes
        ) {
          return cached.meta;
        }
      } catch {
        // file gone → fall through to read
      }
    }
  }

  let raw: string;
  let mtimeMs: number;
  try {
    raw = await readFile(filePath, 'utf-8');
    mtimeMs = (await stat(filePath)).mtimeMs;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new SkillLoadError(skillId, 'not-found', `SKILL.md not found at ${filePath}`);
    }
    throw new SkillLoadError(skillId, 'io', String(err));
  }

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new SkillLoadError(
      skillId,
      'malformed',
      `SKILL.md missing YAML frontmatter at ${filePath}`,
    );
  }
  const frontmatterRaw = fmMatch[1] ?? '';
  const body = fmMatch[2] ?? '';

  const fm = parseSimpleYaml(frontmatterRaw);
  const name = stringField(fm, 'name', skillId);
  const description = stringField(fm, 'description', '');
  const allowedMcpServers = stringArrayField(fm, 'allowed_mcp_servers');
  const requiredCapabilities = stringArrayField(fm, 'required_capabilities');

  const promptHash = createHash('sha256').update(raw).digest('hex');
  const promptTemplateId = `${skillId}@${promptHash.slice(0, 12)}`;

  const meta: SkillMeta = {
    skillId,
    name,
    description,
    allowedMcpServers,
    requiredCapabilities,
    bodyMarkdown: body,
    promptHash,
    promptTemplateId,
    contentBytes: raw.length,
  };

  if (!options.noCache) {
    cache.set(cacheKey, { meta, mtimeMs, contentBytes: raw.length });
  }
  return meta;
}

/** Test helper: clear the in-process skills cache. */
export function _resetSkillCache(): void {
  cache.clear();
}

// ---------- Minimal YAML parser ----------

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
      const buf: string[] = [];
      i++;
      while (
        i < lines.length &&
        (lines[i] === '' || /^\s+/.test(lines[i] ?? ''))
      ) {
        const stripped = (lines[i] ?? '').replace(/^\s\s/, '');
        buf.push(stripped);
        i++;
      }
      out[key] = buf.join('\n').trim();
      continue;
    }
    if (after === '') {
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
