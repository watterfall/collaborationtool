'use client';

import { useState } from 'react';

interface ProposalFragment {
  originalText: string;
  replacementText: string;
  citationId?: string;
  citationCslJson?: Record<string, unknown>;
}

interface ProposalSummary {
  proposalRationale: string;
  revisedFragments: ProposalFragment[];
  uncertainties: string[];
  toolCalls: Array<{ toolName: string; mcpServerId: string; succeeded: boolean }>;
}

interface InvokeResponse {
  proposal: ProposalSummary;
  revisionId?: string;
  provenanceId?: string;
}

export interface AgentPanelProps {
  documentId: string;
  /** Block under cursor — for Phase 1 a single block scope. */
  blockId: string;
  /** Default passage. Phase 1 sources from current selection; UI lets user override. */
  defaultPassage?: string;
}

export default function AgentPanel({
  documentId,
  blockId,
  defaultPassage = '',
}: AgentPanelProps) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState(defaultPassage);
  const [dois, setDois] = useState('');
  const [instruction, setInstruction] = useState('make this more formal');
  const [pending, setPending] = useState<'citation' | 'inline-editor' | null>(null);
  const [result, setResult] = useState<InvokeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invoke(kind: 'citation' | 'inline-editor') {
    setPending(kind);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/agent/invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          documentId,
          blockId,
          passage,
          ...(kind === 'citation'
            ? {
                flaggedDoiCandidates: dois
                  .split(/[,\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : { userInstruction: instruction }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult((await res.json()) as InvokeResponse);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="my-4 rounded-md border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-zinc-50"
      >
        {open ? '关闭 AI 面板 / Hide AI panel' : 'AI 协作 / AI agent panel'}
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-200 px-4 py-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-700">段落 / Passage</span>
            <textarea
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              rows={4}
              className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs focus:border-zinc-900 focus:outline-none"
              placeholder="把要让 agent 处理的段落粘贴到这里"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Citation */}
            <div className="rounded-md border border-zinc-200 p-3">
              <h4 className="font-medium">Citation Agent</h4>
              <p className="mt-1 text-xs text-zinc-500">
                校验 DOI；命中 mock fixture 即可，无网亦可跑。
              </p>
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-xs text-zinc-700">DOI 候选（逗号或换行分隔）</span>
                <textarea
                  value={dois}
                  onChange={(e) => setDois(e.target.value)}
                  rows={2}
                  className="rounded-md border border-zinc-300 px-2 py-1 font-mono text-xs focus:border-zinc-900 focus:outline-none"
                  placeholder="10.1145/3531146.3533104"
                />
              </label>
              <button
                type="button"
                onClick={() => void invoke('citation')}
                disabled={pending !== null}
                className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {pending === 'citation' ? '处理中…' : '调用 Citation Agent'}
              </button>
            </div>

            {/* Inline editor */}
            <div className="rounded-md border border-zinc-200 p-3">
              <h4 className="font-medium">Inline Editor Agent</h4>
              <p className="mt-1 text-xs text-zinc-500">
                按指令重写段落（保留引用 / 公式 / 注释锚点）。
              </p>
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-xs text-zinc-700">重写指令</span>
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => void invoke('inline-editor')}
                disabled={pending !== null}
                className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {pending === 'inline-editor' ? '处理中…' : '调用 Inline Editor Agent'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
              <div>
                <strong>Proposal rationale:</strong>{' '}
                <span className="text-zinc-700">
                  {result.proposal.proposalRationale}
                </span>
              </div>
              {result.revisionId && (
                <div>
                  <strong>Revision id:</strong>{' '}
                  <code className="text-[10px]">{result.revisionId}</code>
                </div>
              )}
              {result.proposal.revisedFragments.length > 0 && (
                <div>
                  <strong>Fragments ({result.proposal.revisedFragments.length}):</strong>
                  <ul className="ml-4 list-disc">
                    {result.proposal.revisedFragments.map((f, i) => (
                      <li key={i} className="my-1">
                        <div className="font-mono text-[11px]">
                          <span className="text-red-700">- {f.originalText}</span>
                          <br />
                          <span className="text-green-700">+ {f.replacementText}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.proposal.uncertainties.length > 0 && (
                <div>
                  <strong>Uncertainties:</strong>
                  <ul className="ml-4 list-disc">
                    {result.proposal.uncertainties.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.proposal.toolCalls.length > 0 && (
                <div>
                  <strong>Tool calls:</strong>{' '}
                  {result.proposal.toolCalls
                    .map(
                      (t) =>
                        `${t.toolName}@${t.mcpServerId}${t.succeeded ? '' : '✗'}`,
                    )
                    .join(', ')}
                </div>
              )}
              <p className="mt-2 text-zinc-500">
                Phase 1 D13 — proposal 已写入 PG (status='proposed')；D14 加入接受 /
                拒绝 UI 后这里会有相应按钮。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
