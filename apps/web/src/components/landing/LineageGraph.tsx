// LineageGraph — replaces /demo/landing-specimen-lineage.svg.
//
// 关键架构：SVG container（用 SVG 做几何 + 边 + 时间轴）+ `<foreignObject>`
// 包 HTML/Tailwind 节点内容（用 HTML 拿真 Source Han Serif CJK kerning +
// 真 .label-cap 设计系统 token）。两全其美：
//   - SVG: 列 tint / 时间轴 / 列头 / curved edge / arrow polygon
//   - HTML inside foreignObject: 节点 typography（CJK 渲染、kerning）
//
// 显示 1 篇论文的 lineage：
//   5 Night artifact (contradiction / metaphor / question / thought-experiment / constraint)
//   3 Bridge artifact (toy-model / analogy-mapping / design-fiction[ORPHAN])
//   2 Day artifact (manuscript / code-supplement)
//   6 种 InteractionMode 全展示
//   Author contribution bars (accent-ox = jili+alice, accent-moss = bob+moss)
//   Orphan node 用 dashed border 显式区分

import * as React from 'react';

const VIEW_W = 1200;
const VIEW_H = 600;

const NIGHT_X = 40;
const BRIDGE_X = 440;
const DAY_X = 840;
const COL_W = 320;

// Node row positions (top y)
const NIGHT_YS = [100, 180, 260, 340, 420] as const;
const BRIDGE_YS = [180, 290, 390] as const;
const DAY_YS = [220, 340] as const;

