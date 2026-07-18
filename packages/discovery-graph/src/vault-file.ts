// NightArtifact ↔ vault markdown file codec — ADR-0021 §2 vault-native 存储。
//
// Night artifact 是 `<vault>/night/<YYYY-MM-DD>-<slug>.md` 的人可读
// markdown 文件：`---` 围栏内是**约束文法** frontmatter（每行一条
// `key: value`，列表用逗号——不是完整 YAML，不引入解析依赖），正文即
// `bodyMarkdown`。codec 放在类型 SoT 旁边：字段漂移时这里 typecheck 报错。
//
// A2.3 全 6 kind 规则：
//   - 单 token 枚举与短标量 → 可读命名行（lifecycle / metaphor-source /
//     sketch-medium / contradiction-type / resolution-status …），值内
//     禁换行（serializer 抛错，capture UI 用单行输入）；
//   - 结构化 / 多行 prose 字段（poles / outcomes / resolution /
//     mappingDescription …）→ 单行 `data:` JSON（仍是 key: value 文法，
//     round-trip 无损）；
//   - 可选字段缺省不写行，round-trip deepEqual 成立。

import type { PrincipalId, IsoDateTime, ProvenanceId } from './_shared';
import type { VisibilityTier, ArtifactStatus } from './_shared';
import { isModeTag, type ModeTag } from './mode-tag';
import type { Thought } from './thought';
import type {
  Question,
  QuestionLifecycle,
  QuestionResolution,
} from './question';
import type { Metaphor } from './metaphor';
import type { Sketch, SketchMedium } from './sketch';
import type {
  Contradiction,
  ContradictionPole,
  ContradictionType,
  ContradictionResolutionStatus,
} from './contradiction';
import type {
  ThoughtExperiment,
  ThoughtExperimentOutcome,
} from './thought-experiment';
import {
  isNightArtifactKind,
  type NightArtifact,
} from './night-artifact';

export const NIGHT_DIR = 'night';

const VISIBILITIES: readonly string[] = [
  'private',
  'collaborator',
  'org',
  'public',
];
const STATUSES: readonly string[] = ['draft', 'active', 'archived', 'superseded'];
const LIFECYCLES: readonly string[] = ['open', 'contested', 'resolved', 'reopened'];
const SKETCH_MEDIA: readonly string[] = [
  'svg',
  'raster-image',
  'whiteboard-photo',
  'tablet-handwritten',
  'ascii-diagram',
  'external-link',
];
const CONTRADICTION_TYPES: readonly string[] = [
  'data-vs-theory',
  'theory-vs-theory',
  'expert-vs-expert',
  'observation-vs-observation',
  'principle-vs-result',
];
const RESOLUTION_STATUSES: readonly string[] = [
  'open',
  'partially-resolved',
  'resolved',
];

export interface ParsedNightArtifactFile {
  artifact: NightArtifact | null;
  errors: readonly string[];
}

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

// ---------------------------------------------------------------- serialize

function lineValue(key: string, value: string): string {
  if (value.includes('\n')) {
    throw new Error(
      `frontmatter line field "${key}" must be single-line / 命名行字段不允许换行`,
    );
  }
  return `${key}: ${value}`;
}

