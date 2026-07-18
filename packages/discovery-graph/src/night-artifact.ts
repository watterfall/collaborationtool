// Discriminated union of all 6 Night atomic unit types (ADR-0020 §2.1).
//
// Use this when handling Night artifacts polymorphically: fetching by
// id, rendering in a feed, exporting to JSON, etc. TypeScript narrows
// the union via the `kind` discriminator field.

import type { Thought } from './thought';
import type { Question } from './question';
import type { Metaphor } from './metaphor';
import type { Sketch } from './sketch';
import type { Contradiction } from './contradiction';
import type { ThoughtExperiment } from './thought-experiment';

export type NightArtifact =
  | Thought
  | Question
  | Metaphor
  | Sketch
  | Contradiction
  | ThoughtExperiment;

export type NightArtifactKind = NightArtifact['kind'];

export const NIGHT_ARTIFACT_KINDS: readonly NightArtifactKind[] = [
  'thought',
  'question',
  'metaphor',
  'sketch',
  'contradiction',
  'thought-experiment',
] as const;

const KIND_SET: ReadonlySet<string> = new Set<string>(NIGHT_ARTIFACT_KINDS);

// Display labels per language — used by UI surfaces (A2.3 capture UI;
// mirrors MODE_TAG_LABELS_* pattern so labels stay in the type SoT).
export const NIGHT_ARTIFACT_KIND_LABELS_ZH: Record<NightArtifactKind, string> = {
  thought: '思考',
  question: '问题',
  metaphor: '隐喻',
  sketch: '草图',
  contradiction: '矛盾',
  'thought-experiment': '思想实验',
};

export const NIGHT_ARTIFACT_KIND_LABELS_EN: Record<NightArtifactKind, string> = {
  thought: 'Thought',
  question: 'Question',
  metaphor: 'Metaphor',
  sketch: 'Sketch',
  contradiction: 'Contradiction',
  'thought-experiment': 'Thought experiment',
};

export function isNightArtifactKind(value: unknown): value is NightArtifactKind {
  return typeof value === 'string' && KIND_SET.has(value);
}

// Type narrowing helpers for downstream code.

export function isThought(artifact: NightArtifact): artifact is Thought {
  return artifact.kind === 'thought';
}

export function isQuestion(artifact: NightArtifact): artifact is Question {
  return artifact.kind === 'question';
}

export function isMetaphor(artifact: NightArtifact): artifact is Metaphor {
  return artifact.kind === 'metaphor';
}

export function isSketch(artifact: NightArtifact): artifact is Sketch {
  return artifact.kind === 'sketch';
}

export function isContradiction(artifact: NightArtifact): artifact is Contradiction {
  return artifact.kind === 'contradiction';
}

export function isThoughtExperiment(
  artifact: NightArtifact,
): artifact is ThoughtExperiment {
  return artifact.kind === 'thought-experiment';
}
