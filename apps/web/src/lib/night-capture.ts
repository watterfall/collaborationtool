// Night thought capture — pure draft builder（ADR-0021 切片，Wave A2）。
//
// UI 收 title/body/modeTags，这里组装 Thought（id / provenance / 时间戳 /
// author 全部注入式——now 与 uuid 由调用方传入，保持纯函数可测），再经
// discovery-graph codec 序列化成 vault 文件内容。author 用 vault ed25519
// 公钥（`ed25519:<hex>`，vault-bridge readVaultPublicKey），无 identity 时
// `local:anonymous`（发布投影时才映射真 PrincipalId，见 ADR-0021 §5）。

import {
  buildNightFileName,
  serializeThoughtVaultFile,
  type Thought,
  type ModeTag,
  type PrincipalId,
  type IsoDateTime,
  type ProvenanceId,
} from '@collaborationtool/discovery-graph';

export const ANONYMOUS_AUTHOR = 'local:anonymous';

export interface ThoughtDraftInput {
  title: string;
  bodyMarkdown: string;
  modeTags: readonly ModeTag[];
  /** `ed25519:<hex>` from the vault identity, or null when absent. */
  authorKey: string | null;
  /** ISO timestamp — injected so the builder stays pure/testable. */
  nowIso: string;
  /** UUID — injected for the same reason. */
  uuid: string;
}

export interface ThoughtDraft {
  relativePath: string;
  content: string;
  thought: Thought;
}

export function buildThoughtDraft(input: ThoughtDraftInput): ThoughtDraft {
  const created = input.nowIso as IsoDateTime;
  const thought: Thought = {
    kind: 'thought',
    id: `night-thought-${input.uuid}`,
    authorPrincipalId: (input.authorKey ?? ANONYMOUS_AUTHOR) as PrincipalId,
    createdAt: created,
    updatedAt: created,
    visibility: 'private',
    status: 'active',
    provenanceId: `prov-local-${input.uuid}` as ProvenanceId,
    modeTags: [...input.modeTags],
    title: input.title.trim(),
    bodyMarkdown: input.bodyMarkdown,
  };
  return {
    relativePath: buildNightFileName(created, thought.title),
    content: serializeThoughtVaultFile(thought),
    thought,
  };
}