function kindLines(artifact: NightArtifact): string[] {
  const lines: string[] = [];
  const data: Record<string, unknown> = {};
  switch (artifact.kind) {
    case 'thought':
      if (artifact.seeAlso && artifact.seeAlso.length > 0) {
        lines.push(lineValue('see-also', artifact.seeAlso.join(', ')));
      }
      break;
    case 'question':
      lines.push(lineValue('lifecycle', artifact.lifecycle));
      if (artifact.parentQuestionId) {
        lines.push(lineValue('parent-question', artifact.parentQuestionId));
      }
      if (artifact.childQuestionIds && artifact.childQuestionIds.length > 0) {
        lines.push(
          lineValue('child-questions', artifact.childQuestionIds.join(', ')),
        );
      }
      if (artifact.resolution) data['resolution'] = artifact.resolution;
      if (artifact.reopenedAt && artifact.reopenedAt.length > 0) {
        data['reopenedAt'] = artifact.reopenedAt;
      }
      break;
    case 'metaphor':
      lines.push(lineValue('metaphor-source', artifact.sourceDomain));
      lines.push(lineValue('metaphor-target', artifact.targetDomain));
      data['mappingDescription'] = artifact.mappingDescription;
      if (artifact.knownDisanalogies !== undefined) {
        data['knownDisanalogies'] = artifact.knownDisanalogies;
      }
      break;
    case 'sketch':
      lines.push(lineValue('sketch-medium', artifact.medium));
      data['contentRef'] = artifact.contentRef;
      data['caption'] = artifact.caption;
      if (artifact.context !== undefined) data['context'] = artifact.context;
      break;
    case 'contradiction':
      lines.push(lineValue('contradiction-type', artifact.contradictionType));
      lines.push(lineValue('resolution-status', artifact.resolutionStatus));
      data['poleA'] = artifact.poleA;
      data['poleB'] = artifact.poleB;
      data['significance'] = artifact.significance;
      break;
    case 'thought-experiment':
      data['premise'] = artifact.premise;
      data['outcomes'] = artifact.outcomes;
      if (artifact.realWorldImplication !== undefined) {
        data['realWorldImplication'] = artifact.realWorldImplication;
      }
      if (artifact.empiricalFollowUp !== undefined) {
        data['empiricalFollowUp'] = artifact.empiricalFollowUp;
      }
      break;
  }
  if (Object.keys(data).length > 0) {
    lines.push(`data: ${JSON.stringify(data)}`);
  }
  return lines;
}

/** Serialize any Night artifact to on-disk vault file content. */
export function serializeNightArtifactVaultFile(
  artifact: NightArtifact,
): string {
  const lines: string[] = [
    '---',
    `night: ${artifact.kind}`,
    lineValue('id', artifact.id),
    lineValue('author', artifact.authorPrincipalId),
    lineValue('created', artifact.createdAt),
    lineValue('updated', artifact.updatedAt),
    lineValue('visibility', artifact.visibility),
    lineValue('status', artifact.status),
  ];
  if (artifact.modeTags.length > 0) {
    lines.push(lineValue('mode-tags', artifact.modeTags.join(', ')));
  }
  lines.push(...kindLines(artifact));
  lines.push(lineValue('provenance', artifact.provenanceId));
  lines.push(lineValue('title', artifact.title));
  lines.push('---');
  const body = artifact.bodyMarkdown;
  return `${lines.join('\n')}\n${body.length > 0 ? `\n${body}` : ''}`;
}

/** Back-compat wrapper（A2 切片 API）。 */
export function serializeThoughtVaultFile(thought: Thought): string {
  return serializeNightArtifactVaultFile(thought);
}

// ------------------------------------------------------------------- parse

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

function commaList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

interface KindContext {
  f: Map<string, string>;
  data: Record<string, unknown>;
  errors: string[];
}

function dataString(ctx: KindContext, key: string): string {
  const v = ctx.data[key];
  if (typeof v !== 'string') {
    ctx.errors.push(`data field "${key}" must be string / data 字段 "${key}" 须为字符串`);
    return '';
  }
  return v;
}

function optionalDataString(ctx: KindContext, key: string): string | undefined {
  const v = ctx.data[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') {
    ctx.errors.push(`data field "${key}" must be string / data 字段 "${key}" 须为字符串`);
    return undefined;
  }
  return v;
}

function parsePole(ctx: KindContext, key: string): ContradictionPole {
  const raw = ctx.data[key];
  if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>)['description'] !== 'string') {
    ctx.errors.push(`data field "${key}" must be a pole object / "${key}" 须为 pole 对象`);
    return { description: '' };
  }
  const rec = raw as Record<string, unknown>;
  const pole: ContradictionPole = { description: rec['description'] as string };
  if (Array.isArray(rec['supportingReferences'])) {
    return {
      ...pole,
      supportingReferences: (rec['supportingReferences'] as unknown[]).filter(
        (r): r is string => typeof r === 'string',
      ),
    };
  }
  return pole;
}

function requireLine(ctx: KindContext, key: string, allowed: readonly string[]): string {
  const v = ctx.f.get(key);
  if (v === undefined || v === '') {
    ctx.errors.push(`missing field "${key}" / 缺少字段 "${key}"`);
    return '';
  }
  if (!allowed.includes(v)) {
    ctx.errors.push(`invalid ${key} "${v}" / 非法 ${key}`);
    return '';
  }
  return v;
}

