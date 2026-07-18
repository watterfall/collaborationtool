'use client';

// Night capture form — 6 kind 选择器 + 各 kind 专有字段（ADR-0021 A2.3）。
//
// 纯受控组件：收集输入 → buildNightDraft（pure）→ 交给 onCreate 落盘。
// 专有字段只暴露"捕捉起步态"最小集（per 7 原则 #2 不逼完整化）——
// question/thought-experiment 的丰富 lifecycle/outcomes 在编辑器/dogfood
// 中补，不在 capture 逼填。

import { useCallback, useMemo, useState } from 'react';

import {
  MODE_TAGS,
  MODE_TAG_LABELS_ZH,
  MODE_TAG_LABELS_EN,
  NIGHT_ARTIFACT_KINDS,
  NIGHT_ARTIFACT_KIND_LABELS_ZH,
  NIGHT_ARTIFACT_KIND_LABELS_EN,
  type ModeTag,
  type NightArtifactKind,
} from '@collaborationtool/discovery-graph';

import { buildNightDraft, type NightKindFields } from '@/lib/night-capture';
import { Button } from '@/components/design';

export interface NightCaptureCopy {
  thoughtTitle: string;
  thoughtBody: string;
  thoughtTags: string;
  create: string;
  creating: string;
  cancel: string;
  kindLabel: string;
  // Per-kind specific field labels (bilingual inline "zh / en").
  metaphorSource: string;
  metaphorTarget: string;
  metaphorMapping: string;
  sketchMedium: string;
  sketchContent: string;
  sketchCaption: string;
  contradictionType: string;
  contradictionPoleA: string;
  contradictionPoleB: string;
  contradictionSignificance: string;
  tePremise: string;
}

const SKETCH_MEDIA = [
  'svg',
  'raster-image',
  'whiteboard-photo',
  'tablet-handwritten',
  'ascii-diagram',
  'external-link',
] as const;

const CONTRADICTION_TYPES = [
  'data-vs-theory',
  'theory-vs-theory',
  'expert-vs-expert',
  'observation-vs-observation',
  'principle-vs-result',
] as const;

const inputStyle = {
  border: '1px solid var(--color-hairline)',
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
} as const;

export interface NightCaptureFormProps {
  copy: NightCaptureCopy;
  authorKey: string | null;
  creating: boolean;
  onCreate: (relativePath: string, content: string) => Promise<void>;
  onCancel: () => void;
}