export function LineageGraph() {
  return (
    <article
      className="relative w-full"
      style={{
        border: '1px solid var(--color-ink)',
        background: 'var(--color-paper)',
      }}
      aria-label="一篇论文的 lineage 图：5 想法 + 3 原型 + 2 day artifact + 6 种 interaction-mode"
    >
      <div className="px-8 py-8">
        <p className="label-cap">VOL. III · 三层 LINEAGE</p>
        <h3
          className="mt-3 font-serif text-3xl font-medium leading-[1.15]"
          style={{ color: 'var(--color-ink)' }}
          data-prose="bilingual"
        >
          一篇论文的祖先图谱
        </h3>
        <p
          className="mt-2 font-serif text-base italic"
          style={{ color: 'var(--color-ink-2)' }}
          data-prose="bilingual"
        >
          2 个月 · 5 想法 + 3 原型（含 1 orphan）+ 2 day artifact · 6 种 interaction-mode
        </p>
        <hr className="rule my-5" />

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block w-full"
          role="img"
          aria-label="lineage diagram"
        >
          {/* column tint regions */}
          <rect
            x="0"
            y="0"
            width="400"
            height={VIEW_H}
            fill="var(--color-paper-2)"
            opacity="0.55"
          />
          <rect
            x="800"
            y="0"
            width="400"
            height={VIEW_H}
            fill="var(--color-paper-2)"
            opacity="0.55"
          />

          {/* time axis */}
          <line
            x1="60"
            y1="34"
            x2="1140"
            y2="34"
            stroke="var(--color-hairline)"
            strokeWidth="0.6"
            strokeDasharray="2,3"
          />
          <text
            x="80"
            y="24"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill="var(--color-ink-3)"
          >
            2026-03
          </text>
          <text
            x="500"
            y="24"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill="var(--color-ink-3)"
          >
            2026-04
          </text>
          <text
            x="950"
            y="24"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill="var(--color-ink-3)"
          >
            2026-05
          </text>

          {/* column headers */}
          <text
            x="200"
            y="62"
            fontSize="12"
            fontFamily="ui-monospace, monospace"
            fill="var(--color-accent-ink)"
            letterSpacing="3"
            textAnchor="middle"
          >
            NIGHT · 想点子
          </text>
          <text
            x="600"
            y="62"
            fontSize="12"
            fontFamily="ui-monospace, monospace"
            fill="var(--color-accent-ink)"
            letterSpacing="3"
            textAnchor="middle"
          >
            BRIDGE · 做原型
          </text>
          <text
            x="1000"
            y="62"
            fontSize="12"
            fontFamily="ui-monospace, monospace"
            fill="var(--color-accent-ink)"
            letterSpacing="3"
            textAnchor="middle"
          >
            DAY · 论文
          </text>
          <line
            x1="60"
            y1="78"
            x2="1140"
            y2="78"
            stroke="var(--color-ink)"
            strokeWidth="0.8"
          />

          {/* column dividers */}
          <line
            x1="400"
            y1="84"
            x2="400"
            y2={VIEW_H - 80}
            stroke="var(--color-hairline)"
            strokeWidth="0.5"
            strokeDasharray="3,4"
          />
          <line
            x1="800"
            y1="84"
            x2="800"
            y2={VIEW_H - 80}
            stroke="var(--color-hairline)"
            strokeWidth="0.5"
            strokeDasharray="3,4"
          />

          {/* ===== Nodes (Night) ===== */}
          <Node x={NIGHT_X} y={NIGHT_YS[0]} h={70}>
            <NodeCard
              label="CONTRADICTION"
              body="0.8% < 1% 理论极限：理论错了？"
              author="jili · 03-12"
              authorAccent="ox"
            />
          </Node>
          <Node x={NIGHT_X} y={NIGHT_YS[1]} h={70}>
            <NodeCard
              label="METAPHOR"
              body={<em>错误率像血压 — device-dependent</em>}
              author="alice · 03-15"
              authorAccent="ox"
            />
          </Node>
          <Node x={NIGHT_X} y={NIGHT_YS[2]} h={70}>
            <NodeCard
              label="QUESTION"
              body="T₁ / 串扰 / 温漂 哪个主导？"
              author="jili · 03-18"
              authorAccent="ox"
            />
          </Node>
          <Node x={NIGHT_X} y={NIGHT_YS[3]} h={70}>
            <NodeCard
              label="THOUGHT-EXPERIMENT"
              body={<em>理想极限设备：会出现什么？</em>}
              author="bob · 03-22"
              authorAccent="moss"
            />
          </Node>
          <Node x={NIGHT_X} y={NIGHT_YS[4]} h={70}>
            <NodeCard
              label="CONSTRAINT"
              body="Shor 1995 阈值定理（物理边界）"
              author="moss · 04-03"
              authorAccent="moss"
            />
          </Node>

          {/* ===== Nodes (Bridge) ===== */}
          <Node x={BRIDGE_X} y={BRIDGE_YS[0]} h={85} emphasis>
            <NodeCard
              label="TOY-MODEL · HYPOTHESIS-SKETCH"
              title="device-dependent error"
              body={
                <span className="font-mono text-[11px]">
                  err(t,d) = α·T₁⁻¹ + β·xtalk + γ·drift
                </span>
              }
              author="jili + alice · 04-08"
              authorAccent="ox"
            />
          </Node>
          <Node x={BRIDGE_X} y={BRIDGE_YS[1]} h={70}>
            <NodeCard
              label="ANALOGY-MAPPING"
              body={<em>血压 homeostasis → QEC 反馈</em>}
              author="alice · 04-12"
              authorAccent="ox"
            />
          </Node>
          <Node x={BRIDGE_X} y={BRIDGE_YS[2]} h={85} orphan>
            <NodeCard
              label="DESIGN-FICTION · ORPHAN"
              body={
                <>
                  <em>理想 QEC 设备 spec book</em>
                  <br />
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: 'var(--color-ink-3)' }}
                  >
                    ↓ 没进论文 · 单独 archive · still citable
                  </span>
                </>
              }
              author="bob · 04-15"
              authorAccent="moss"
              dim
            />
          </Node>

          {/* ===== Nodes (Day) ===== */}
          <Node x={DAY_X} y={DAY_YS[0]} h={85} emphasis>
            <NodeCard
              label="MANUSCRIPT"
              title="device-dependent error model"
              body={
                <span
                  className="font-mono text-[11px]"
                  style={{ color: 'var(--color-ink-3)' }}
                >
                  arXiv:2605.xxxxx · in review
                </span>
              }
              author="jili + alice + moss · 05-08"
              authorAccent="multi"
            />
          </Node>
          <Node x={DAY_X} y={DAY_YS[1]} h={70}>
            <NodeCard
              label="CODE · SUPPLEMENT"
              body="github.com/qec/toy-model"
              author="alice · 05-10 · MIT"
              authorAccent="ox"
            />
          </Node>

          {/* ===== Edges ===== */}
          <Edge
            from={[NIGHT_X + COL_W, NIGHT_YS[0] + 35]}
            to={[BRIDGE_X, BRIDGE_YS[0] + 20]}
            label="anomaly-input"
            labelX={395}
            labelY={130}
          />
          <Edge
            from={[NIGHT_X + COL_W, NIGHT_YS[1] + 35]}
            to={[BRIDGE_X, BRIDGE_YS[1] + 20]}
            label="metaphor-bridge"
            labelX={395}
            labelY={250}
          />
          <Edge
            from={[NIGHT_X + COL_W, NIGHT_YS[2] + 35]}
            to={[BRIDGE_X, BRIDGE_YS[0] + 55]}
            label="question-return"
            labelX={395}
            labelY={310}
          />
          <Edge
            from={[NIGHT_X + COL_W, NIGHT_YS[3] + 35]}
            to={[BRIDGE_X, BRIDGE_YS[2] + 30]}
            label="method-transfer"
            labelX={395}
            labelY={395}
          />
          <Edge
            from={[NIGHT_X + COL_W, NIGHT_YS[4] + 35]}
            to={[BRIDGE_X, BRIDGE_YS[0] + 40]}
            label="constraint-transfer"
            labelX={395}
            labelY={490}
            dashed
          />
          <Edge
            from={[BRIDGE_X + COL_W, BRIDGE_YS[0] + 40]}
            to={[DAY_X, DAY_YS[0] + 30]}
            label="hypothesis-output"
            labelX={795}
            labelY={205}
            thick
          />
          <Edge
            from={[BRIDGE_X + COL_W, BRIDGE_YS[1] + 35]}
            to={[DAY_X, DAY_YS[0] + 55]}
            dashed
            faded
          />
          <Edge
            from={[BRIDGE_X + COL_W, BRIDGE_YS[0] + 55]}
            to={[DAY_X, DAY_YS[1] + 30]}
            dashed
            faded
          />
        </svg>

        <hr className="rule mt-6" />
        <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <p
            className="font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            contributors :
          </p>
          <div className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '20px',
                height: '2px',
                background: 'var(--color-accent-ox)',
              }}
            />
            <span
              className="font-mono text-[11px]"
              style={{ color: 'var(--color-ink-2)' }}
            >
              jili · alice
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '20px',
                height: '2px',
                background: 'var(--color-accent-moss)',
              }}
            />
            <span
              className="font-mono text-[11px]"
              style={{ color: 'var(--color-ink-2)' }}
            >
              bob · moss
            </span>
          </div>
          <p
            className="font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            · 6 种 interaction-mode 全展示
          </p>
        </div>
      </div>
    </article>
  );
}