type KindSpecific =
  | Pick<Thought, 'kind' | 'seeAlso'>
  | Pick<Question, 'kind' | 'lifecycle' | 'parentQuestionId' | 'childQuestionIds' | 'resolution' | 'reopenedAt'>
  | Pick<Metaphor, 'kind' | 'sourceDomain' | 'targetDomain' | 'mappingDescription' | 'knownDisanalogies'>
  | Pick<Sketch, 'kind' | 'medium' | 'contentRef' | 'caption' | 'context'>
  | Pick<Contradiction, 'kind' | 'contradictionType' | 'poleA' | 'poleB' | 'significance' | 'resolutionStatus'>
  | Pick<ThoughtExperiment, 'kind' | 'premise' | 'outcomes' | 'realWorldImplication' | 'empiricalFollowUp'>;

function parseKindSpecific(kind: string, ctx: KindContext): KindSpecific | null {
  switch (kind) {
    case 'thought': {
      const seeAlso = commaList(ctx.f.get('see-also'));
      return seeAlso.length > 0
        ? { kind: 'thought', seeAlso }
        : { kind: 'thought' };
    }
    case 'question': {
      const lifecycle = requireLine(ctx, 'lifecycle', LIFECYCLES) as QuestionLifecycle;
      const out: Pick<Question, 'kind' | 'lifecycle' | 'parentQuestionId' | 'childQuestionIds' | 'resolution' | 'reopenedAt'> = {
        kind: 'question',
        lifecycle,
      };
      const parent = ctx.f.get('parent-question');
      const children = commaList(ctx.f.get('child-questions'));
      const resolution = ctx.data['resolution'];
      const reopened = ctx.data['reopenedAt'];
      return {
        ...out,
        ...(parent ? { parentQuestionId: parent } : {}),
        ...(children.length > 0 ? { childQuestionIds: children } : {}),
        ...(resolution && typeof resolution === 'object'
          ? { resolution: resolution as QuestionResolution }
          : {}),
        ...(Array.isArray(reopened)
          ? { reopenedAt: reopened as IsoDateTime[] }
          : {}),
      };
    }
    case 'metaphor': {
      const src = ctx.f.get('metaphor-source') ?? '';
      const tgt = ctx.f.get('metaphor-target') ?? '';
      if (!src) ctx.errors.push('missing field "metaphor-source" / 缺少字段 "metaphor-source"');
      if (!tgt) ctx.errors.push('missing field "metaphor-target" / 缺少字段 "metaphor-target"');
      const mapping = dataString(ctx, 'mappingDescription');
      const disanalogies = optionalDataString(ctx, 'knownDisanalogies');
      return {
        kind: 'metaphor',
        sourceDomain: src,
        targetDomain: tgt,
        mappingDescription: mapping,
        ...(disanalogies !== undefined ? { knownDisanalogies: disanalogies } : {}),
      };
    }
    case 'sketch': {
      const medium = requireLine(ctx, 'sketch-medium', SKETCH_MEDIA) as SketchMedium;
      const contentRef = dataString(ctx, 'contentRef');
      const caption = dataString(ctx, 'caption');
      const context = optionalDataString(ctx, 'context');
      return {
        kind: 'sketch',
        medium,
        contentRef,
        caption,
        ...(context !== undefined ? { context } : {}),
      };
    }
    case 'contradiction': {
      const cType = requireLine(ctx, 'contradiction-type', CONTRADICTION_TYPES) as ContradictionType;
      const rStatus = requireLine(ctx, 'resolution-status', RESOLUTION_STATUSES) as ContradictionResolutionStatus;
      return {
        kind: 'contradiction',
        contradictionType: cType,
        resolutionStatus: rStatus,
        poleA: parsePole(ctx, 'poleA'),
        poleB: parsePole(ctx, 'poleB'),
        significance: dataString(ctx, 'significance'),
      };
    }
    case 'thought-experiment': {
      const premise = dataString(ctx, 'premise');
      const rawOutcomes = ctx.data['outcomes'];
      const outcomes: ThoughtExperimentOutcome[] = [];
      if (Array.isArray(rawOutcomes)) {
        for (const o of rawOutcomes) {
          const rec = o as Record<string, unknown>;
          if (
            rec &&
            typeof rec['label'] === 'string' &&
            typeof rec['reasoning'] === 'string' &&
            typeof rec['interpretation'] === 'string'
          ) {
            outcomes.push({
              label: rec['label'],
              reasoning: rec['reasoning'],
              interpretation: rec['interpretation'],
            });
          } else {
            ctx.errors.push('invalid outcome entry / outcome 条目非法');
          }
        }
      } else if (rawOutcomes !== undefined) {
        ctx.errors.push('data field "outcomes" must be array / outcomes 须为数组');
      }
      const impl = optionalDataString(ctx, 'realWorldImplication');
      const followUp = optionalDataString(ctx, 'empiricalFollowUp');
      return {
        kind: 'thought-experiment',
        premise,
        outcomes,
        ...(impl !== undefined ? { realWorldImplication: impl } : {}),
        ...(followUp !== undefined ? { empiricalFollowUp: followUp } : {}),
      };
    }
    default:
      return null;
  }
}

