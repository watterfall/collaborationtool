// 5 创意触发模式 — ADR-0020 §2.2 schema tag taxonomy.
// Source: jili's 5 night-science cases catalogue
// (/Users/jili/project/nightscience/Night_Science_Cases_Revised.md).
//
// Tags are 0-N per artifact. They are NOT a forced workflow — multiple
// tags can coexist, none-tagged is valid. The taxonomy enables
// search / recommendation / cross-case discovery, not enforcement.
// (Per Feyerabend "anything goes" and plan §F.5 trap 4 "过度结构化
//  method 阻止 anomaly-driven discovery".)

export type ModeTag =
  | 'metaphor' // 模式 A — 隐喻重塑 (相分离液滴 / 红皇后假说 / 系统一&二)
  | 'contradiction' // 模式 B — 矛盾触发 (Griffith 转化 / 端粒 / 跳跃基因)
  | 'reframe' // 模式 C — 重新提问 (Curie 镭 / iPSC / 图灵测试)
  | 'cross-domain' // 模式 D — 跨界嫁接 (信息论 / AlphaFold / CRISPR)
  | 'thought-experiment'; // 模式 E — 思想实验 (薛定谔猫 / EPR / 全息原理)

export const MODE_TAGS: readonly ModeTag[] = [
  'metaphor',
  'contradiction',
  'reframe',
  'cross-domain',
  'thought-experiment',
] as const;

const MODE_TAG_SET: ReadonlySet<string> = new Set<string>(MODE_TAGS);

export function isModeTag(value: unknown): value is ModeTag {
  return typeof value === 'string' && MODE_TAG_SET.has(value);
}

export function parseModeTag(value: string): ModeTag | null {
  return isModeTag(value) ? value : null;
}

// Anti-abuse: limit number of tags per artifact to prevent users
// from labelling everything as "all modes" (per Iteration 4 risk R-T5).
// Default 3; configurable per deploy if dogfood reveals a different sweet spot.
export const MAX_TAGS_PER_ARTIFACT = 3;

export type ModeTagValidationResult =
  | { valid: true; tags: ModeTag[] }
  | { valid: false; reason: string };

export function validateModeTags(
  tags: readonly string[],
  maxTags: number = MAX_TAGS_PER_ARTIFACT,
): ModeTagValidationResult {
  if (tags.length === 0) {
    // Allow zero tags — not every artifact needs a creative-mode label.
    return { valid: true, tags: [] };
  }
  if (tags.length > maxTags) {
    return {
      valid: false,
      reason: `too-many-tags: ${tags.length} > max ${maxTags}`,
    };
  }
  const parsed: ModeTag[] = [];
  const seen = new Set<ModeTag>();
  for (const raw of tags) {
    const tag = parseModeTag(raw);
    if (tag === null) {
      return { valid: false, reason: `invalid-mode-tag: ${raw}` };
    }
    if (seen.has(tag)) {
      return { valid: false, reason: `duplicate-tag: ${tag}` };
    }
    seen.add(tag);
    parsed.push(tag);
  }
  return { valid: true, tags: parsed };
}

// Display labels per language — used by UI surfaces (Wave D-4).
export const MODE_TAG_LABELS_ZH: Record<ModeTag, string> = {
  metaphor: '隐喻重塑',
  contradiction: '矛盾触发',
  reframe: '重新提问',
  'cross-domain': '跨界嫁接',
  'thought-experiment': '思想实验',
};

export const MODE_TAG_LABELS_EN: Record<ModeTag, string> = {
  metaphor: 'Metaphor Reframe',
  contradiction: 'Contradiction Trigger',
  reframe: 'Reframe Question',
  'cross-domain': 'Cross-Domain Graft',
  'thought-experiment': 'Thought Experiment',
};
