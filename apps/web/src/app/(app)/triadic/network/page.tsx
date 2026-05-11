// Wave D-4 — /triadic/network (Connector role surface).
//
// Skeleton: the 6 InteractionMode flows visualized as a hairline table
// (Night ↔ Bridge ↔ Day). When Wave D-5 dogfood wires real
// CrossLayerReference rows in, we replace the per-row counts of `—`
// with `countReferencesByMode()` totals.
//
// Connector is the "broker" role (Burt structural holes) — this surface
// is for users whose value is *crossing* cluster boundaries, not
// producing artifacts within one layer.

import {
  INTERACTION_MODES,
  INTERACTION_MODE_CANONICAL_FROM,
  INTERACTION_MODE_CANONICAL_TO,
  INTERACTION_MODE_LABELS_ZH,
  INTERACTION_MODE_LABELS_EN,
} from '@collaborationtool/discovery-graph';

import { HairlineRule, MonoDisc, StatusPill } from '@/components/design';

function fmtLayer(layer: 'night' | 'bridge' | 'day' | undefined): string {
  if (!layer) return '↔ any';
  return layer.charAt(0).toUpperCase() + layer.slice(1);
}

export default function NetworkPage() {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex items-baseline gap-3">
        <MonoDisc kind="agent" monogram="C" size="md" />
        <h2
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '30px',
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
          }}
        >
          <span lang="zh">跨层联通</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Cross-layer Network
          </span>
        </h2>
        <StatusPill
          status="proposed"
          label="Wave D-4 骨架"
          labelEn="Wave D-4 skeleton"
          className="ml-auto"
        />
      </header>

      <p
        className="font-serif"
        style={{
          color: 'var(--color-ink-2)',
          fontSize: '17px',
          lineHeight: 1.78,
        }}
        lang="zh"
      >
        6 种双向交互流 —— 不是 workflow gate，是 reference edge 上的 tag。每条 Night→Bridge / Bridge→Day / 反向跨层引用都打一个 mode tag。Connector 角色看的是这张图本身。
      </p>
      <p
        className="font-serif"
        style={{
          color: 'var(--color-ink-3)',
          fontSize: '15px',
          lineHeight: 1.7,
          fontStyle: 'italic',
        }}
        lang="en"
      >
        Six bidirectional interaction flows — not workflow gates, just tags
        on reference edges. Every Night→Bridge / Bridge→Day / reverse
        cross-layer reference carries one mode tag. The Connector role
        watches this graph itself.
      </p>

      <HairlineRule />

      <section
        aria-labelledby="modes-heading"
        className="flex flex-col gap-3"
      >
        <h3
          id="modes-heading"
          className="font-sans uppercase"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          <span lang="zh">六种交互流</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Six interaction modes</span>
        </h3>
        <ul className="flex flex-col">
          {INTERACTION_MODES.map((m, idx) => {
            const from = INTERACTION_MODE_CANONICAL_FROM[m];
            const to = INTERACTION_MODE_CANONICAL_TO[m];
            const bidirectional = from === undefined && to === undefined;
            return (
              <li
                key={m}
                className="flex items-baseline gap-3 py-3"
                style={{
                  borderTop:
                    idx === 0 ? '1px solid var(--color-hairline)' : 'none',
                  borderBottom: '1px solid var(--color-hairline)',
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    color: 'var(--color-ink-3)',
                    fontSize: '11px',
                    width: '2.5rem',
                    fontFeatureSettings: "'onum' 1",
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span
                  className="font-serif"
                  style={{ color: 'var(--color-ink)', fontSize: '17px' }}
                  lang="zh"
                >
                  {INTERACTION_MODE_LABELS_ZH[m]}
                </span>
                <span
                  className="font-serif"
                  style={{
                    color: 'var(--color-ink-2)',
                    fontSize: '15px',
                    fontStyle: 'italic',
                  }}
                  lang="en"
                >
                  {INTERACTION_MODE_LABELS_EN[m]}
                </span>
                <span
                  className="font-mono ml-auto"
                  style={{
                    color: bidirectional
                      ? 'var(--color-accent-ink)'
                      : 'var(--color-ink-3)',
                    fontSize: '11px',
                  }}
                >
                  {bidirectional
                    ? '↔ method-transfer 双向'
                    : `${fmtLayer(from)} → ${fmtLayer(to)}`}
                </span>
                <span
                  className="font-mono"
                  style={{
                    color: 'var(--color-ink-3)',
                    fontSize: '11px',
                    width: '3rem',
                    textAlign: 'right',
                    fontFeatureSettings: "'onum' 1",
                  }}
                  title="counts populate at Wave D-5 dogfood gate"
                >
                  —
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <HairlineRule />

      <section
        aria-labelledby="dogfood-heading"
        className="flex flex-col gap-3"
      >
        <h3
          id="dogfood-heading"
          className="font-sans uppercase"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          <span lang="zh">Wave D-5 dogfood 验收指标</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Wave D-5 dogfood acceptance</span>
        </h3>
        <p
          className="font-serif"
          style={{
            color: 'var(--color-ink-2)',
            fontSize: '15px',
            lineHeight: 1.7,
          }}
          lang="zh"
        >
          jili 30 天内 ≥ 4 种交互流被触发（6 种里至少 4 种留下真实 reference edge）。
          单一交互流（如全是 metaphor-bridge）= 三层未真打通，pivot 失败。
        </p>
        <p
          className="font-serif"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '13px',
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}
          lang="en"
        >
          jili must trigger ≥ 4 of 6 modes within 30 days (real reference
          edges). A single dominant mode (e.g. all metaphor-bridge) means
          the three layers haven&rsquo;t actually connected — pivot fails.
        </p>
      </section>
    </article>
  );
}