export function NightCaptureForm({
  copy,
  authorKey,
  creating,
  onCreate,
  onCancel,
}: NightCaptureFormProps) {
  const [kind, setKind] = useState<NightArtifactKind>('thought');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<readonly ModeTag[]>([]);
  // Per-kind specific fields (only the active kind's are read).
  const [metaphorSource, setMetaphorSource] = useState('');
  const [metaphorTarget, setMetaphorTarget] = useState('');
  const [metaphorMapping, setMetaphorMapping] = useState('');
  const [sketchMedium, setSketchMedium] =
    useState<(typeof SKETCH_MEDIA)[number]>('ascii-diagram');
  const [sketchContent, setSketchContent] = useState('');
  const [sketchCaption, setSketchCaption] = useState('');
  const [contradictionType, setContradictionType] =
    useState<(typeof CONTRADICTION_TYPES)[number]>('data-vs-theory');
  const [poleA, setPoleA] = useState('');
  const [poleB, setPoleB] = useState('');
  const [significance, setSignificance] = useState('');
  const [premise, setPremise] = useState('');

  const toggleTag = useCallback((tag: ModeTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const fields = useMemo((): NightKindFields => {
    switch (kind) {
      case 'metaphor':
        return {
          kind,
          sourceDomain: metaphorSource,
          targetDomain: metaphorTarget,
          mappingDescription: metaphorMapping,
        };
      case 'sketch':
        return {
          kind,
          medium: sketchMedium,
          contentRef: sketchContent,
          caption: sketchCaption,
        };
      case 'contradiction':
        return {
          kind,
          contradictionType,
          poleA,
          poleB,
          significance,
        };
      case 'thought-experiment':
        return { kind, premise };
      default:
        return { kind };
    }
  }, [
    kind,
    metaphorSource,
    metaphorTarget,
    metaphorMapping,
    sketchMedium,
    sketchContent,
    sketchCaption,
    contradictionType,
    poleA,
    poleB,
    significance,
    premise,
  ]);

  const handleCreate = useCallback(async () => {
    if (title.trim() === '' || creating) return;
    const draft = buildNightDraft({
      title,
      bodyMarkdown: body,
      modeTags: tags,
      authorKey,
      nowIso: new Date().toISOString(),
      uuid: crypto.randomUUID(),
      fields,
    });
    await onCreate(draft.relativePath, draft.content);
  }, [title, body, tags, authorKey, fields, creating, onCreate]);

  return (
    <div className="mt-4 flex flex-col gap-3" data-night-form>
      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ink-2)' }}>
        {copy.kindLabel}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as NightArtifactKind)}
          className="px-2 py-1 text-sm"
          style={inputStyle}
        >
          {NIGHT_ARTIFACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {NIGHT_ARTIFACT_KIND_LABELS_ZH[k]} · {NIGHT_ARTIFACT_KIND_LABELS_EN[k]}
            </option>
          ))}
        </select>
      </label>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={copy.thoughtTitle}
        className="px-3 py-2 text-sm"
        style={inputStyle}
      />

      {kind === 'metaphor' && (
        <div className="flex flex-col gap-2">
          <input value={metaphorSource} onChange={(e) => setMetaphorSource(e.target.value)} placeholder={copy.metaphorSource} className="px-3 py-2 text-sm" style={inputStyle} />
          <input value={metaphorTarget} onChange={(e) => setMetaphorTarget(e.target.value)} placeholder={copy.metaphorTarget} className="px-3 py-2 text-sm" style={inputStyle} />
          <input value={metaphorMapping} onChange={(e) => setMetaphorMapping(e.target.value)} placeholder={copy.metaphorMapping} className="px-3 py-2 text-sm" style={inputStyle} />
        </div>
      )}

      {kind === 'sketch' && (
        <div className="flex flex-col gap-2">
          <select value={sketchMedium} onChange={(e) => setSketchMedium(e.target.value as (typeof SKETCH_MEDIA)[number])} className="px-2 py-1 text-sm" style={inputStyle} aria-label={copy.sketchMedium}>
            {SKETCH_MEDIA.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
          <input value={sketchContent} onChange={(e) => setSketchContent(e.target.value)} placeholder={copy.sketchContent} className="px-3 py-2 text-sm" style={inputStyle} />
          <input value={sketchCaption} onChange={(e) => setSketchCaption(e.target.value)} placeholder={copy.sketchCaption} className="px-3 py-2 text-sm" style={inputStyle} />
        </div>
      )}

      {kind === 'contradiction' && (
        <div className="flex flex-col gap-2">
          <select value={contradictionType} onChange={(e) => setContradictionType(e.target.value as (typeof CONTRADICTION_TYPES)[number])} className="px-2 py-1 text-sm" style={inputStyle} aria-label={copy.contradictionType}>
            {CONTRADICTION_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          <input value={poleA} onChange={(e) => setPoleA(e.target.value)} placeholder={copy.contradictionPoleA} className="px-3 py-2 text-sm" style={inputStyle} />
          <input value={poleB} onChange={(e) => setPoleB(e.target.value)} placeholder={copy.contradictionPoleB} className="px-3 py-2 text-sm" style={inputStyle} />
          <input value={significance} onChange={(e) => setSignificance(e.target.value)} placeholder={copy.contradictionSignificance} className="px-3 py-2 text-sm" style={inputStyle} />
        </div>
      )}

      {kind === 'thought-experiment' && (
        <input value={premise} onChange={(e) => setPremise(e.target.value)} placeholder={copy.tePremise} className="px-3 py-2 text-sm" style={inputStyle} />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={copy.thoughtBody}
        rows={4}
        className="px-3 py-2 text-sm"
        style={{ ...inputStyle, resize: 'vertical' }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--color-ink-3)' }}>{copy.thoughtTags}</span>
        {MODE_TAGS.map((tag) => (
          <Button
            key={tag}
            variant="ghost"
            size="sm"
            aria-pressed={tags.includes(tag)}
            onClick={() => toggleTag(tag)}
            style={tags.includes(tag) ? { background: 'var(--color-warm-wash)' } : undefined}
          >
            {MODE_TAG_LABELS_ZH[tag]} · {MODE_TAG_LABELS_EN[tag]}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void handleCreate()} disabled={creating || title.trim() === ''}>
          {creating ? copy.creating : copy.create}
        </Button>
        <Button variant="ghost" onClick={onCancel}>{copy.cancel}</Button>
      </div>
    </div>
  );
}
