// TriadicMockup — Hero 右半。3 等权重 layer card (Night / Bridge / Day)
// + 2 个 interaction-mode 连接箭头 + 1 行 footer 提示。
//
// 视觉规则（Design.md §11 reject criteria 守护）：
//   - 3 card 完全等价（同字号 / 同 border / 同 padding）—— 物质化"三层等价"invariant
//   - 全方角 hairline border + paper-2 bg + 无 shadow（§11 #2 + #12）
//   - 箭头用 ascii `↓` glyph + 小字标签（不是 SVG icon，不是 emoji，§11 #4）
//   - layer 标签（NIGHT / BRIDGE / DAY）用 mono caps + accent-ink，不当 status pill
//
// 无 JS 交互。文案全走 locale 字典。

import type { LocaleDict } from '@/lib/i18n/types';

export function TriadicMockup({ t }: { t: LocaleDict }) {
  const m = t.landing.heroMockup;
  return (
    <div className="flex flex-col gap-2">
      <LayerCard
        label={m.nightLabel}
        body={m.nightBody}
        tag={m.nightTag}
      />
      <EdgeArrow label={m.edge1Label} mode={m.edge1Mode} />
      <LayerCard
        label={m.bridgeLabel}
        body={m.bridgeBody}
        tag={m.bridgeTag}
      />
      <EdgeArrow label={m.edge2Label} mode={m.edge2Mode} />
      <LayerCard
        label={m.dayLabel}
        body={m.dayBody}
        tag={m.dayTag}
      />
      <p
        className="mt-3 font-serif text-[12px] italic leading-[1.55]"
        style={{ color: 'var(--color-ink-3)' }}
        data-prose="bilingual"
      >
        {m.footerHint}
      </p>
    </div>
  );
}

function LayerCard({
  label,
  body,
  tag,
}: {
  label: string;
  body: string;
  tag: string;
}) {
  return (
    <article
      className="flex flex-col gap-2 px-4 py-3"
      style={{
        border: '1px solid var(--color-hairline)',
        background: 'var(--color-paper-2)',
      }}
    >
      <p
        className="font-mono text-[11px] uppercase tracking-wider"
        style={{ color: 'var(--color-accent-ink)' }}
      >
        {label}
      </p>
      <p
        className="font-serif text-[13px] leading-[1.55]"
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {body}
      </p>
      <p
        className="font-mono text-[11px]"
        style={{ color: 'var(--color-ink-3)' }}
      >
        — {tag}
      </p>
    </article>
  );
}

function EdgeArrow({ label, mode }: { label: string; mode: string }) {
  return (
    <div
      className="flex items-center gap-3 self-center font-mono text-[11px]"
      style={{ color: 'var(--color-ink-3)' }}
    >
      <span
        aria-hidden="true"
        style={{ color: 'var(--color-accent-ink)' }}
      >
        ↓
      </span>
      <span data-prose="bilingual">{label}</span>
      <span style={{ color: 'var(--color-ink-3)' }}>· {mode}</span>
    </div>
  );
}
