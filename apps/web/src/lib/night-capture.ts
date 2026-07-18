// Night artifact capture — pure draft builder（ADR-0021，A2.3 全 6 kind）。
//
// UI 收公共字段（title/body/modeTags）+ 各 kind 最小专有字段，这里组装
// NightArtifact（id / provenance / 时间戳 / author 全部注入式——now 与
// uuid 由调用方传入，保持纯函数可测），再经 discovery-graph codec 序列化
// 成 vault 文件内容。author 用 vault ed25519 公钥（`ed25519:<hex>`），无
// identity 时 `local:anonymous`（发布投影时才映射真 PrincipalId，ADR-0021 §5）。
//
// 捕捉语义 = 最小起步态：question 生成 lifecycle=open；contradiction
// resolutionStatus=open；thought-experiment outcomes=[]（分支后续在
// dogfood 中补——capture 不逼完整化，per 7 原则 #2 "警惕假设负债"）。

import {
  buildNightFileName,
  serializeNightArtifactVaultFile,
  type NightArtifact,
  type Thought,
  type ModeTag,
  type SketchMedium,
  type ContradictionType,
  type PrincipalId,
  type IsoDateTime,
  type ProvenanceId,
} from '@collaborationtool/discovery-graph';

export const ANONYMOUS_AUTHOR = 'local:anonymous';

export type NightKindFields =
  | { kind: 'thought' }
  | { kind: 'question' }
  | {
      kind: 'metaphor';
      sourceDomain: string;
      targetDomain: string;
      mappingDescription: string;
    }
  | { kind: 'sketch'; medium: SketchMedium; contentRef: string; caption: string }
  | {
      kind: 'contradiction';
      contradictionType: ContradictionType;
      poleA: string;
      poleB: string;
      significance: string;
    }
  | { kind: 'thought-experiment'; premise: string };

export interface NightDraftInput {
  title: string;
  bodyMarkdown: string;
  modeTags: readonly ModeTag[];
  /** `ed25519:<hex>` from the vault identity, or null when absent. */
  authorKey: string | null;
  /** ISO timestamp — injected so the builder stays pure/testable. */
  nowIso: string;
  /** UUID — injected for the same reason. */
  uuid: string;
  fields: NightKindFields;
}

export interface NightDraft {
  relativePath: string;
  content: string;
  artifact: NightArtifact;
}

export function buildNightDraft(input: NightDraftInput): NightDraft {
  const created = input.nowIso as IsoDateTime;
  const base = {
    id: `night-${input.fields.kind}-${input.uuid}`,
    authorPrincipalId: (input.authorKey ?? ANONYMOUS_AUTHOR) as PrincipalId,
    createdAt: created,
    updatedAt: created,
    visibility: 'private' as const,
    status: 'active' as const,
    provenanceId: `prov-local-${input.uuid}` as ProvenanceId,
    modeTags: [...input.modeTags],
    title: input.title.trim(),
    bodyMarkdown: input.bodyMarkdown,
  };

  let artifact: NightArtifact;
  const f = input.fields;
  switch (f.kind) {
    case 'thought':
      artifact = { ...base, kind: 'thought' };
      break;
    case 'question':
      artifact = { ...base, kind: 'question', lifecycle: 'open' };
      break;
    case 'metaphor':
      artifact = {
        ...base,
        kind: 'metaphor',
        sourceDomain: f.sourceDomain.trim(),
        targetDomain: f.targetDomain.trim(),
        mappingDescription: f.mappingDescription,
      };
      break;
    case 'sketch':
      artifact = {
        ...base,
        kind: 'sketch',
        medium: f.medium,
        contentRef: f.contentRef.trim(),
        caption: f.caption.trim(),
      };
      break;
    case 'contradiction':
      artifact = {
        ...base,
        kind: 'contradiction',
        contradictionType: f.contradictionType,
        poleA: { description: f.poleA },
        poleB: { description: f.poleB },
        significance: f.significance,
        resolutionStatus: 'open',
      };
      break;
    case 'thought-experiment':
      artifact = {
        ...base,
        kind: 'thought-experiment',
        premise: f.premise,
        outcomes: [],
      };
      break;
  }

  return {
    relativePath: buildNightFileName(created, artifact.title),
    content: serializeNightArtifactVaultFile(artifact),
    artifact,
  };
}

// ---- Back-compat wrapper（A2 切片 API；night-capture.test.ts 契约） ----

export interface ThoughtDraftInput {
  title: string;
  bodyMarkdown: string;
  modeTags: readonly ModeTag[];
  authorKey: string | null;
  nowIso: string;
  uuid: string;
}

export interface ThoughtDraft {
  relativePath: string;
  content: string;
  thought: Thought;
}

export function buildThoughtDraft(input: ThoughtDraftInput): ThoughtDraft {
  const draft = buildNightDraft({ ...input, fields: { kind: 'thought' } });
  return {
    relativePath: draft.relativePath,
    content: draft.content,
    thought: draft.artifact as Thought,
  };
}
