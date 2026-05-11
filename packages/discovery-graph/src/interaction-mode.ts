// 6 InteractionMode taxonomy — Night-Bridge-Day Triadic Architecture
// (ADR-0020 §2.3). Source: jili's Night_Science_expanded.md "6 种交互模式".
//
// Each mode names a bidirectional information flow between layers. The
// "canonical direction" below is the most common producing → consuming
// direction; some modes (method-transfer) are intrinsically symmetric
// and flow either way.
//
// These are tags on cross-layer reference edges (see cross-layer-
// reference.ts), not workflow gates — anyone can flag any edge with
// the mode that best fits, retroactively, without changing the edge's
// semantics elsewhere.

export const INTERACTION_MODES = [
  'hypothesis-output', // Night → Bridge → Day (假设输出)
  'anomaly-input', // Day → Bridge → Night (反常输入)
  'constraint-transfer', // Day → Bridge → Night (约束传递)
  'metaphor-bridge', // Night → Bridge → Day (隐喻桥接)
  'question-return', // Day → Bridge → Night (问题回流)
  'method-transfer', // bidirectional (方法迁移)
] as const;

export type InteractionMode = (typeof INTERACTION_MODES)[number];

// Canonical "from" layer for each mode. method-transfer is intrinsically
// bidirectional so it maps to undefined (caller must record both ends).
export const INTERACTION_MODE_CANONICAL_FROM: Readonly<
  Record<InteractionMode, 'night' | 'bridge' | 'day' | undefined>
> = {
  'hypothesis-output': 'night',
  'anomaly-input': 'day',
  'constraint-transfer': 'day',
  'metaphor-bridge': 'night',
  'question-return': 'day',
  'method-transfer': undefined,
};

export const INTERACTION_MODE_CANONICAL_TO: Readonly<
  Record<InteractionMode, 'night' | 'bridge' | 'day' | undefined>
> = {
  'hypothesis-output': 'day',
  'anomaly-input': 'night',
  'constraint-transfer': 'night',
  'metaphor-bridge': 'day',
  'question-return': 'night',
  'method-transfer': undefined,
};

export const INTERACTION_MODE_LABELS_ZH: Readonly<Record<InteractionMode, string>> = {
  'hypothesis-output': '假设输出',
  'anomaly-input': '反常输入',
  'constraint-transfer': '约束传递',
  'metaphor-bridge': '隐喻桥接',
  'question-return': '问题回流',
  'method-transfer': '方法迁移',
};

export const INTERACTION_MODE_LABELS_EN: Readonly<Record<InteractionMode, string>> = {
  'hypothesis-output': 'Hypothesis Output',
  'anomaly-input': 'Anomaly Input',
  'constraint-transfer': 'Constraint Transfer',
  'metaphor-bridge': 'Metaphor Bridge',
  'question-return': 'Question Return',
  'method-transfer': 'Method Transfer',
};

const MODE_SET: ReadonlySet<string> = new Set<string>(INTERACTION_MODES);

export function isInteractionMode(value: unknown): value is InteractionMode {
  return typeof value === 'string' && MODE_SET.has(value);
}

export function parseInteractionMode(value: unknown): InteractionMode | null {
  return isInteractionMode(value) ? value : null;
}