function Node({
  x,
  y,
  h,
  emphasis = false,
  orphan = false,
  children,
}: {
  x: number;
  y: number;
  h: number;
  emphasis?: boolean;
  orphan?: boolean;
  children: React.ReactNode;
}) {
  const borderStyle = orphan
    ? '1px dashed var(--color-hairline)'
    : emphasis
      ? '0.8px solid var(--color-ink)'
      : '1px solid var(--color-hairline)';
  return (
    <foreignObject x={x} y={y} width={COL_W} height={h}>
      <div
        style={{
          width: '100%',
          height: '100%',
          padding: '8px 12px',
          background: 'var(--color-paper)',
          border: borderStyle,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </foreignObject>
  );
}

function NodeCard({
  label,
  title,
  body,
  author,
  authorAccent,
  dim = false,
}: {
  label: string;
  title?: string;
  body: React.ReactNode;
  author: string;
  authorAccent: 'ox' | 'moss' | 'multi';
  dim?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        height: '100%',
        opacity: dim ? 0.75 : 1,
      }}
    >
      <p
        className="font-mono text-[10px] uppercase"
        style={{
          color: 'var(--color-accent-ink)',
          letterSpacing: '1.5px',
          margin: 0,
        }}
      >
        {label}
      </p>
      {title && (
        <p
          className="font-serif text-[13px] font-medium"
          style={{ color: 'var(--color-ink)', margin: 0, lineHeight: 1.3 }}
          data-prose="bilingual"
        >
          {title}
        </p>
      )}
      <p
        className="font-serif text-[13px]"
        style={{ color: 'var(--color-ink)', margin: 0, lineHeight: 1.4 }}
        data-prose="bilingual"
      >
        {body}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: 'auto',
        }}
      >
        <AuthorBar accent={authorAccent} />
        <span
          className="font-mono text-[10px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {author}
        </span>
      </div>
    </div>
  );
}

function AuthorBar({ accent }: { accent: 'ox' | 'moss' | 'multi' }) {
  if (accent === 'multi') {
    return (
      <span style={{ display: 'inline-flex', gap: '2px' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '14px',
            height: '2px',
            background: 'var(--color-accent-ox)',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '14px',
            height: '2px',
            background: 'var(--color-accent-ox)',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '14px',
            height: '2px',
            background: 'var(--color-accent-moss)',
          }}
        />
      </span>
    );
  }
  const color =
    accent === 'moss'
      ? 'var(--color-accent-moss)'
      : 'var(--color-accent-ox)';
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '18px',
        height: '2px',
        background: color,
      }}
    />
  );
}

function Edge({
  from,
  to,
  label,
  labelX,
  labelY,
  dashed = false,
  faded = false,
  thick = false,
}: {
  from: [number, number];
  to: [number, number];
  label?: string;
  labelX?: number;
  labelY?: number;
  dashed?: boolean;
  faded?: boolean;
  thick?: boolean;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const cx1 = x1 + 30;
  const cx2 = x2 - 30;
  const d = `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`;
  const stroke = 'var(--color-accent-ink)';
  const sw = thick ? 1.6 : 1.2;
  return (
    <g opacity={faded ? 0.55 : 1}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dashed ? '3,3' : undefined}
      />
      <polygon
        points={`${x2 - 5},${y2 - 4} ${x2},${y2} ${x2 - 5},${y2 + 4}`}
        fill={stroke}
      />
      {label && labelX !== undefined && labelY !== undefined && (
        <text
          x={labelX}
          y={labelY}
          fontSize="10"
          fontFamily="ui-monospace, monospace"
          fill={stroke}
          letterSpacing="0.5"
        >
          {label}
        </text>
      )}
    </g>
  );
}