/**
 * Parse vault file content back to a NightArtifact. Strict on enums and
 * required fields; returns errors instead of throwing so callers can
 * surface"这个文件不是合法 night artifact"而不是崩。
 */
export function parseNightArtifactVaultFile(
  content: string,
): ParsedNightArtifactFile {
  const errors: string[] = [];
  if (!content.startsWith('---\n')) {
    return { artifact: null, errors: ['missing frontmatter fence / 缺少 frontmatter 围栏'] };
  }
  const close = content.indexOf('\n---', 3);
  if (close < 0) {
    return { artifact: null, errors: ['unterminated frontmatter / frontmatter 未闭合'] };
  }
  const block = content.slice(4, close);
  const afterFence = content.indexOf('\n', close + 4);
  const rawBody = afterFence >= 0 ? content.slice(afterFence + 1) : '';
  const body = rawBody.startsWith('\n') ? rawBody.slice(1) : rawBody;

  const f = parseFields(block);
  const kind = f.get('night') ?? '';
  if (!isNightArtifactKind(kind)) {
    return {
      artifact: null,
      errors: [`unknown night kind "${kind}" / 未知 night kind`],
    };
  }

  let data: Record<string, unknown> = {};
  const rawData = f.get('data');
  if (rawData) {
    try {
      const parsed: unknown = JSON.parse(rawData);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      } else {
        errors.push('data line must be a JSON object / data 行须为 JSON 对象');
      }
    } catch {
      errors.push('data line is not valid JSON / data 行不是合法 JSON');
    }
  }

  const required = (key: string): string => {
    const v = f.get(key);
    if (v === undefined || v === '') {
      errors.push(`missing field "${key}" / 缺少字段 "${key}"`);
      return '';
    }
    return v;
  };

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
    for (const tag of commaList(rawTags)) {
      if (isModeTag(tag)) modeTags.push(tag);
      else errors.push(`invalid mode tag "${tag}" / 非法 mode tag`);
    }
  }

  const ctx: KindContext = { f, data, errors };
  const specific = parseKindSpecific(kind, ctx);

  if (errors.length > 0 || specific === null) {
    return { artifact: null, errors };
  }
  return {
    artifact: {
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
      ...specific,
    } as NightArtifact,
    errors: [],
  };
}

/** Back-compat wrapper（A2 切片 API）— 非 thought kind 一律拒绝。 */
export function parseThoughtVaultFile(content: string): ParsedThoughtFile {
  if (content.startsWith('---\n')) {
    const close = content.indexOf('\n---', 3);
    if (close >= 0) {
      const kind = parseFields(content.slice(4, close)).get('night');
      if (kind !== undefined && kind !== 'thought') {
        return {
          thought: null,
          errors: [`not a thought file (night != thought) / 不是 thought 文件`],
        };
      }
    }
  }
  const { artifact, errors } = parseNightArtifactVaultFile(content);
  if (artifact && artifact.kind === 'thought') {
    return { thought: artifact, errors };
  }
  return { thought: null, errors };
}
